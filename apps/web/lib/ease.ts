/**
 * ═══════════════════════════════════════════════════════════════════════════
 *  Two eases, and a way to hand them to CSS
 * ═══════════════════════════════════════════════════════════════════════════
 *
 *  Both are GSAP's, reimplemented from their own formulae. The look creator's
 *  hands of cards are a port of React Bits' BounceCards, which animates with
 *  GSAP; rather than add a second animation runtime to the bundle for one
 *  component, the two curves it actually depends on are written out here and
 *  sampled into CSS.
 * ═══════════════════════════════════════════════════════════════════════════
 */

/**
 * `elastic.out(1, 0.8)` — the deal.
 *
 * GSAP builds this from an amplitude and a period: at amplitude 1 the leading
 * coefficient is 1 and the phase shift is `period / 2π · asin(1/a)`, which for
 * a period of 0.8 comes to exactly 0.2. It reaches its target about a third of
 * the way through and rings down from there.
 */
export const elasticOut = (t: number): number =>
  t === 0 || t === 1
    ? t
    : Math.pow(2, -10 * t) * Math.sin(((t - 0.2) * Math.PI * 2) / 0.8) + 1;

/**
 * `back.out(1.4)` — the push. Overshoots and comes back.
 *
 * Kept as the definition, but not sampled: unlike the elastic it *is* a cubic,
 * so CSS can state it exactly as `cubic-bezier(0.34, 1.46, 0.64, 1)` and that
 * is what the components use. A bezier is the accelerated path for a
 * transition; a sampled ramp is not, and the push runs on every hover.
 */
export const backOut = (t: number): number => {
  const s = 1.4;
  const u = t - 1;
  return 1 + (s + 1) * u * u * u + s * u * u;
};

/**
 * An easing function as a CSS `linear()` ramp.
 *
 * `cubic-bezier` cannot describe a curve that crosses its target more than
 * once, so an elastic ring is out of its reach entirely; `linear()` takes as
 * many stops as you give it and interpolates between them. Sixty is far more
 * than the eye can resolve over a second and still a short string.
 */
export const ramp = (fn: (t: number) => number, steps = 60): string =>
  `linear(${Array.from({ length: steps + 1 }, (_, i) => {
    const t = i / steps;
    return `${fn(t).toFixed(4)} ${(t * 100).toFixed(2)}%`;
  }).join(",")})`;
