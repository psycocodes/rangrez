/**
 * Bench the candidate cutout models against the matte we already ship.
 *
 * Throwaway harness, not part of the app. It exists because "which model is
 * best" is not answerable from published benchmarks: those are scored on DUTS
 * and DIS, which are photographs of objects in scenes, and what this wardrobe
 * actually feeds a model is a garment on a sweep or a bedroom floor — a case
 * nobody reports separately.
 *
 *   node apps/web/scripts/bench-matte.mjs          # both passes
 *   node apps/web/scripts/bench-matte.mjs real     # photographs only
 *   node apps/web/scripts/bench-matte.mjs white    # white-on-white only
 *
 * ── the two passes ───────────────────────────────────────────────────────
 *
 *  real   The 24 photographs in public/uploads — genuine phone shots, the
 *         thing the pipeline is actually handed. Judged by eye off a contact
 *         sheet, because there is no ground truth for them.
 *
 *  white  Every seed cutout composited onto white. Those PNGs carry an alpha
 *         channel, so the answer is already known and a score can be computed
 *         rather than eyeballed — and a white garment on a white field is the
 *         exact case the flood fill destroys, which is why it gets its own
 *         pass rather than being averaged into the first.
 *
 * Scores are IoU against that known alpha. Read them as *relative* — the seed
 * alphas came out of the current pipeline, so they are a strong reference and
 * not a perfect one. A model scoring 0.95 is agreeing with the flood fill;
 * where they disagree the sheet is the tiebreak, not the number.
 */

import { readdir, mkdir, writeFile, stat as stat_ } from "node:fs/promises";
import { resolve, join } from "node:path";
import { createRequire } from "node:module";

import sharp from "sharp";

const require = createRequire(import.meta.url);
const ort = require("onnxruntime-node");

/**
 * Where the .onnx files live.
 *
 * Only u2netp ships in the repository. The comparators are not worth 230MB in
 * git to re-run a decision that is already made, so drop them here by hand if
 * you want to check the numbers again. Anything absent is skipped, not fatal.
 *
 *   curl -Lo u2net.onnx   https://github.com/danielgatis/rembg/releases/download/v0.0.0/u2net.onnx
 *   curl -Lo silueta.onnx https://github.com/danielgatis/rembg/releases/download/v0.0.0/silueta.onnx
 *   curl -Lo modnet-fp16.onnx  https://huggingface.co/Xenova/modnet/resolve/main/onnx/model_fp16.onnx
 *   curl -Lo modnet-quant.onnx https://huggingface.co/Xenova/modnet/resolve/main/onnx/model_quantized.onnx
 *
 * What the MODNet pair is doing in a garment bench, given it is a portrait
 * matting model: it is the only thing found that beats u2netp anywhere near
 * this size, and it does — on photographs of people it rejects distractors as
 * well as the 168MB u2net does, at 13MB. It is not adopted because of what the
 * white pass shows: run on a garment with nobody in it, it punches holes
 * *through the cloth*, because its human prior expects background between
 * limbs and a folded trouser leg looks like that. Its mean IoU stays
 * respectable while doing so, which is the reason to look at the sheets and
 * not the number. Kept here so that stays falsifiable.
 */
const MODELS_DIR = process.env.MODELS_DIR ?? resolve(process.cwd(), "models");

const SEED = resolve(process.cwd(), "public/seed");
const UPLOADS = resolve(process.cwd(), "public/uploads");
const OUT = resolve(process.cwd(), "scripts/.bench");

/**
 * What each candidate wants fed to it.
 *
 * These are not interchangeable and getting one wrong does not raise an error
 * — it produces a plausible-looking mask that is quietly worse, which is the
 * failure mode most likely to make a model look bad for the wrong reason.
 *
 *   side   The resolution the network was trained at. The U²-Net family is
 *          fixed at 320²; MODNet is dynamic and its processor config asks for
 *          a shortest edge of 512.
 *   norm   "rembg"  — divide by the image's own maximum, then ImageNet mean
 *                     and std. Looks wrong, is what every U²-Net weight was
 *                     fitted against.
 *          "signed" — divide by 255, then mean and std of 0.5, giving [-1, 1].
 *   post   "minmax" — raw logits with no fixed range, so they are normalised
 *                     per image before thresholding.
 *          "direct" — already a matte in [0, 1]; rescaling it per image would
 *                     stretch whatever the model was unsure about up to solid.
 */
