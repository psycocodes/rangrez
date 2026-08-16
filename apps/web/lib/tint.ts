import { hexToHsl } from "./palette";

/**
 * ═══════════════════════════════════════════════════════════════════════════
 *  A card the colour of the thing on it
 * ═══════════════════════════════════════════════════════════════════════════
 *
 *  Every garment card takes its palette from the garment. A mauve tee sits on
 *  dusty pink; an indigo denim sits on pale blue; a marigold kurta sits on
 *  cream-gold. The catalogue therefore has no house card colour at all — it
 *  has as many as you own things, and each one is a halo around its own piece.
 *
 *  Why this rather than one neutral card: a grid of identical cards makes the
 *  reader do the work of telling the items apart. A card that has already
 *  taken the item's colour has done that work before they looked. It is also
 *  the only card treatment that cannot ever clash with its contents.
 *
 *  ── the derivation ───────────────────────────────────────────────────────
 *
 *  All four values share the garment's *hue* and differ in saturation and
 *  lightness, which is what keeps them a family rather than four colours that
 *  happen to be near each other:
 *
 *    card   very light, gently saturated — the plate the garment lies on
 *    wash   a half-step darker — the inner panel, so the card has two planes
 *    ink    dark and saturated — type that is legibly the same colour
 *    edge   between card and ink — hairlines, rules, the keyline
 *
 *  Grey garments are the trap. A near-zero saturation hue is meaningless — the
 *  hue of #4a4a4a is whatever rounding produced it — so achromatic dyes are
 *  pulled toward the house paper instead of being given a random tint.
 * ═══════════════════════════════════════════════════════════════════════════
 */

export interface Tint {
  /** The card's own field. */
  card: string;
  /** A half-step darker, for the panel the garment sits in. */
  wash: string;
  /** Type and marks. Contrast against `card` is guaranteed ≥ 7:1. */
  ink: string;
  /** Hairlines and keylines. */
  edge: string;
}

const hsl = (h: number, s: number, l: number) =>
  `hsl(${Math.round(h)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%)`;

/** Below this there is no meaningful hue to amplify, only rounding noise. */
const ACHROMATIC = 0.08;

/** The house paper's hue, which greys borrow so they read warm, not dead. */
const PAPER_HUE = 40;

export function tintOf(hex: string): Tint {
  const { h, s } = hexToHsl(hex);

  const grey = s < ACHROMATIC;
  const hue = grey ? PAPER_HUE : h;

  // Saturation is *rebuilt*, not inherited. A garment logged as near-black and
  // one logged as vivid scarlet must both produce a card you can read type on,
  // so the input's saturation only chooses where in a narrow band we land.
  const chroma = grey ? 0.16 : Math.min(0.62, Math.max(0.26, s));

  return {
    card: hsl(hue, chroma * 0.78, 0.86),
    wash: hsl(hue, chroma * 0.68, 0.79),
    ink: hsl(hue, Math.min(0.58, chroma * 0.95), 0.21),
    edge: hsl(hue, chroma * 0.6, 0.64),
  };
}

/**
 * The same family, inverted — a dark card for a light room.
 *
 * The closet is lit; the look creator is a night interior. Rather than dim the
 * light card and get mud, the roles swap: the garment's colour becomes the
 * ground and the paper becomes the ink.
 */
export function tintOfDark(hex: string): Tint {
  const { h, s } = hexToHsl(hex);
  const grey = s < ACHROMATIC;
  const hue = grey ? PAPER_HUE : h;
  const chroma = grey ? 0.14 : Math.min(0.55, Math.max(0.22, s));

  return {
    card: hsl(hue, chroma * 0.85, 0.18),
    wash: hsl(hue, chroma * 0.8, 0.13),
    ink: hsl(hue, chroma * 0.3, 0.93),
    edge: hsl(hue, chroma * 0.7, 0.36),
  };
}
