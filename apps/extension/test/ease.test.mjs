import test from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

/**
 * The two curves the hands of cards move on.
 *
 * Both are GSAP's, and the reason they are written out rather than imported is
 * that GSAP is not a dependency here. That makes them ours to be right about,
 * which is what these check — including the one place a curve is *approximated*
 * rather than reproduced: `back.out(1.4)` is handed to CSS as a cubic-bezier,
 * and those four magic numbers are only defensible if something measures them
 * against the function they came from.
 */

const here = dirname(fileURLToPath(import.meta.url));
const { elasticOut, backOut } = await import(resolve(here, "../../web/lib/ease.ts"));

/** A CSS cubic-bezier(x1,y1,x2,y2) evaluated at x, by bisection on t. */
function bezier(x1, y1, x2, y2, x) {
  const at = (a, b, t) =>
    3 * a * (1 - t) ** 2 * t + 3 * b * (1 - t) * t ** 2 + t ** 3;
  let lo = 0;
  let hi = 1;
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    if (at(x1, x2, mid) < x) lo = mid;
    else hi = mid;
  }
  return at(y1, y2, (lo + hi) / 2);
}

test("both curves start at 0 and land on 1", () => {
  for (const fn of [elasticOut, backOut]) {
    assert.equal(fn(0), 0);
    assert.ok(Math.abs(fn(1) - 1) < 1e-6, `${fn.name} ends on 1`);
  }
});

test("the elastic overshoots and rings down", () => {
  const samples = Array.from({ length: 201 }, (_, i) => elasticOut(i / 200));

  // It passes its target early — that is what makes it read as a bounce
  // rather than as an ease — and then crosses back over it.
  //
  // Where it crosses is the phase constant, and the phase constant is the one
  // number in the file that was derived rather than copied: GSAP puts it at
  // `period / 2π · asin(1/amplitude)`, which at amplitude 1 and period 0.8 is
  // 0.2. That places the crossings at 0.2, 0.6 and 1.0 — a period of 0.8, so
  // one and a quarter oscillations over the animation. Get the constant wrong
  // and they slide, which is exactly what this pins.
  const crossings = samples.reduce(
    (out, v, i) => (i && v > 1 !== samples[i - 1] > 1 ? [...out, i / 200] : out),
    [],
  );
  assert.equal(crossings.length, 2, `two crossings, got ${crossings.length}`);
  assert.ok(Math.abs(crossings[0] - 0.2) < 0.01, `first at ${crossings[0]}`);
  assert.ok(Math.abs(crossings[1] - 0.6) < 0.01, `second at ${crossings[1]}`);

  // And the ring decays: nothing late is as far off as something early.
  const swing = (from, to) =>
    Math.max(...samples.slice(from, to).map((v) => Math.abs(v - 1)));
  assert.ok(swing(140, 200) < swing(20, 80) * 0.25, "decays");
});

test("back.out(1.4) overshoots once, by about a tenth", () => {
  const peak = Math.max(
    ...Array.from({ length: 201 }, (_, i) => backOut(i / 200)),
  );
  assert.ok(peak > 1.05 && peak < 1.15, `peaks at ${peak.toFixed(3)}`);
});

test("the cubic-bezier the CSS uses really is back.out(1.4)", () => {
  // components/LookCreator.tsx hands this to `transition-timing-function`
  // because a bezier is the accelerated path and a sampled ramp is not. If
  // the two ever drift apart, the push stops being the curve it claims to be.
  let worst = 0;
  for (let i = 0; i <= 100; i++) {
    const x = i / 100;
    worst = Math.max(worst, Math.abs(bezier(0.34, 1.46, 0.64, 1, x) - backOut(x)));
  }
  assert.ok(worst < 0.035, `matches within ${worst.toFixed(4)}`);
});
