import test from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

/**
 * Taking the background out.
 *
 * The case that matters most here is the one that used to destroy garments:
 * something white photographed on something white. Connectivity is supposed to
 * save it — the outline stands between the interior and the border — but an
 * outline that is only *faintly* different in colour has gaps, and through a
 * gap the fill reaches an interior that is entirely within tolerance and takes
 * the whole piece. These check that it doesn't, and that fixing it didn't cost
 * the ordinary case its clean edge.
 */

const here = dirname(fileURLToPath(import.meta.url));
const { floodBackground } = await import(resolve(here, "../../web/lib/matte.ts"));

/** RGBA canvas filled with one colour. */
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

/** A one-pixel outline just inside the given box. */
function outline(data, w, x0, y0, x1, y1, colour) {
  paint(data, w, x0, y0, x1, y0, colour);
  paint(data, w, x0, y1, x1, y1, colour);
  paint(data, w, x0, y0, x0, y1, colour);
  paint(data, w, x1, y0, x1, y1, colour);
}

/** Share of the given box the mask calls background. */
function eaten(mask, w, x0, y0, x1, y1) {
  let bg = 0;
  let n = 0;
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      n++;
      if (mask[y * w + x]) bg++;
    }
  }
  return bg / n;
}

/* ── the case that used to eat the garment ───────────────────────────────── */

test("a white garment on a white sweep survives", () => {
  // #fafafa on #ffffff — five levels apart, far inside any tolerance wide
  // enough to cope with a real photograph. All that separates them is the
  // shadow along the garment's edge.
  const W = 90, H = 90;
  const data = frame(W, H, [255, 255, 255]);
  paint(data, W, 20, 18, 69, 71, [250, 250, 250]);
  outline(data, W, 20, 18, 69, 71, [214, 214, 214]);

  const mask = floodBackground(data, W, H);

  assert.ok(
    eaten(mask, W, 26, 24, 63, 65) < 0.02,
    `garment kept, ${(eaten(mask, W, 26, 24, 63, 65) * 100) | 0}% was eaten`,
  );
  assert.equal(mask[2 * W + 2], 1, "and the sweep is still removed");
});

test("survives even when the outline has a hole in it", () => {
  // The real failure: a couple of pixels along the hem that read as backdrop.
  // Colour alone threads straight through and the interior — every pixel of
  // which is within tolerance — goes with it.
  const W = 90, H = 90;
  const data = frame(W, H, [255, 255, 255]);
  paint(data, W, 20, 18, 69, 71, [250, 250, 250]);
  outline(data, W, 20, 18, 69, 71, [214, 214, 214]);
  // A three-pixel gap in the bottom edge, the backdrop's own colour.
  paint(data, W, 40, 71, 42, 71, [255, 255, 255]);

  const mask = floodBackground(data, W, H);
  assert.ok(
    eaten(mask, W, 26, 24, 63, 65) < 0.02,
    `held the line, ${(eaten(mask, W, 26, 24, 63, 65) * 100) | 0}% was eaten`,
  );
});

/* ── and the ordinary case still comes out clean ─────────────────────────── */

test("a dark garment is cut without leaving a halo", () => {
  const W = 90, H = 90;
  const data = frame(W, H, [252, 251, 249]);
  paint(data, W, 24, 20, 65, 69, [32, 48, 120]);

  const mask = floodBackground(data, W, H);

  // Nothing of the garment taken…
  assert.equal(eaten(mask, W, 24, 20, 65, 69), 0, "garment fully kept");
  // …and no ring of backdrop kept around it. Without the fringe trim the
  // barrier stops a pixel or two out and every one of these survives.
  for (const [x, y] of [[23, 44], [66, 44], [44, 19], [44, 70]]) {
    assert.equal(mask[y * W + x], 1, `backdrop removed at ${x},${y}`);
  }
});

test("a busy backdrop still gets removed", () => {
  // Noise well above the faint-edge floor. The bar is set from the backdrop's
  // own gradient, so a loud background cannot lock the fill out — it degrades
  // to plain colour matching rather than refusing to start.
  const W = 90, H = 90;
  const data = frame(W, H, [228, 224, 216]);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const n = (x * 7 + y * 13) % 5 === 0 ? 26 : 0;
      const i = (y * W + x) * 4;
      data[i] -= n;
      data[i + 1] -= n;
      data[i + 2] -= n;
    }
  }
  paint(data, W, 30, 26, 60, 64, [120, 40, 46]);

  const mask = floodBackground(data, W, H);
  assert.ok(eaten(mask, W, 2, 2, 12, 12) > 0.8, "corner of the backdrop went");
  assert.equal(eaten(mask, W, 33, 29, 57, 61), 0, "garment kept");
});

test("a small enclosed gap is still taken — the triangle under an arm", () => {
  const W = 90, H = 90;
  const data = frame(W, H, [250, 250, 250]);
  paint(data, W, 26, 26, 63, 63, [70, 90, 60]);
  // 7×7, well under a percent of the frame.
  paint(data, W, 41, 41, 47, 47, [250, 250, 250]);

  const mask = floodBackground(data, W, H);
  assert.equal(mask[30 * W + 30], 0, "the ring is garment");
  assert.equal(mask[44 * W + 44], 1, "the gap enclosed by it is not");
});

test("a big enclosed panel is kept — the white midsole of a trainer", () => {
  // Same shape, larger hole. This is the case that mattered: an enclosed
  // region the colour of the sweep, too big to be a gap between two limbs, is
  // part of the thing being photographed. Deleting these is what put a hole
  // through the sole of every white shoe in the wardrobe.
  const W = 90, H = 90;
  const data = frame(W, H, [250, 250, 250]);
  paint(data, W, 26, 26, 63, 63, [70, 90, 60]);
  paint(data, W, 34, 34, 55, 55, [250, 250, 250]);

  const mask = floodBackground(data, W, H);
  assert.equal(mask[30 * W + 30], 0, "the ring is garment");
  assert.equal(mask[44 * W + 44], 0, "and so is the panel inside it");
});
