import { garmentArt } from "./garment-art";
import { hexToHsl } from "./palette";
import type { Dye, Garment, SeasonTag, Zone } from "./types";

/**
 * Starter wardrobe.
 *
 * Every piece is drawn — a flat-lay of the garment it claims to be, in its own
 * catalogued dye (see lib/garment-art.ts). That replaced deterministic stock
 * photography, which was coherent enough as grid texture but put a typewriter
 * on a card reading "Raw Denim Straight". Replace `imageUrl` with the Apparel
 * VTO result URL once a piece has actually been rendered onto a body.
 */

export const DYES = {
  indigo: { name: "Indigo", hex: "#26356E" },
  vat: { name: "Vat Blue", hex: "#161D3D" },
  paleIndigo: { name: "Pale Indigo", hex: "#6C7FB8" },
  madder: { name: "Madder", hex: "#B03A21" },
  turmeric: { name: "Turmeric", hex: "#D99B21" },
  pomegranate: { name: "Pomegranate", hex: "#7C2D3A" },
  myrobalan: { name: "Myrobalan", hex: "#8A8A52" },
  catechu: { name: "Catechu", hex: "#6E4326" },
  henna: { name: "Henna", hex: "#8E4B2E" },
  iron: { name: "Iron Black", hex: "#1F1D1A" },
  ecru: { name: "Ecru", hex: "#CFC3AA" },
  verdigris: { name: "Verdigris", hex: "#2E6B5E" },
  lac: { name: "Lac Rose", hex: "#B5607E" },
} as const satisfies Record<string, Dye>;

/**
 * Names an arbitrary colour as one of the house dyes.
 *
 * A garment digitised off a shop page arrives with a measured average colour,
 * not a dye name. Rather than storing `#7B3F2A` and printing a hex on the
 * card — which would break the language of the catalog — we snap it to the
 * nearest dye on the card. Distance is weighted toward hue: an off-black and a
 * navy differ far more meaningfully than two navies of different lightness.
 */
export function nearestDye(hex: string): Dye {
  const target = hexToHsl(hex);
  let best: Dye = DYES.iron;
  let bestScore = Infinity;

  for (const dye of Object.values(DYES) as Dye[]) {
    const d = hexToHsl(dye.hex);
    // Hue is circular; a 350° and a 10° red are 20° apart, not 340°.
    const hueGap = Math.min(Math.abs(d.h - target.h), 360 - Math.abs(d.h - target.h));
    // Hue barely matters on greys, so fade its weight out with saturation.
    const chroma = Math.min(d.s, target.s);
    const score =
      (hueGap / 180) * 1.6 * chroma +
      Math.abs(d.s - target.s) * 0.7 +
      Math.abs(d.l - target.l) * 1.1;

    if (score < bestScore) {
      bestScore = score;
      best = dye;
    }
  }

  return best;
}

interface SeedItem {
  name: string;
  zone: Zone;
  dye: Dye;
  season: SeasonTag;
  material: string;
  worn: number;
}

