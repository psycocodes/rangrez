import test from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

/**
 * The matte.
 *
 * lib/cutout.ts needs a canvas to do its job, but the part that decides what
 * is background and what isn't is plain array maths over RGBA — so that part
 * is exported and tested here on synthetic images with known answers.
 *
 * The case that matters most is a white garment on a white backdrop. It is
 * the one every colour-threshold approach gets wrong, it is extremely common
 * (it is what a product shot *is*), and getting it wrong doesn't produce a
 * slightly worse cutout — it deletes the garment.
 */

const here = dirname(fileURLToPath(import.meta.url));
const { floodBackground, softenMask } = await import(
  resolve(here, "../../web/lib/matte.ts")
);

/** A blank RGBA canvas, filled with one colour. */
function frame(w, h, [r, g, b]) {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < w * h; i++) {
    data[i * 4] = r;
    data[i * 4 + 1] = g;
    data[i * 4 + 2] = b;
    data[i * 4 + 3] = 255;
  }
  return data;
}

function paint(data, w, x0, y0, x1, y1, [r, g, b]) {
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const i = (y * w + x) * 4;
      data[i] = r;
      data[i + 1] = g;
      data[i + 2] = b;
    }
  }
}

const count = (mask) => mask.reduce((n, v) => n + v, 0);
const subjectAt = (mask, w, x, y) => mask[y * w + x] === 0;

/* ── the case the whole approach exists for ──────────────────────────────── */

test("keeps a white garment on a white backdrop", () => {
  const W = 60, H = 60;
  const data = frame(W, H, [255, 255, 255]);
  // A near-white garment with a visible outline — a real shirt on a real
  // sweep, where the fabric is a shade off the paper and the edge is shaded.
  paint(data, W, 18, 12, 42, 48, [200, 200, 200]); // the outline/shadow
  paint(data, W, 20, 14, 40, 46, [250, 250, 250]); // the fabric itself

  const mask = floodBackground(data, W, H);

  assert.ok(subjectAt(mask, W, 30, 30), "the middle of the shirt was deleted");
  assert.ok(subjectAt(mask, W, 22, 20), "the shirt's corner was deleted");
  assert.equal(mask[0], 1, "the backdrop survived");
  assert.equal(mask[W * H - 1], 1, "the backdrop survived");

  // What a pure colour threshold would have done, for contrast: the fabric is
  // 5 levels off the backdrop, so distance alone deletes it outright.
  const byThreshold = Math.abs(250 - 255) * 3;
  assert.ok(byThreshold < 46, "the fabric is inside any usable colour tolerance");
});

test("removes a plain backdrop from a dark subject", () => {
  const W = 60, H = 60;
  const data = frame(W, H, [244, 242, 238]);
  paint(data, W, 20, 15, 40, 45, [40, 45, 70]);

  const mask = floodBackground(data, W, H);
  const removed = count(mask) / mask.length;

  assert.ok(removed > 0.5 && removed < 0.9, `removed ${(removed * 100).toFixed(0)}%`);
  assert.ok(subjectAt(mask, W, 30, 30));
});

/* ── the blind spot, and the patch for it ────────────────────────────────── */

test("takes out the gap between an arm and a torso", () => {
  const W = 80, H = 80;
  const data = frame(W, H, [250, 250, 250]);

  // A torso with an arm bent back to the hip: the triangle between them is
  // backdrop, but it is walled off from the frame edge on every side.
  paint(data, W, 30, 20, 50, 65, [60, 70, 110]);   // torso
  paint(data, W, 22, 20, 30, 28, [60, 70, 110]);   // shoulder
  paint(data, W, 22, 20, 26, 60, [60, 70, 110]);   // upper arm, down the side
  paint(data, W, 22, 56, 34, 60, [60, 70, 110]);   // forearm, back to the hip
  // → an enclosed pocket of backdrop at roughly x 27-29, y 29-55

  const mask = floodBackground(data, W, H);

  assert.equal(mask[40 * W + 28], 1, "the armpit gap was left as if it were body");
  assert.ok(subjectAt(mask, W, 40, 40), "the torso survived");
  assert.ok(subjectAt(mask, W, 24, 40), "the arm survived");
});

