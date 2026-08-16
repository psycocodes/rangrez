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
  /** Small caps and category lines — darker than `edge`, lighter than `ink`. */
  mark: string;
  /** The opposite of the card, for the lettering *behind* the garment. */
  complement: string;
}

const hsl = (h: number, s: number, l: number) =>
  `hsl(${Math.round(h)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%)`;

/** Below this there is no meaningful hue to amplify, only rounding noise. */
const ACHROMATIC = 0.08;

/** The house paper's hue, which greys borrow so they read warm, not dead. */
const PAPER_HUE = 40;

/**
 * How far round the wheel the background lettering sits from its card.
 *
 * Not 180°. A true complement of the reference card — a dusty rose at 3° —
 * is cyan, and the design has deep indigo there; 235° is the rotation the
 * design actually uses, and it is the better rule besides. A straight 180°
 * sends every warm garment (the bulk of a wardrobe: rose, madder, henna,
 * turmeric) into the 180–240° band's *near* edge, so a rack of warm clothes
 * gets one blue-green note repeated behind all of it. Swinging further round
 * spreads them: rose lands on indigo, madder on violet, turmeric on purple.
 *
 * It also never lands anywhere bilious. The band that reads as sickly at this
 * weight and depth is yellow-green, 60–160°, which only cool inputs of
 * 185–285° reach — and those are indigos and slates, whose deep olive is a
 * pairing the dye house already owns.
 */
const OPPOSITE = 235;

export function tintOf(hex: string): Tint {
  const { h, s } = hexToHsl(hex);

  const grey = s < ACHROMATIC;
  const hue = grey ? PAPER_HUE : h;

  // Saturation is rebuilt rather than inherited — a garment logged as
  // near-black and one logged as vivid scarlet must both produce a card you
  // can read type on — but the band is wide enough for the difference between
  // them to survive. It used to top out at 0.62 and, with the dye snapped to
  // one of thirteen house colours before it ever arrived here, a royal blue
  // tee and a navy trouser came out on the same card. The ceiling is now high
  // enough that a vivid piece reads vivid; the pastel comes from lightness.
  const chroma = grey ? 0.18 : Math.min(0.92, Math.max(0.3, s));

  return {
    // Measured off the reference card: the field is hsl(3 60% 74%) and the
    // panel inside it hsl(3 48% 81%) — the panel *lighter* and *less*
    // saturated, which is the pair of steps that makes it read as a mount
    // rather than a hole. Both were the wrong way round here before.
    card: hsl(hue, chroma * 0.62, 0.81),
    wash: hsl(hue, chroma * 0.78, 0.74),
    ink: hsl(hue, Math.min(0.58, chroma * 0.8), 0.21),
    edge: hsl(hue, chroma * 0.55, 0.62),
    mark: hsl(hue, chroma * 0.42, 0.46),
    // Deep and saturated whatever the card is: this is printing ink, and the
    // pastel has to come from the 60% it is laid down at, not from the colour
    // itself. Mixed pale instead, the lettering greys out against the panel
    // and the fingerprint whorls — the entire point of the face — disappear.
    complement: hsl((hue + OPPOSITE) % 360, Math.min(0.75, Math.max(0.5, chroma * 0.9)), 0.27),
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
  const chroma = grey ? 0.16 : Math.min(0.85, Math.max(0.26, s));

  return {
    card: hsl(hue, chroma * 0.85, 0.18),
    wash: hsl(hue, chroma * 0.8, 0.13),
    ink: hsl(hue, chroma * 0.3, 0.93),
    edge: hsl(hue, chroma * 0.7, 0.36),
    mark: hsl(hue, chroma * 0.5, 0.62),
    // Inverted along with the rest: pale ink for a dark ground.
    complement: hsl((hue + OPPOSITE) % 360, Math.min(0.6, Math.max(0.4, chroma)), 0.74),
  };
}
