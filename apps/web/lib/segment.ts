import { createRequire } from "node:module";
import { resolve } from "node:path";

import sharp from "sharp";

/**
 * ═══════════════════════════════════════════════════════════════════════════
 *  Cutting the garment out with a model
 * ═══════════════════════════════════════════════════════════════════════════
 *
 *  lib/matte.ts decides what is background by *connectivity* — start at the
 *  frame edge and spread through anything that still looks like the backdrop.
 *  It is a good algorithm and it has a ceiling: it knows nothing about
 *  garments, only about colour. On a product sweep that is enough. On a
 *  photograph of a shirt on a bedroom floor it is not even close — measured
 *  over the 24 real uploads in public/uploads it keeps most of the frame,
 *  trees and floorboards and café furniture included, because a forest is not
 *  one colour and connectivity has nothing else to go on.
 *
 *  A segmentation model does not reason about colour. It has been shown a
 *  million objects and knows what one looks like.
 *
 *  ── which model, and why this one ────────────────────────────────────────
 *
 *  U²-Net *lite* (u2netp), 4.4MB, Apache-2.0, from the rembg model set.
 *
 *  It is the smallest thing here by two orders of magnitude and that is not a
 *  compromise — it was measured. Against u2net (168MB) and silueta (42MB) on
 *  both the real photographs and the white-on-white set, the three agree to
 *  within 0.012 IoU and fail on exactly the same images. See
 *  scripts/bench-matte.mjs, which is kept precisely so this claim can be
 *  re-checked rather than believed.
 *
 *  What the big model buys is distractor rejection — u2net drops a held bag
 *  that u2netp keeps. That is worth 38× the size only if the size is free,
 *  and it is not: 168MB does not fit in a serverless function alongside the
 *  app, whereas 4.4MB ships in the repository next to a 2.7MB font and needs
 *  no fetch step, no cache directory and no cold-start download.
 *
 *  Rejected, with reasons, so nobody re-litigates this from the README:
 *
 *    · BiRefNet-lite  224MB fp32 / 114MB fp16, and fixed at 1024². Better on
 *                     hair. Garments do not have hair, and the fixed input
 *                     makes it ~20× the compute of a 320² pass.
 *    · RMBG-2.0 / 1.4 Measurably the most accurate of the family, and the
 *                     licence forbids commercial use without an agreement.
 *    · isnet-general   170MB at 1024². Same size problem, same reason.
 *    · silueta         42MB and *slower* than the 168MB u2net on this CPU —
 *                      it is optimised for size, not for latency. Strictly
 *                      dominated; there is no configuration where it wins.
 *
 *  ── how it fails ─────────────────────────────────────────────────────────
 *
 *  Never loudly. Every door out of this file returns `null` and the caller
 *  quietly uses the matte it has always used. A wardrobe that cuts garments
 *  out slightly worse is a working wardrobe; one that throws because a runtime
 *  is missing is not.
 * ═══════════════════════════════════════════════════════════════════════════
 */

/**
 * What the network was trained at.
 *
 * The whole reason this family is quick on a CPU is that the input is small
 * and fixed — compute scales with pixels, which is why the 168MB u2net is not
 * 38× slower than the 4.4MB u2netp, only ~2.5×.
 */
export const SEGMENT_SIDE = 320;

/** ImageNet, as U²-Net was trained. */
const MEAN = [0.485, 0.456, 0.406];
const STD = [0.229, 0.224, 0.225];

/** Shipped in the repository — 4.4MB, no fetch step, no cache directory. */
const WEIGHTS = resolve(process.cwd(), "models/u2netp.onnx");

/** Set `RANGREZ_MATTE=classic` to force the hand-written matte. */
const disabled = () => process.env.RANGREZ_MATTE === "classic";

interface Session {
  run: (feeds: Record<string, unknown>) => Promise<Record<string, { data: Float32Array }>>;
  inputNames: string[];
  outputNames: string[];
}

interface Runtime {
  Tensor: new (type: string, data: Float32Array, dims: number[]) => unknown;
  InferenceSession: {
    create: (path: string, opts?: Record<string, unknown>) => Promise<Session>;
  };
}

/**
 * The runtime, loaded once.
 *
 * `onnxruntime-node` is pinned to an exact 1.23.2 in package.json on purpose,
 * and the pin must not be widened to `^1.23.2`: 1.23.2 is the last release
 * shipping a `darwin-x64` binary. 1.24.3 dropped it, which is what made every
 * previous attempt at this silently unrunnable on an Intel Mac — the module
 * resolves, the binary does not exist, and the failure surfaces here as a
 * `null` rather than as anything that names the cause.
 */
let runtime: Promise<Runtime | null> | null = null;

function load(): Promise<Runtime | null> {
  runtime ??= (async () => {
    try {
      const require = createRequire(import.meta.url);
      return require("onnxruntime-node") as Runtime;
    } catch {
      return null;
    }
  })();
  return runtime;
}

let session: Promise<Session | null> | null = null;