test("does not punch a hole through a large pale garment", () => {
  const W = 80, H = 80;
  const data = frame(W, H, [252, 252, 252]);
  // A big shirt whose interior is the same colour as the backdrop. Enclosed
  // and backdrop-coloured — the pocket rule must not touch it, because it is
  // far too big to be a pocket.
  paint(data, W, 14, 10, 66, 70, [180, 180, 180]);
  paint(data, W, 17, 13, 63, 67, [252, 252, 252]);

  const mask = floodBackground(data, W, H);
  assert.ok(subjectAt(mask, W, 40, 40), "the shirt's interior was deleted");
  assert.ok(subjectAt(mask, W, 20, 16), "the shirt's interior was deleted");
});

/* ── knowing when it has failed ──────────────────────────────────────────── */

test("finds nothing to remove in a frame that is all subject", () => {
  const data = frame(40, 40, [90, 60, 40]);
  const mask = floodBackground(data, 40, 40);
  // Every pixel matches the border, so the fill takes the lot — which the
  // caller reads as "no background here" and falls back to a plain crop.
  assert.equal(count(mask), 40 * 40);
});

test("a busy backdrop widens the tolerance rather than finding nothing", () => {
  const W = 60, H = 60;
  const data = frame(W, H, [200, 200, 200]);
  // Noise across the whole frame, subject included.
  for (let i = 0; i < W * H; i++) {
    const n = ((i * 2654435761) % 40) - 20;
    data[i * 4] += n;
    data[i * 4 + 1] += n;
    data[i * 4 + 2] += n;
  }
  paint(data, W, 22, 18, 38, 42, [30, 40, 90]);

  const mask = floodBackground(data, W, H);
  assert.ok(count(mask) > W * H * 0.4, "a noisy backdrop should still be found");
  assert.ok(subjectAt(mask, W, 30, 30), "the subject survived the noise");
});

test("a subject running off the bottom of the frame still mattes", () => {
  const W = 60, H = 60;
  const data = frame(W, H, [246, 244, 240]);
  // A standing figure whose feet reach the edge — the fill has to get around
  // it rather than being blocked by it.
  paint(data, W, 24, 10, 36, H - 1, [50, 50, 60]);

  const mask = floodBackground(data, W, H);
  assert.ok(subjectAt(mask, W, 30, 55), "the feet were cut off");
  assert.equal(mask[5 * W + 5], 1, "the backdrop beside them survived");
  assert.equal(mask[(H - 1) * W + 5], 1, "the floor beside them survived");
});

/* ── the edge ────────────────────────────────────────────────────────────── */

test("softening leaves the middle opaque and only ramps the boundary", () => {
  const W = 40, H = 40;
  const mask = new Uint8Array(W * H).fill(1);
  for (let y = 10; y < 30; y++) {
    for (let x = 10; x < 30; x++) mask[y * W + x] = 0;
  }

  const alpha = softenMask(mask, W, H);

  assert.equal(alpha[20 * W + 20], 255, "the middle of the subject went translucent");
  assert.equal(alpha[2 * W + 2], 0, "the background picked up alpha");

  const partial = [...alpha].filter((a) => a > 0 && a < 255).length;
  assert.ok(partial > 0, "the edge is a hard stair-step, not a matte");
  assert.ok(
    partial < W * H * 0.2,
    `${partial} partial pixels — the blur fogged the whole image`,
  );
});

test("softening never inverts what the mask decided", () => {
  const W = 24, H = 24;
  const mask = new Uint8Array(W * H);
  for (let y = 6; y < 18; y++) for (let x = 6; x < 18; x++) mask[y * W + x] = 0;
  for (let i = 0; i < mask.length; i++) if (mask[i] === undefined) mask[i] = 1;
  // Everything outside the square is background.
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (x < 6 || x >= 18 || y < 6 || y >= 18) mask[y * W + x] = 1;
    }
  }

  const alpha = softenMask(mask, W, H);
  // Deep inside stays fully one thing or the other; only the seam is between.
  assert.equal(alpha[12 * W + 12], 255);
  assert.equal(alpha[0], 0);
});