const SPECS = {
  u2netp: { side: 320, norm: "rembg", post: "minmax", note: "4.4MB U²-Net lite" },
  silueta: { side: 320, norm: "rembg", post: "minmax", note: "42MB" },
  u2net: { side: 320, norm: "rembg", post: "minmax", note: "168MB" },
  "modnet-quant": { side: 512, norm: "signed", post: "direct", note: "6.6MB, humans only" },
  "modnet-fp16": { side: 512, norm: "signed", post: "direct", note: "13MB, humans only" },
};

const IMAGENET = { mean: [0.485, 0.456, 0.406], std: [0.229, 0.224, 0.225] };
const SIGNED = { mean: [0.5, 0.5, 0.5], std: [0.5, 0.5, 0.5] };

/** RGB bytes → the NCHW float tensor the network expects. */
function toTensor(rgb, spec) {
  const side = spec.side;
  const n = side * side;

  let scale = 255;
  let m = SIGNED;
  if (spec.norm === "rembg") {
    m = IMAGENET;
    scale = 0;
    for (let i = 0; i < rgb.length; i++) if (rgb[i] > scale) scale = rgb[i];
    if (scale === 0) scale = 1;
  }

  const data = new Float32Array(3 * n);
  for (let i = 0; i < n; i++) {
    for (let c = 0; c < 3; c++) {
      data[c * n + i] = (rgb[i * 3 + c] / scale - m.mean[c]) / m.std[c];
    }
  }
  return new ort.Tensor("float32", data, [1, 3, side, side]);
}

/** Network output → one byte per pixel. */
function toAlpha(pred, spec) {
  const out = new Uint8Array(pred.length);
  if (spec.post === "direct") {
    for (let i = 0; i < pred.length; i++) {
      out[i] = Math.max(0, Math.min(255, Math.round(pred[i] * 255)));
    }
    return out;
  }
  let mi = Infinity;
  let ma = -Infinity;
  for (const v of pred) {
    if (v < mi) mi = v;
    if (v > ma) ma = v;
  }
  const span = ma - mi || 1;
  for (let i = 0; i < pred.length; i++) {
    out[i] = Math.round(((pred[i] - mi) / span) * 255);
  }
  return out;
}

/** One forward pass over already-prepared RGB at the spec's side. */
async function infer(session, rgb, spec) {
  const t0 = performance.now();
  const out = await session.run({ [session.inputNames[0]]: toTensor(rgb, spec) });
  const ms = performance.now() - t0;
  // U²-Net emits seven side outputs coarse-to-fine; the first is the one to use.
  return { alpha: toAlpha(out[session.outputNames[0]].data, spec), ms };
}

/** A photograph, squared off to a network's input. */
function prepare(file, side) {
  return sharp(file).rotate().resize(side, side, { fit: "fill" }).removeAlpha().raw().toBuffer();
}

/**
 * A cutout laid on flat white, plus the alpha it was cut with.
 *
 * This is the whole point of the white pass: a garment that is itself white,
 * on a white field, with no edge to find except where the cloth stops.
 */
async function onWhite(file, side) {
  const img = sharp(file).rotate().resize(side, side, { fit: "fill" });
  const flat = img.clone().flatten({ background: { r: 255, g: 255, b: 255 } });
  const rgb = await flat.clone().removeAlpha().raw().toBuffer();
  // The shipped matte reads RGBA at stride 4, so it gets its own buffer.
  const rgba = await flat.clone().ensureAlpha().raw().toBuffer();
  const truth = await img.clone().extractChannel(3).raw().toBuffer();
  return { rgb, rgba, truth };
}

/** Agreement between a predicted mask and a known one. */
function iou(pred, truth) {
  let inter = 0;
  let union = 0;
  for (let i = 0; i < truth.length; i++) {
    const a = pred[i] > 127;
    const b = truth[i] > 127;
    if (a && b) inter++;
    if (a || b) union++;
  }
  return union ? inter / union : 1;
}