function open(): Promise<Session | null> {
  session ??= (async () => {
    const ort = await load();
    if (!ort) return null;
    try {
      return await ort.InferenceSession.create(WEIGHTS, {
        executionProviders: ["cpu"],
        graphOptimizationLevel: "all",
      });
    } catch {
      // Weights absent or unreadable. The caller falls back; nothing throws.
      return null;
    }
  })();
  return session;
}

/**
 * RGB bytes at SEGMENT_SIDE² → the NCHW tensor the network expects.
 *
 * The division is by the image's own maximum rather than by 255. That looks
 * like a bug and is not: it is what rembg does, and every published weight in
 * this family was fitted against that preprocessing. Matching the training
 * pipeline matters more than the arithmetic being the obvious choice.
 */
function toTensor(
  ort: Runtime,
  rgb: Uint8Array,
): { tensor: unknown } | null {
  const n = SEGMENT_SIDE * SEGMENT_SIDE;
  if (rgb.length !== n * 3) return null;

  let max = 0;
  for (let i = 0; i < rgb.length; i++) if (rgb[i] > max) max = rgb[i];
  if (max === 0) return null;

  const data = new Float32Array(3 * n);
  for (let i = 0; i < n; i++) {
    for (let c = 0; c < 3; c++) {
      data[c * n + i] = (rgb[i * 3 + c] / max - MEAN[c]) / STD[c];
    }
  }
  return { tensor: new ort.Tensor("float32", data, [1, 3, SEGMENT_SIDE, SEGMENT_SIDE]) };
}

export interface Segmented {
  /** One byte per pixel, 255 where the model is sure it is subject. */
  alpha: Uint8Array;
  width: number;
  height: number;
}

/**
 * The subject, as an alpha map at SEGMENT_SIDE².
 *
 * `rgb` must already be SEGMENT_SIDE² and three channels — resizing belongs to
 * the caller, which is holding sharp and the original pixels anyway.
 */
export async function segment(rgb: Uint8Array): Promise<Segmented | null> {
  if (disabled()) return null;

  const ort = await load();
  if (!ort) return null;

  const s = await open();
  if (!s) return null;

  const prepared = toTensor(ort, rgb);
  if (!prepared) return null;

  try {
    const out = await s.run({ [s.inputNames[0]]: prepared.tensor });

    /* Seven side outputs, coarse to fine; d0 is the one to use. Then min-max
       normalise — the network's raw logits have no fixed range, so a fixed
       threshold over them would mean something different for every image. */
    const pred = out[s.outputNames[0]]?.data;
    if (!pred || pred.length !== SEGMENT_SIDE * SEGMENT_SIDE) return null;

    let mi = Infinity;
    let ma = -Infinity;
    for (const v of pred) {
      if (v < mi) mi = v;
      if (v > ma) ma = v;
    }
    const span = ma - mi;
    if (!Number.isFinite(span) || span <= 0) return null;

    const alpha = new Uint8Array(pred.length);
    for (let i = 0; i < pred.length; i++) {
      alpha[i] = Math.round(((pred[i] - mi) / span) * 255);
    }

    return { alpha, width: SEGMENT_SIDE, height: SEGMENT_SIDE };
  } catch {
    return null;
  }
}

/**
 * A background mask for an encoded image, at whatever size the caller works in.
 *
 * One byte per pixel, **1 where background and 0 where subject** — deliberately
 * the same contract `floodBackground` in lib/matte.ts returns, so the two are
 * interchangeable and every consumer downstream (subjectBox, meanColor,
 * softenMask) is indifferent to which one answered. If that ever stops being
 * true the fallback stops being a fallback.
 *
 * Returns null on anything unexpected, which includes an image sharp cannot
 * decode and a model that is not installed.
 */
export async function backgroundMask(
  image: Buffer,
  w: number,
  h: number,
): Promise<Uint8Array | null> {
  if (!Number.isInteger(w) || !Number.isInteger(h) || w < 1 || h < 1) return null;

  try {
    const rgb = await sharp(image)
      .removeAlpha()
      .resize(SEGMENT_SIDE, SEGMENT_SIDE, { fit: "fill" })
      .raw()
      .toBuffer();

    const found = await segment(new Uint8Array(rgb));
    if (!found) return null;

    /* Back to the caller's shape. `.toColourspace("b-w")` is load-bearing:
       sharp promotes a 1-channel raw buffer to 3 across a resize, and the
       length check below is what catches it if that ever changes again. */
    const at = await sharp(Buffer.from(found.alpha), {
      raw: { width: found.width, height: found.height, channels: 1 },
    })
      .resize(w, h, { fit: "fill" })
      .toColourspace("b-w")
      .raw()
      .toBuffer();

    if (at.length !== w * h) return null;

    const mask = new Uint8Array(w * h);
    for (let i = 0; i < mask.length; i++) mask[i] = at[i] > 127 ? 0 : 1;
    return mask;
  } catch {
    return null;
  }
}