const ITEMS: SeedItem[] = [
  // ── tops ────────────────────────────────────────────────────────────────
  { name: "Oversized Poplin Shirt", zone: "top", dye: DYES.ecru, season: "yearround", material: "Cotton poplin, 120gsm", worn: 14 },
  { name: "Khadi Camp Collar", zone: "top", dye: DYES.indigo, season: "summer", material: "Handloom khadi", worn: 9 },
  { name: "Ribbed Merino Tank", zone: "top", dye: DYES.iron, season: "yearround", material: "Merino rib, 18.5µ", worn: 21 },
  { name: "Boxy Heavyweight Tee", zone: "top", dye: DYES.madder, season: "summer", material: "Loopwheel cotton, 240gsm", worn: 32 },
  { name: "Silk Wrap Blouse", zone: "top", dye: DYES.lac, season: "spring", material: "Sandwashed silk", worn: 4 },
  { name: "Cable Knit Crewneck", zone: "top", dye: DYES.myrobalan, season: "winter", material: "Lambswool, 5gg", worn: 11 },
  { name: "Breton Long-Sleeve", zone: "top", dye: DYES.vat, season: "autumn", material: "Combed cotton jersey", worn: 18 },

  // ── bottoms ─────────────────────────────────────────────────────────────
  { name: "Wide-Leg Pleated Trouser", zone: "bottom", dye: DYES.catechu, season: "autumn", material: "Wool-linen twill", worn: 12 },
  { name: "Raw Denim Straight", zone: "bottom", dye: DYES.indigo, season: "yearround", material: "14oz selvedge, unwashed", worn: 47 },
  { name: "Linen Drawstring Short", zone: "bottom", dye: DYES.ecru, season: "summer", material: "Washed linen", worn: 8 },
  { name: "Bias-Cut Midi Skirt", zone: "bottom", dye: DYES.pomegranate, season: "spring", material: "Cupro satin", worn: 6 },
  { name: "Cargo Utility Pant", zone: "bottom", dye: DYES.myrobalan, season: "yearround", material: "Ripstop cotton", worn: 23 },
  { name: "Tailored Wool Trouser", zone: "bottom", dye: DYES.iron, season: "winter", material: "Super 110s worsted", worn: 15 },

  // ── outerwear ───────────────────────────────────────────────────────────
  { name: "Quilted Bomber", zone: "outerwear", dye: DYES.verdigris, season: "autumn", material: "Diamond-quilted nylon", worn: 10 },
  { name: "Unstructured Linen Blazer", zone: "outerwear", dye: DYES.ecru, season: "spring", material: "Irish linen, unlined", worn: 7 },
  { name: "Cropped Trench", zone: "outerwear", dye: DYES.turmeric, season: "spring", material: "Waxed cotton gabardine", worn: 5 },
  { name: "Shearling Chore Coat", zone: "outerwear", dye: DYES.henna, season: "winter", material: "Suede + shearling lining", worn: 13 },
  { name: "Nehru Collar Jacket", zone: "outerwear", dye: DYES.vat, season: "autumn", material: "Cotton-silk matka", worn: 3 },

  // ── shoes ───────────────────────────────────────────────────────────────
  { name: "Leather Derby", zone: "shoes", dye: DYES.catechu, season: "yearround", material: "Vegetable-tanned calf", worn: 29 },
  { name: "Canvas Low-Top", zone: "shoes", dye: DYES.ecru, season: "summer", material: "Cotton canvas, gum sole", worn: 41 },
  { name: "Suede Chelsea Boot", zone: "shoes", dye: DYES.iron, season: "winter", material: "Calf suede", worn: 19 },
  { name: "Woven Slide", zone: "shoes", dye: DYES.henna, season: "summer", material: "Hand-woven leather", worn: 16 },

  // ── accessories ─────────────────────────────────────────────────────────
  { name: "Ajrakh Silk Scarf", zone: "accessory", dye: DYES.madder, season: "yearround", material: "Block-printed mulberry silk", worn: 22 },
  { name: "Woven Leather Belt", zone: "accessory", dye: DYES.catechu, season: "yearround", material: "Braided bridle leather", worn: 35 },
  { name: "Wire-Frame Sunglasses", zone: "accessory", dye: DYES.turmeric, season: "summer", material: "Titanium, G15 lens", worn: 26 },
  { name: "Structured Tote", zone: "accessory", dye: DYES.pomegranate, season: "yearround", material: "Saddle leather", worn: 30 },
];

const slug = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

/**
 * Still exported for the editorial furniture that wants a photograph rather
 * than a garment — the grid interstitials. Starter *pieces* are drawn now.
 */
export function placeholderPhoto(seed: string, w = 900, h = 1200) {
  return `https://picsum.photos/seed/rangrez-${seed}/${w}/${h}`;
}

export function seedCatalog(userId: string): Garment[] {
  const now = Date.now();
  const day = 86_400_000;

  return ITEMS.map((item, i) => {
    const seed = slug(item.name);
    return {
      // Must be a real UUID: the garments table types `id` as uuid. A readable
      // synthetic id ("seed-0c50c0fd-00") was rejected by Postgres, which took
      // sign-up down with it — the user row landed and the wardrobe didn't.
      id: crypto.randomUUID(),
      userId,
      name: item.name,
      origin: "seed",
      zone: item.zone,
      dye: item.dye,
      season: item.season,
      material: item.material,
      seed,
      // Drawn, not photographed: a card labelled "Raw Denim Straight" showing a
      // stock photo of a typewriter was fine as grid texture and embarrassing
      // the moment those cards were dealt onto the look creator's wheels.
      imageUrl: garmentArt(item.name, item.zone, item.dye),
      status: "rendered",
      // Recomputed against the real colour season the moment the avatar's
      // skin-tone analysis returns — see app/api/avatar/route.ts.
      inPalette: i % 3 !== 1,
      wornCount: item.worn,
      addedAt: new Date(now - (ITEMS.length - i) * day * 3.5).toISOString(),
    } satisfies Garment;
  });
}

/** Editorial cards woven into the grid so it never reads as a plain catalog. */
export const GRID_INTERSTITIALS = [
  {
    kicker: "Note from the dye house",
    line: "A wardrobe is not a list. It is a set of things that already agree with each other.",
    tone: "vat" as const,
  },
  {
    kicker: "On consistency",
    line: "One body. One light. Every garment you own, rendered in the same room.",
    tone: "madder" as const,
  },
  {
    kicker: "Method",
    line: "Photograph it once. Wear it a hundred times, in a hundred combinations, before you leave the house.",
    tone: "turmeric" as const,
  },
];
