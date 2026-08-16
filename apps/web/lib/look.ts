import type { Garment, SlotId, Zone } from "./types";
import type { VtoTarget } from "./youcam";

/**
 * ═══════════════════════════════════════════════════════════════════════════
 *  A look: four layers on one body
 * ═══════════════════════════════════════════════════════════════════════════
 *
 *  YouCam's Apparel VTO dresses one garment at a time — src, ref, category.
 *  There is no "here is an outfit" call. So a look is built by *chaining*: the
 *  avatar gets the shirt, the result of that gets the trousers, the result of
 *  that gets the shoes, and so on. Each render is the next render's body.
 *
 *  Which means the order below is not cosmetic. Outerwear goes on last for the
 *  same reason you put a jacket on last, and doing it first would put a shirt
 *  over the jacket. `order` is the sequence the chain runs in; the slot rail in
 *  the UI is laid out by how a person thinks about an outfit, which is not the
 *  same thing.
 * ═══════════════════════════════════════════════════════════════════════════
 */

export interface Slot {
  id: SlotId;
  label: string;
  /** Placeholder line in an empty slot. */
  hint: string;
  /** The YouCam surface this layer renders through. */
  target: VtoTarget;
  /** Wardrobe rails whose pieces may be dropped here. */
  zones: Zone[];
  /** Position in the render chain. Lower goes on the body first. */
  order: number;
}

export const SLOTS: Slot[] = [
  {
    id: "torso",
    label: "Top",
    hint: "Shirt, tee, kurta",
    target: "upper_body",
    zones: ["top"],
    order: 0,
  },
  {
    id: "bottom",
    label: "Bottom",
    hint: "Trousers, skirt",
    target: "lower_body",
    zones: ["bottom"],
    order: 1,
  },
  {
    id: "shoes",
    label: "Shoes",
    hint: "Anything with a sole",
    target: "shoes",
    zones: ["shoes"],
    order: 2,
  },
  {
    id: "layer",
    label: "Layer",
    hint: "Jacket, coat, overshirt",
    target: "upper_body",
    zones: ["outerwear"],
    // Last on purpose: it is worn over everything chosen above it.
    order: 3,
  },
];

export const SLOT_BY_ID: Record<SlotId, Slot> = Object.fromEntries(
  SLOTS.map((s) => [s.id, s]),
) as Record<SlotId, Slot>;

/** Which slot a piece belongs in, or null if it isn't part of an outfit. */
export function slotFor(garment: Garment): SlotId | null {
  return SLOTS.find((s) => s.zones.includes(garment.zone))?.id ?? null;
}

/** What the engine is asked for, in one call. */
export interface LookStep {
  /** Slots this call satisfies. All of them, when the outfit goes on at once. */
  slots: SlotId[];
  target: VtoTarget;
  /** The pieces, in body order, to be drawn into one reference sheet. */
  pieces: Array<{ slot: SlotId; garmentId: string }>;
}

/**
 * A selection, as the renders that build it — which is now almost always one.
 *
 * This used to return one step per filled slot and chain them, each render
 * becoming the next render's body. Two bugs came out of that, both reported
 * from the product: the person drifted, because every call regenerates the
 * whole photograph including the face; and a layer replaced the top under it,
 * because `upper_body` means *replace the upper body* and the engine paints in
 * a white shirt where the tee used to be.
 *
 * So the whole outfit goes on in one `full_body` call against a single sheet
 * with every piece drawn on it — see outfitReference in lib/garment-cut.ts.
 * Nothing renders twice, so nothing can drift, and a four-piece fit is one
 * thirty-second render rather than four.
 *
 * A single piece keeps its own category: `upper_body` for a lone shirt is a
 * sharper instruction than `full_body` with one thing on the sheet, and it
 * leaves the rest of what the person is wearing alone.
 */