/**
 * The cutout over a loud flat colour.
 *
 * Magenta on purpose: a leak into the garment and a halo left around it are
 * both invisible against white, which is exactly the failure being hunted.
 */
async function compose(file, alpha, side, w, h) {
  // `.toColourspace("b-w")` is not decoration: sharp promotes a 1-channel raw
  // buffer to 3 channels across a resize, so without it this comes back at
  // 3× the expected length and every read below lands a third of the way
  // through the image — which prints as horizontal banding, not as an error.
  const mask = await sharp(Buffer.from(alpha), {
    raw: { width: side, height: side, channels: 1 },
  })
    .resize(w, h, { fit: "fill" })
    .toColourspace("b-w")
    .raw()
    .toBuffer();
  if (mask.length !== w * h) throw new Error(`mask ${mask.length}, expected ${w * h}`);

  const rgb = await sharp(file)
    .rotate()
    .resize(w, h, { fit: "fill" })
    .flatten({ background: { r: 255, g: 255, b: 255 } })
    .removeAlpha()
    .raw()
    .toBuffer();

  const px = Buffer.alloc(w * h * 3);
  for (let i = 0; i < w * h; i++) {
    const a = mask[i] / 255;
    px[i * 3] = Math.round(rgb[i * 3] * a + 255 * (1 - a));
    px[i * 3 + 1] = Math.round(rgb[i * 3 + 1] * a + 0 * (1 - a));
    px[i * 3 + 2] = Math.round(rgb[i * 3 + 2] * a + 255 * (1 - a));
  }
  return sharp(px, { raw: { width: w, height: h, channels: 3 } }).png().toBuffer();
}

const CELL = 200;

async function sheet(cells, name) {
  const cols = 6;
  const rows = Math.ceil(cells.length / cols);
  const png = await sharp({
    create: {
      width: cols * CELL,
      height: rows * CELL,
      channels: 3,
      background: { r: 18, g: 18, b: 18 },
    },
  })
    .composite(
      cells.map((input, i) => ({
        input,
        left: (i % cols) * CELL,
        top: Math.floor(i / cols) * CELL,
      })),
    )
    .png()
    .toBuffer();
  await writeFile(join(OUT, `${name}.png`), png);
}

const ALL = Object.keys(SPECS);

/** Those actually present, so a missing comparator skips instead of throwing. */
async function available() {
  const found = [];
  for (const name of ALL) {
    try {
      await stat_(join(MODELS_DIR, `${name}.onnx`));
      found.push(name);
    } catch {
      /* not downloaded — see MODELS_DIR above */
    }
  }
  return found;
}

async function open(name) {
  return ort.InferenceSession.create(join(MODELS_DIR, `${name}.onnx`), {
    executionProviders: ["cpu"],
    graphOptimizationLevel: "all",
  });
}

const stat = (xs) => {
  const s = [...xs].sort((a, b) => a - b);
  return {
    mean: xs.reduce((a, b) => a + b, 0) / xs.length,
    median: s[s.length >> 1],
    worst: s[0],
  };
};

/** The resolution the flood fill is judged at. It has no trained input size. */
const BASE = 320;

/** Prepared pixels per resolution, so two models at 512 share one decode. */
async function preppedFor(files, dir, sides, white) {
  const by = new Map();
  for (const side of sides) {
    const rows = [];
    for (const f of files) {
      const file = join(dir, f);
      rows.push(
        white
          ? { f, ...(await onWhite(file, side)) }
          : {
              f,
              rgb: await prepare(file, side),
              rgba: await sharp(file)
                .rotate()
                .resize(side, side, { fit: "fill" })
                .ensureAlpha()
                .raw()
                .toBuffer(),
            },
      );
    }
    by.set(side, rows);
  }
  return by;
}

