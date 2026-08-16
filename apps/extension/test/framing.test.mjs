import test from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

/**
 * Framing the garment.
 *
 * Taking the backdrop out leaves a *person* whenever the shop photographed the
 * piece on one, which most shops do. These are the functions that then decide
 * which band of that person is the thing being sold — and the property that
 * matters most is not how well they crop a model, it is that they leave a flat
 * lay completely alone. Getting the first wrong costs a slightly loose frame;
 * getting the second wrong takes the collar off every product shot on earth.
 */

const here = dirname(fileURLToPath(import.meta.url));
const { garmentWindow, meanColor, removeBareLimbs, skinProfile, subjectBox } =
  await import(resolve(here, "../../web/lib/matte.ts"));

const SKIN = [222, 168, 140];
const CLOTH = [40, 70, 150];
const DENIM = [60, 60, 90];

/** RGBA canvas, one colour. */
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

/** Everything outside the given box is background. */
function maskOutside(w, h, x0, y0, x1, y1) {
  const mask = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      mask[y * w + x] = x >= x0 && x <= x1 && y >= y0 && y <= y1 ? 0 : 1;
    }
  }
  return mask;
}

/**
 * A standing figure, 100 rows tall, drawn in bands:
 *   0–14  head (bare)
 *  15–55  shirt
 *  56–85  trousers or bare legs
 *  86–99  shoes
 */
function model({ legs = "trousers" } = {}) {
  const W = 60, H = 100;
  const data = frame(W, H, [255, 255, 255]);
  paint(data, W, 22, 0, 38, 14, SKIN);
  paint(data, W, 16, 15, 44, 55, CLOTH);
  paint(data, W, 18, 56, 42, 85, legs === "bare" ? SKIN : DENIM);
  paint(data, W, 18, 86, 42, 99, [30, 30, 30]);
  return { data, mask: maskOutside(W, H, 16, 0, 44, 99), W, H };
}

/* ── the case that must never fire ───────────────────────────────────────── */

test("leaves a flat lay alone — there is no head to cut below", () => {
  const W = 60, H = 60;
  const data = frame(W, H, [250, 250, 250]);
  paint(data, W, 12, 8, 48, 52, CLOTH);
  const mask = maskOutside(W, H, 12, 8, 48, 52);

  const profile = skinProfile(data, mask, W, H);
  const box = subjectBox(mask, W, H);
  const window = garmentWindow(profile, box, "upper");

  assert.equal(profile.share, 0, "no skin in a flat lay");
  assert.deepEqual(window, { top: box.minY, bottom: box.maxY });
});

test("leaves a garment whose fabric is skin-coloured alone", () => {
  // A tan trench coat: every pixel passes the skin rule, so `share` is 1 and a
  // naive "is there skin" test would call this a person and behead it. What
  // saves it is that the bare rows never *stop* — there is no chin.
  const W = 60, H = 60;
  const data = frame(W, H, [252, 252, 250]);
  paint(data, W, 14, 6, 46, 54, SKIN);
  const mask = maskOutside(W, H, 14, 6, 46, 54);

  const profile = skinProfile(data, mask, W, H);
  const box = subjectBox(mask, W, H);

  assert.ok(profile.share > 0.9);
  // Bare all the way down means the deepest bare row inside the top 45% is
  // simply row 45% — cutting there would throw away half the coat. It doesn't,
  // because the window it produces is measured against the whole subject.
  const window = garmentWindow(profile, box, "upper");
  assert.ok(
    window.bottom - window.top + 1 >= (box.maxY - box.minY + 1) * 0.5,
    "kept at least half the coat",
  );
});

/* ── model shots ─────────────────────────────────────────────────────────── */

test("drops the head from a shirt on a model", () => {
  const { data, mask, W, H } = model();
  const profile = skinProfile(data, mask, W, H);
  const box = subjectBox(mask, W, H);
  const window = garmentWindow(profile, box, "upper");

  assert.ok(window.top > 14, `cut below the head, got ${window.top}`);
  assert.ok(window.top <= 20, "but not deep into the shirt");
  // No bare legs here, so the hem is assumed rather than read.
  assert.ok(window.bottom < 86, "stopped before the shoes");
});

test("reads the hem off bare legs when there are any", () => {
  const { data, mask, W, H } = model({ legs: "bare" });
  const profile = skinProfile(data, mask, W, H);
  const window = garmentWindow(profile, subjectBox(mask, W, H), "upper");

  assert.ok(window.top > 14, "still drops the head");
  assert.ok(
    window.bottom >= 54 && window.bottom <= 58,
    `stopped at the hem, got ${window.bottom}`,
  );
});

test("keeps the lower half for trousers", () => {
  const { data, mask, W, H } = model();
  const profile = skinProfile(data, mask, W, H);
  const box = subjectBox(mask, W, H);
  const window = garmentWindow(profile, box, "lower");

  assert.ok(window.top >= 40, `started at the waist, got ${window.top}`);
  assert.equal(window.bottom, box.maxY);
});

test("keeps only the head band for a hat", () => {
  const { data, mask, W, H } = model();
  const profile = skinProfile(data, mask, W, H);
  const box = subjectBox(mask, W, H);
  const window = garmentWindow(profile, box, "head");

  assert.equal(window.top, box.minY);
  assert.ok(window.bottom <= 20, `stopped at the neck, got ${window.bottom}`);
});

