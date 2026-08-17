import { DYES, nearestDye } from "./dyes";
import { garmentArt } from "./garment-art";
import { SEED_PHOTOS } from "./seed-photos";
import type { Dye, Garment, SeasonTag, Zone } from "./types";

// Both used to live here, and half the app imports them from here. Re-exported
// rather than chased through twenty files.
export { DYES, nearestDye };

/**
 * Starter wardrobe.
 *
 * Every piece is a real photograph, cut out of a real product shot by the same
 * pipeline a shop page goes through — see scripts/seed-photos.mjs, which
 * fetches them, and lib/seed-photos.ts, which it writes.
 *
 * It used to be drawn: SVG flat-lays in each item's catalogued dye. That was
 * right when the alternative was deterministic stock photography, which was
 * coherent as grid texture and put a typewriter on a card reading "Raw Denim
 * Straight". It became wrong the moment you wanted to *try one on* — Apparel
 * VTO cannot decode a drawing, so every starter piece was a piece the whole
 * point of the product couldn't be tested with. The drawings remain as the
 * fallback for any item without a photograph yet.
 */

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
  { name: "Poplin Shirt", zone: "top", dye: DYES.ecru, season: "yearround", material: "Cotton poplin, 120gsm", worn: 14 },
  { name: "Camp Collar", zone: "top", dye: DYES.indigo, season: "summer", material: "Handloom khadi", worn: 9 },
  { name: "Merino Tank", zone: "top", dye: DYES.iron, season: "yearround", material: "Merino rib, 18.5µ", worn: 21 },
  { name: "Heavy Tee", zone: "top", dye: DYES.madder, season: "summer", material: "Loopwheel cotton, 240gsm", worn: 32 },
  { name: "Silk Blouse", zone: "top", dye: DYES.lac, season: "spring", material: "Sandwashed silk", worn: 4 },
  { name: "Cable Knit", zone: "top", dye: DYES.myrobalan, season: "winter", material: "Lambswool, 5gg", worn: 11 },
  { name: "Breton Top", zone: "top", dye: DYES.vat, season: "autumn", material: "Combed cotton jersey", worn: 18 },
  { name: "Overshirt", zone: "top", dye: DYES.indigo, season: "autumn", material: "Japanese selvedge chambray", worn: 16 },
  { name: "Linen Kurta", zone: "top", dye: DYES.ecru, season: "summer", material: "Handspun Bengal linen", worn: 8 },
  { name: "Thermal Crew", zone: "top", dye: DYES.pomegranate, season: "winter", material: "Heavyweight thermal cotton", worn: 25 },
  { name: "Silk Shirt", zone: "top", dye: DYES.turmeric, season: "spring", material: "Matka raw silk", worn: 7 },
  { name: "Rollneck", zone: "top", dye: DYES.catechu, season: "winter", material: "2-ply Mongolian cashmere", worn: 19 },
  { name: "Polo Shirt", zone: "top", dye: DYES.verdigris, season: "summer", material: "Open-knit pima cotton", worn: 13 },
  { name: "Band Collar", zone: "top", dye: DYES.henna, season: "spring", material: "Washed Egyptian cotton", worn: 10 },

  // ── outerwear ───────────────────────────────────────────────────────────
  { name: "Bomber", zone: "outerwear", dye: DYES.verdigris, season: "autumn", material: "Diamond-quilted nylon", worn: 10 },
  { name: "Linen Blazer", zone: "outerwear", dye: DYES.ecru, season: "spring", material: "Irish linen, unlined", worn: 7 },
  { name: "Trench Coat", zone: "outerwear", dye: DYES.turmeric, season: "spring", material: "Waxed cotton gabardine", worn: 5 },
  { name: "Chore Coat", zone: "outerwear", dye: DYES.henna, season: "winter", material: "Suede + shearling lining", worn: 13 },
  { name: "Nehru Coat", zone: "outerwear", dye: DYES.vat, season: "autumn", material: "Cotton-silk matka", worn: 3 },
  { name: "Field Jacket", zone: "outerwear", dye: DYES.myrobalan, season: "autumn", material: "8oz British waxed cotton", worn: 22 },
  { name: "Harrington", zone: "outerwear", dye: DYES.catechu, season: "spring", material: "Goat suede leather", worn: 15 },
  { name: "Duster Coat", zone: "outerwear", dye: DYES.iron, season: "winter", material: "Double-faced melton wool", worn: 8 },
  { name: "Noragi", zone: "outerwear", dye: DYES.indigo, season: "yearround", material: "Sashiko stitched cotton", worn: 17 },

  // ── bottoms ─────────────────────────────────────────────────────────────
  { name: "Pleat Pant", zone: "bottom", dye: DYES.catechu, season: "autumn", material: "Wool-linen twill", worn: 12 },
  { name: "Raw Denim", zone: "bottom", dye: DYES.indigo, season: "yearround", material: "14oz selvedge, unwashed", worn: 47 },
  { name: "Linen Short", zone: "bottom", dye: DYES.ecru, season: "summer", material: "Washed linen", worn: 8 },
  { name: "Midi Skirt", zone: "bottom", dye: DYES.pomegranate, season: "spring", material: "Cupro satin", worn: 6 },
  { name: "Cargo Pant", zone: "bottom", dye: DYES.myrobalan, season: "yearround", material: "Ripstop cotton", worn: 23 },
  { name: "Wool Trouser", zone: "bottom", dye: DYES.iron, season: "winter", material: "Super 110s worsted", worn: 15 },
  { name: "Corduroy", zone: "bottom", dye: DYES.henna, season: "autumn", material: "8-wale cotton corduroy", worn: 18 },
  { name: "Chino Pant", zone: "bottom", dye: DYES.turmeric, season: "spring", material: "High-density cotton twill", worn: 14 },
  { name: "Selvedge", zone: "bottom", dye: DYES.vat, season: "yearround", material: "15.5oz dark indigo denim", worn: 39 },
  { name: "Silk Pant", zone: "bottom", dye: DYES.lac, season: "summer", material: "Washed mulberry silk", worn: 5 },
  { name: "Fatigue Pant", zone: "bottom", dye: DYES.verdigris, season: "yearround", material: "Reverse sateen cotton", worn: 27 },
  { name: "Linen Pant", zone: "bottom", dye: DYES.ecru, season: "summer", material: "Belgian linen canvas", worn: 11 },

  // ── shoes ───────────────────────────────────────────────────────────────
  { name: "Derby Shoe", zone: "shoes", dye: DYES.catechu, season: "yearround", material: "Vegetable-tanned calf", worn: 29 },
  { name: "Low-Top", zone: "shoes", dye: DYES.ecru, season: "summer", material: "Cotton canvas, gum sole", worn: 41 },
  { name: "Chelsea Boot", zone: "shoes", dye: DYES.iron, season: "winter", material: "Calf suede", worn: 19 },
  { name: "Slide", zone: "shoes", dye: DYES.henna, season: "summer", material: "Hand-woven leather", worn: 16 },

  // ── accessories ─────────────────────────────────────────────────────────
  { name: "Silk Scarf", zone: "accessory", dye: DYES.madder, season: "yearround", material: "Block-printed mulberry silk", worn: 22 },
  { name: "Leather Belt", zone: "accessory", dye: DYES.catechu, season: "yearround", material: "Braided bridle leather", worn: 35 },
  { name: "Sunglasses", zone: "accessory", dye: DYES.turmeric, season: "summer", material: "Titanium, G15 lens", worn: 26 },
  { name: "Tote Bag", zone: "accessory", dye: DYES.pomegranate, season: "yearround", material: "Saddle leather", worn: 30 },
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
    const s = slug(item.name);
    const photo = SEED_PHOTOS[s];
    const dye: Dye = photo ? { name: item.dye.name, hex: photo.hex } : item.dye;
    const imageUrl = photo?.file ?? (s === "pink-shirt" ? "/seed/Pink Shirt.png" : garmentArt(item.name, item.zone, dye));

    return {
      id: crypto.randomUUID(),
      userId,
      name: item.name,
      origin: "seed",
      zone: item.zone,
      dye,
      season: item.season,
      material: item.material,
      seed: s,
      imageUrl,
      status: "rendered",
      inPalette: (i % 3) !== 0,
      wornCount: item.worn,
      addedAt: new Date(now - (ITEMS.length - i) * day * 2).toISOString(),
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