/** The incumbent, at BASE. Returns its per-image alphas so callers can score. */
async function floodPass(rows, dir, label) {
  const { floodBackground } = await import(resolve(process.cwd(), "lib/matte.ts"));
  const cells = [];
  const alphas = [];
  const times = [];
  for (const { f, rgba } of rows) {
    const t0 = performance.now();
    const bg = floodBackground(new Uint8ClampedArray(rgba), BASE, BASE);
    times.push(performance.now() - t0);
    const alpha = new Uint8Array(bg.length);
    for (let i = 0; i < bg.length; i++) alpha[i] = bg[i] ? 0 : 255;
    alphas.push(alpha);
    cells.push(await compose(join(dir, f), alpha, BASE, CELL, CELL));
  }
  await sheet(cells, label);
  return { alphas, times };
}

const sidesOf = (names) => [...new Set(names.map((n) => SPECS[n].side))];

async function realPass() {
  const files = (await readdir(UPLOADS))
    .filter((f) => /\.jpe?g$/i.test(f))
    .sort()
    .slice(0, 24);

  const names = await available();
  console.log(`\n── photographs · ${files.length} real uploads ──`);
  const by = await preppedFor(files, UPLOADS, [...sidesOf(names), BASE], false);

  /* This is the pass where comparing to the flood fill means something — the
     white pass scores against alphas the flood fill itself produced, so it
     wins that one by construction. Here nothing knows the answer in advance. */
  const flood = await floodPass(by.get(BASE), UPLOADS, "real-floodfill");
  console.log(`  ${"floodfill".padEnd(13)} ${stat(flood.times).median.toFixed(0)}ms median`);

  for (const name of names) {
    const spec = SPECS[name];
    const session = await open(name);
    const cells = [];
    const times = [];
    for (const { f, rgb } of by.get(spec.side)) {
      const { alpha, ms } = await infer(session, rgb, spec);
      times.push(ms);
      cells.push(await compose(join(UPLOADS, f), alpha, spec.side, CELL, CELL));
    }
    await sheet(cells, `real-${name}`);
    const t = stat(times);
    console.log(
      `  ${name.padEnd(13)} ${t.median.toFixed(0)}ms median · ${t.mean.toFixed(0)}ms mean` +
        `  @${spec.side}²  ${spec.note}`,
    );
  }
}

async function whitePass() {
  const files = (await readdir(SEED)).filter((f) => /\.png$/i.test(f)).sort();
  const names = await available();

  console.log(`\n── white on white · ${files.length} seed cutouts, IoU vs known alpha ──`);
  const by = await preppedFor(files, SEED, [...sidesOf(names), BASE], true);

  const flood = await floodPass(by.get(BASE), SEED, "white-floodfill");
  {
    const scores = flood.alphas.map((a, i) => iou(a, by.get(BASE)[i].truth));
    const s = stat(scores);
    console.log(
      `  ${"floodfill".padEnd(13)} IoU mean ${s.mean.toFixed(3)} · median ${s.median.toFixed(3)} · ` +
        `worst ${s.worst.toFixed(3)} · under 0.80: ${scores.filter((v) => v < 0.8).length}/${scores.length}` +
        `  ← scored against its own output, so read it as a ceiling, not a result`,
    );
  }

  for (const name of names) {
    const spec = SPECS[name];
    const session = await open(name);
    const cells = [];
    const scores = [];
    for (const { f, rgb, truth } of by.get(spec.side)) {
      const { alpha } = await infer(session, rgb, spec);
      scores.push(iou(alpha, truth));
      cells.push(await compose(join(SEED, f), alpha, spec.side, CELL, CELL));
    }
    await sheet(cells, `white-${name}`);
    const s = stat(scores);
    const bad = scores.filter((v) => v < 0.8).length;
    console.log(
      `  ${name.padEnd(13)} IoU mean ${s.mean.toFixed(3)} · median ${s.median.toFixed(3)} · ` +
        `worst ${s.worst.toFixed(3)} · under 0.80: ${bad}/${scores.length}`,
    );
  }
}

async function main() {
  await mkdir(OUT, { recursive: true });
  const which = process.argv[2];
  if (which !== "white") await realPass();
  if (which !== "real") await whitePass();
  console.log(`\nsheets → ${OUT}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