export function chainOrder(selected: Partial<Record<SlotId, string>>): LookStep[] {
  const chosen = [...SLOTS]
    .sort((a, b) => a.order - b.order)
    .flatMap((slot) => {
      const garmentId = selected[slot.id];
      return garmentId ? [{ slot: slot.id, garmentId, target: slot.target }] : [];
    });

  // Shoes stay their own call. On the sheet they are a small object at the
  // bottom of a lot of clothes, and the engine read a trainer as a pair of
  // slides; asked for on their own with garment_category "shoes" they come out
  // exactly right and leave the figure untouched. Two renders, both of them
  // verified, is a better answer than one render that guesses at footwear.
  const shoes = chosen.filter((p) => p.slot === "shoes");
  const worn = chosen.filter((p) => p.slot !== "shoes");

  const steps: LookStep[] = [];

  if (worn.length) {
    steps.push({
      slots: worn.map((p) => p.slot),
      // One piece keeps its own category — `upper_body` for a lone shirt is a
      // sharper instruction than `full_body` with one thing on the sheet.
      target: worn.length === 1 ? worn[0].target : "full_body",
      pieces: worn.map(({ slot, garmentId }) => ({ slot, garmentId })),
    });
  }

  for (const shoe of shoes) {
    steps.push({
      slots: [shoe.slot],
      target: shoe.target,
      pieces: [{ slot: shoe.slot, garmentId: shoe.garmentId }],
    });
  }

  return steps;
}

/* ── the light in the room ────────────────────────────────────────────────── */

/**
 * The look creator is lit by three colours, and the whole page is the light —
 * not a tinted box with the app's paper around it.
 *
 * They live in `--look-a/b/c`, registered as typed custom properties in
 * globals.css so the browser interpolates them. That is the entire trick: the
 * gradient below never changes, only the three colours feeding it, so the room
 * *drifts* between moods instead of cutting.
 *
 * Kept pale on purpose. This is a dye house at midday, not a nightclub — the
 * body on the pedestal has to stay the brightest thing on screen.
 */
export const LOOK_WASH = [
  // Four dyes, eight layers. Earlier passes used three washes and the room
  // came out as one flat tint — colour needs somewhere to *end* to read as
  // light, so these overlap at different sizes and angles rather than sitting
  // on top of each other.
  //
  // A pool on the floor, as if light bounced up off it. Sat at 104% once,
  // which put most of it below the fold and made the room look like paper.
  "radial-gradient(120% 78% at 50% 100%, var(--look-a), transparent 78%)",
  "radial-gradient(70% 46% at 26% 96%, var(--look-d), transparent 70%)",
  // Two windows, off-axis so the room never reads as symmetrical.
  "radial-gradient(84% 70% at 0% 2%, var(--look-b), transparent 72%)",
  "radial-gradient(74% 64% at 100% 10%, var(--look-c), transparent 70%)",
  // Corners, to stop the field going even.
  "radial-gradient(52% 42% at 92% 92%, var(--look-b), transparent 66%)",
  "radial-gradient(46% 40% at 6% 74%, var(--look-c), transparent 64%)",
  // Daylight through the middle, keeping the body in the brightest part of the
  // frame. Weaker than the dyes, or it bleaches them straight back out.
  "radial-gradient(44% 34% at 50% 34%, rgba(255,255,255,.40), transparent 74%)",
  "linear-gradient(172deg, var(--color-paper), var(--color-paper-3))",
].join(",");

/**
 * Moods the empty room cycles through, so it is alive before you have chosen
 * anything. Each is a dye trio from the app's own vat — the same palette the
 * sign-in panel dips through, which is what keeps this page a different room in
 * the same building rather than a different building.
 */
export type Mood = [string, string, string, string];

export const IDLE_MOODS: Mood[] = [
  ["#26356e94", "#d99b2170", "#b03a2159", "#8a8a5252"], // dusk over the vat
  ["#8a8a5294", "#26356e6b", "#d99b2161", "#7c2d3a4d"], // myrobalan morning
  ["#7c2d3a8a", "#b03a2170", "#26356e59", "#d99b214d"], // pomegranate
  ["#d99b2194", "#8a8a526b", "#7c2d3a59", "#26356e52"], // turmeric noon
  ["#b03a218a", "#7c2d3a6b", "#d99b2161", "#26356e4d"], // madder
];

/**
 * The three lights for a given selection.
 *
 * Dyes arrive as opaque hex from the catalogue; they are pushed to a low alpha
 * here rather than at the point of use, so every caller gets the same restraint
 * and no card can accidentally light the room at full strength.
 */
export function moodFor(dyes: string[], tick: number): Mood {
  if (!dyes.length) return IDLE_MOODS[tick % IDLE_MOODS.length];

  const at = (i: number) => dyes[i % dyes.length];
  return [`${at(0)}a3`, `${at(1)}7a`, `${at(2)}61`, `${at(3)}52`];
}
