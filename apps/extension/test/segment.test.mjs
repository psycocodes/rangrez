import test from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

/**
 * Cutting the garment out with a model.
 *
 * The contract these hold to is not "the mask is good" — that is a judgement
 * made off contact sheets in scripts/bench-matte.mjs, and it is not something
 * a unit test can assert. What matters here is the *other* half: that every
 * way this can fail returns `null` instead of throwing, because the caller
 * treats null as "use the hand-written matte" and treats an exception as a
 * garment that cannot be saved at all.
 *
 * The weights ship in the repository (models/u2netp.onnx, 4.4MB), so unlike
 * every previous attempt at this these run everywhere rather than skipping.
 */

const here = dirname(fileURLToPath(import.meta.url));
const web = resolve(here, "../../web");

// The module resolves its weights relative to cwd, as it does under Next.
process.chdir(web);

const { segment, SEGMENT_SIDE } = await import(resolve(web, "lib/segment.ts"));

const N = SEGMENT_SIDE * SEGMENT_SIDE * 3;

test("the model's input size is the one the graph declares", () => {
  // 320, not 1024. A wrong value here does not fail loudly — it produces a
  // tensor the session rejects, which this file would otherwise report as a
  // generic fallback rather than as a mismatch.
  assert.equal(SEGMENT_SIDE, 320);
});

test("a wrongly sized buffer falls back rather than throwing", async () => {
  for (const size of [0, N - 3, N + 3, 1024 * 1024 * 3]) {
    const out = await segment(new Uint8Array(size));
    assert.equal(out, null, `${size} bytes should fall back`);
  }
});

test("a black frame falls back rather than dividing by zero", async () => {
  // Preprocessing divides by the image's own maximum. An all-zero frame has a
  // maximum of zero, and the naive version of this returns a tensor full of
  // NaN that the session accepts and produces garbage from.
  assert.equal(await segment(new Uint8Array(N)), null);
});

test("RANGREZ_MATTE=classic turns the model off", async () => {
  const was = process.env.RANGREZ_MATTE;
  process.env.RANGREZ_MATTE = "classic";
  try {
    const out = await segment(new Uint8Array(N).fill(120));
    assert.equal(out, null, "the escape hatch should bypass the model entirely");
  } finally {
    if (was === undefined) delete process.env.RANGREZ_MATTE;
    else process.env.RANGREZ_MATTE = was;
  }
});

test("a real frame comes back as a plausible alpha map", async () => {
  // A bright disc on a dark field — the one shape a saliency model cannot
  // reasonably disagree about.
  const px = new Uint8Array(N);
  const c = SEGMENT_SIDE / 2;
  const r = SEGMENT_SIDE / 4;
  for (let y = 0; y < SEGMENT_SIDE; y++) {
    for (let x = 0; x < SEGMENT_SIDE; x++) {
      const inside = (x - c) ** 2 + (y - c) ** 2 < r * r;
      const i = (y * SEGMENT_SIDE + x) * 3;
      px[i] = px[i + 1] = px[i + 2] = inside ? 235 : 20;
    }
  }

  const out = await segment(px);
  assert.ok(out, "the shipped weights should load and run");
  assert.equal(out.width, SEGMENT_SIDE);
  assert.equal(out.height, SEGMENT_SIDE);
  assert.equal(out.alpha.length, SEGMENT_SIDE * SEGMENT_SIDE);

  // Min-max normalised, so both ends of the range must actually be reached.
  let lo = 255;
  let hi = 0;
  for (const v of out.alpha) {
    if (v < lo) lo = v;
    if (v > hi) hi = v;
  }
  assert.equal(hi, 255, "the brightest pixel should be fully opaque");
  assert.equal(lo, 0, "the darkest pixel should be fully clear");

  // The disc covers pi/16 of the frame, ~19.6%. Anything wildly off that means
  // the preprocessing is wrong rather than the model being imprecise.
  let on = 0;
  for (const v of out.alpha) if (v > 127) on++;
  const share = on / out.alpha.length;
  assert.ok(share > 0.05 && share < 0.5, `subject share ${share.toFixed(3)} is implausible`);
});

/* ── the mask the browser's cutout asks for ──────────────────────────────
   lib/cutout.ts posts a ~320px probe to /api/matte and applies what comes
   back to the full-resolution image. The contract it needs is narrow and
   exact: w×h bytes, 1 for background, and null rather than a throw for
   anything it should fall back from. */

const { backgroundMask } = await import(resolve(web, "lib/segment.ts"));
const sharp = (await import("sharp")).default;

/** A bright disc on a dark field, as an encoded PNG at an arbitrary shape. */
async function disc(w, h) {
  const px = Buffer.alloc(w * h * 3);
  const cx = w / 2;
  const cy = h / 2;
  const r = Math.min(w, h) / 3;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const inside = (x - cx) ** 2 + (y - cy) ** 2 < r * r;
      const i = (y * w + x) * 3;
      px[i] = px[i + 1] = px[i + 2] = inside ? 235 : 20;
    }
  }
  return sharp(px, { raw: { width: w, height: h, channels: 3 } }).png().toBuffer();
}

test("the mask comes back at the probe's shape, not the model's square", async () => {
  // The probe is never square — it keeps the photograph's aspect. A mask at
  // 320² would be silently misapplied by every consumer downstream.
  for (const [w, h] of [
    [240, 320],
    [320, 180],
    [37, 53],
  ]) {
    const mask = await backgroundMask(await disc(w * 2, h * 2), w, h);
    assert.ok(mask, `${w}×${h} should produce a mask`);
    assert.equal(mask.length, w * h, `${w}×${h} mask is the wrong length`);
  }
});

test("1 means background, matching floodBackground", async () => {
  const w = 240;
  const h = 320;
  const mask = await backgroundMask(await disc(w, h), w, h);
  assert.ok(mask);

  for (const v of mask) assert.ok(v === 0 || v === 1, "mask must be strictly 0 or 1");

  // The disc sits dead centre and the corners are field, so the polarity is
  // checkable without knowing anything else about the model.
  const at = (x, y) => mask[y * w + x];
  assert.equal(at(w >> 1, h >> 1), 0, "the subject's centre must not be background");
  assert.equal(at(1, 1), 1, "the corner must be background");

  let bg = 0;
  for (const v of mask) bg += v;
  const share = bg / mask.length;
  assert.ok(share > 0.4 && share < 0.95, `background share ${share.toFixed(3)} is implausible`);
});

test("undecodable input and nonsense sizes fall back rather than throwing", async () => {
  assert.equal(await backgroundMask(Buffer.from("not an image"), 32, 32), null);
  assert.equal(await backgroundMask(Buffer.alloc(0), 32, 32), null);

  const png = await disc(64, 64);
  for (const [w, h] of [
    [0, 32],
    [32, 0],
    [-8, 32],
    [1.5, 32],
  ]) {
    assert.equal(await backgroundMask(png, w, h), null, `${w}×${h} should be rejected`);
  }
});