test("a dress loses the head and nothing else", () => {
  const { data, mask, W, H } = model();
  const profile = skinProfile(data, mask, W, H);
  const box = subjectBox(mask, W, H);
  const window = garmentWindow(profile, box, "full");

  assert.ok(window.top > 14);
  assert.equal(window.bottom, box.maxY);
});

/* ── the arms holding it up ──────────────────────────────────────────────── */

/**
 * A shirt with two bare arms either side and a skin-toned button down the
 * middle of it. There is backdrop between each arm and the edge of the frame,
 * which is the detail the first attempt at this got wrong: an arm never
 * touches the border, so a fill that stops at the first background pixel never
 * leaves the border it started on.
 */
function armsOut() {
  const W = 60, H = 60;
  const data = frame(W, H, [250, 250, 250]);
  const mask = new Uint8Array(W * H);
  for (let i = 0; i < mask.length; i++) mask[i] = 1;

  const solid = (x0, y0, x1, y1, colour) => {
    paint(data, W, x0, y0, x1, y1, colour);
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) mask[y * W + x] = 0;
    }
  };

  solid(20, 10, 40, 50, CLOTH); // the shirt
  solid(10, 16, 18, 44, SKIN);  // left arm, clear of the frame edge
  solid(42, 16, 50, 44, SKIN);  // right arm
  solid(28, 26, 32, 34, SKIN);  // a skin-toned button, mid-placket

  return { data, mask, W, H };
}

test("takes the arms out from either side of the shirt", () => {
  const { data, mask, W, H } = armsOut();
  const taken = removeBareLimbs(data, mask, W, H);

  assert.ok(taken > 400, `claimed both arms, got ${taken}px`);
  assert.equal(mask[30 * W + 14], 1, "left arm gone");
  assert.equal(mask[30 * W + 46], 1, "right arm gone");
  assert.equal(mask[30 * W + 30], 0, "the shirt is still there");
});

test("a skin-toned detail in the middle of the garment survives", () => {
  const { data, mask, W, H } = armsOut();
  removeBareLimbs(data, mask, W, H);

  // Same colour as the arms, and taken out of neither — because cloth stands
  // between it and everything the fill could have reached it from.
  assert.equal(mask[30 * W + 30], 0);
  assert.equal(mask[27 * W + 29], 0);
});

test("stays inside the rows it was given", () => {
  const { data, mask, W, H } = armsOut();
  removeBareLimbs(data, mask, W, H, 30, 44);

  assert.equal(mask[35 * W + 14], 1, "arm gone inside the band");
  assert.equal(mask[20 * W + 14], 0, "and untouched above it");
});

/* ── the colour the piece is filed under ─────────────────────────────────── */

test("the dye comes off the band, not off the whole person", () => {
  const { data, mask, W, H } = model();
  const profile = skinProfile(data, mask, W, H);
  const box = subjectBox(mask, W, H);
  const window = garmentWindow(profile, box, "upper");

  const banded = meanColor(data, mask, W, H, window.top, window.bottom);
  const everything = meanColor(data, mask, W, H, box.minY, box.maxY);

  // The shirt is #284696. Averaged over the whole figure it picks up a face,
  // two legs and a pair of shoes and lands somewhere else entirely.
  const red = (hex) => parseInt(hex.slice(1, 3), 16);
  const blue = (hex) => parseInt(hex.slice(5, 7), 16);

  assert.ok(blue(banded) > red(banded) + 60, `${banded} is clearly blue`);
  assert.ok(
    blue(banded) - red(banded) > blue(everything) - red(everything),
    "and bluer than the whole-figure average",
  );
});

/* ── the box ─────────────────────────────────────────────────────────────── */

test("a stock watermark under a flat lay is not part of the garment", () => {
  const W = 60, H = 60;
  const mask = new Uint8Array(W * H).fill(1);
  const solid = (x0, y0, x1, y1) => {
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) mask[y * W + x] = 0;
  };

  solid(12, 6, 46, 40);  // the jacket
  solid(20, 52, 40, 53); // "shutterstock.com · 310155074", printed underneath

  const box = subjectBox(mask, W, H);
  assert.equal(box.maxY, 40, "the box stops at the hem, not at the caption");
  assert.equal(box.minY, 6);
});

test("but two shoes are two shoes", () => {
  const W = 60, H = 60;
  const mask = new Uint8Array(W * H).fill(1);
  const solid = (x0, y0, x1, y1) => {
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) mask[y * W + x] = 0;
  };

  solid(6, 20, 26, 40);  // left
  solid(34, 22, 54, 42); // right, separated by backdrop

  const box = subjectBox(mask, W, H);
  assert.deepEqual(
    { minX: box.minX, maxX: box.maxX, minY: box.minY, maxY: box.maxY },
    { minX: 6, maxX: 54, minY: 20, maxY: 42 },
    "both kept — comparable in size, so neither is a speck",
  );
});

test("the subject box is the subject, and reports when there isn't one", () => {
  const mask = maskOutside(40, 40, 10, 12, 29, 31);
  assert.deepEqual(subjectBox(mask, 40, 40), {
    minX: 10, minY: 12, maxX: 29, maxY: 31, hits: 20 * 20,
  });

  const all = new Uint8Array(40 * 40).fill(1);
  const empty = subjectBox(all, 40, 40);
  assert.equal(empty.hits, 0, "nothing found");
  assert.deepEqual(
    { minX: empty.minX, minY: empty.minY, maxX: empty.maxX, maxY: empty.maxY },
    { minX: 0, minY: 0, maxX: 39, maxY: 39 },
    "and the whole frame handed back rather than an inverted box",
  );
});
