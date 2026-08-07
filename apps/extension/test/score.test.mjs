/**
 * Candidate scoring, on synthetic pixels.
 *
 *   node apps/extension/test/score.test.mjs
 *
 * The case that mattered: a Myntra gallery whose second image is a macro of
 * the fabric weave. It used to beat the model shot outright — a flat crop has
 * no border deviation (perfect "backdrop") and no skin (perfect "not a model
 * shot") — and the try-on came back looking like a swatch. These tests pin
 * that ordering down.
 */

import { scorePixels } from "../src/lib/score.js";

const W = 96;
const H = 120;

/** Builds an RGBA buffer from a per-pixel colour function. */
function make(fn) {
  const data = new Uint8ClampedArray(W * H * 4);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const [r, g, b] = fn(x, y);
      const i = (y * W + x) * 4;
      data[i] = r;
      data[i + 1] = g;
      data[i + 2] = b;
      data[i + 3] = 255;
    }
  }
  return data;
}

/** Deterministic jitter, so runs are repeatable. */
const noise = (x, y, amp) => (((x * 7919 + y * 104729) % 17) - 8) * (amp / 8);

/* ── the candidates ─────────────────────────────────────────────────────── */

// The trap: a close-up of blue jersey. Uniform colour, fine weave texture.
const fabricMacro = make((x, y) => {
  const weave = (x % 3 === 0 || y % 3 === 0) ? 6 : 0;
  return [104 + weave + noise(x, y, 3), 134 + weave + noise(x, y, 3), 198 + weave + noise(x, y, 3)];
});

// A model wearing the tee against a pale studio wall: head, skin, torso block.
const modelShot = make((x, y) => {
  const bg = [232, 234, 230];
  const cx = W / 2;
  const head = (x - cx) ** 2 + (y - 20) ** 2 < 12 ** 2;
  const torso = y > 34 && y < 86 && Math.abs(x - cx) < 26;
  const legs = y >= 86 && Math.abs(x - cx) < 16;
  if (head) return [198, 156, 124];           // skin
  if (torso) return [104, 134, 198];          // the blue tee
  if (legs) return [122, 122, 126];           // grey shorts
  return bg;
});

// A flat lay of the same tee on seamless white — no person.
const flatLay = make((x, y) => {
  const cx = W / 2;
  const body = y > 26 && y < 96 && Math.abs(x - cx) < 30;
  const sleeveL = y > 30 && y < 52 && x > cx - 42 && x <= cx - 30;
  const sleeveR = y > 30 && y < 52 && x >= cx + 30 && x < cx + 42;
  if (body || sleeveL || sleeveR) return [104, 134, 198];
  return [246, 246, 244];
});

// A detail crop of the chest logo: mostly fabric, one small mark.
const logoCrop = make((x, y) => {
  const mark = Math.abs(x - W / 2) < 7 && Math.abs(y - H / 2) < 7;
  if (mark) return [250, 250, 250];
  return [104 + noise(x, y, 2), 134 + noise(x, y, 2), 198 + noise(x, y, 2)];
});

const natural = { w: 900, h: 1125 };
const score = (data) => scorePixels(data, W, H, natural);

const results = {
  "fabric macro": score(fabricMacro),
  "logo crop": score(logoCrop),
  "model shot": score(modelShot),
  "flat lay": score(flatLay),
};

let pass = 0;
let fail = 0;
const check = (label, ok, detail = "") => {
  ok ? pass++ : fail++;
  console.log(`${ok ? "  ok  " : "  FAIL"}  ${label}${ok ? "" : `  ${detail}`}`);
};

console.log("\nscores");
for (const [name, r] of Object.entries(results)) {
  console.log(
    `  ${name.padEnd(14)} ${r.score.toFixed(3)}  ` +
      `structure=${r.metrics.structure} coverage=${r.metrics.coverage} ` +
      `skin=${r.metrics.skinFraction} swatch=${r.metrics.swatch}`,
  );
}

console.log("\nordering");
check(
  "model shot beats the fabric macro",
  results["model shot"].score > results["fabric macro"].score,
  `${results["model shot"].score.toFixed(3)} vs ${results["fabric macro"].score.toFixed(3)}`,
);
check(
  "flat lay beats the fabric macro",
  results["flat lay"].score > results["fabric macro"].score,
  `${results["flat lay"].score.toFixed(3)} vs ${results["fabric macro"].score.toFixed(3)}`,
);
check(
  "model shot beats the logo crop",
  results["model shot"].score > results["logo crop"].score,
  `${results["model shot"].score.toFixed(3)} vs ${results["logo crop"].score.toFixed(3)}`,
);
check(
  "a flat lay still edges out a model shot",
  results["flat lay"].score >= results["model shot"].score,
  `${results["flat lay"].score.toFixed(3)} vs ${results["model shot"].score.toFixed(3)}`,
);

console.log("\nflags");
check("fabric macro is flagged a swatch", results["fabric macro"].metrics.swatch === true);
check("logo crop is flagged a swatch", results["logo crop"].metrics.swatch === true);
check("model shot is not a swatch", results["model shot"].metrics.swatch === false);
check("flat lay is not a swatch", results["flat lay"].metrics.swatch === false);
check(
  "model shot registers skin",
  results["model shot"].metrics.skinFraction > 0.01,
  `skin=${results["model shot"].metrics.skinFraction}`,
);
check(
  "flat lay registers no skin",
  results["flat lay"].metrics.skinFraction < 0.01,
);

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
