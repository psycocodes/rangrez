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
  { name: "Oversized Poplin Shirt", zone: "top", dye: DYES.ecru, season: "yearround", material: "Cotton poplin, 120gsm", worn: 14 },
  { name: "Khadi Camp Collar", zone: "top", dye: DYES.indigo, season: "summer", material: "Handloom khadi", worn: 9 },
  { name: "Ribbed Merino Tank", zone: "top", dye: DYES.iron, season: "yearround", material: "Merino rib, 18.5µ", worn: 21 },
  { name: "Boxy Heavyweight Tee", zone: "top", dye: DYES.madder, season: "summer", material: "Loopwheel cotton, 240gsm", worn: 32 },
  { name: "Silk Wrap Blouse", zone: "top", dye: DYES.lac, season: "spring", material: "Sandwashed silk", worn: 4 },
  { name: "Cable Knit Crewneck", zone: "top", dye: DYES.myrobalan, season: "winter", material: "Lambswool, 5gg", worn: 11 },
  { name: "Breton Long-Sleeve", zone: "top", dye: DYES.vat, season: "autumn", material: "Combed cotton jersey", worn: 18 },
  { name: "Indigo Denim Overshirt", zone: "top", dye: DYES.indigo, season: "autumn", material: "Japanese selvedge chambray", worn: 16 },
  { name: "Handspun Linen Kurta", zone: "top", dye: DYES.ecru, season: "summer", material: "Handspun Bengal linen", worn: 8 },
  { name: "Waffle Thermal Crew", zone: "top", dye: DYES.pomegranate, season: "winter", material: "Heavyweight thermal cotton", worn: 25 },
  { name: "Raw Silk Half-Sleeve", zone: "top", dye: DYES.turmeric, season: "spring", material: "Matka raw silk", worn: 7 },
  { name: "Cashmere Rollneck", zone: "top", dye: DYES.catechu, season: "winter", material: "2-ply Mongolian cashmere", worn: 19 },
  { name: "Relaxed Polo Shirt", zone: "top", dye: DYES.verdigris, season: "summer", material: "Open-knit pima cotton", worn: 13 },
  { name: "Band Collar Poplin", zone: "top", dye: DYES.henna, season: "spring", material: "Washed Egyptian cotton", worn: 10 },

  // ── outerwear ───────────────────────────────────────────────────────────
  { name: "Quilted Bomber", zone: "outerwear", dye: DYES.verdigris, season: "autumn", material: "Diamond-quilted nylon", worn: 10 },
  { name: "Unstructured Linen Blazer", zone: "outerwear", dye: DYES.ecru, season: "spring", material: "Irish linen, unlined", worn: 7 },
  { name: "Cropped Trench", zone: "outerwear", dye: DYES.turmeric, season: "spring", material: "Waxed cotton gabardine", worn: 5 },
  { name: "Shearling Chore Coat", zone: "outerwear", dye: DYES.henna, season: "winter", material: "Suede + shearling lining", worn: 13 },
  { name: "Nehru Collar Jacket", zone: "outerwear", dye: DYES.vat, season: "autumn", material: "Cotton-silk matka", worn: 3 },
  { name: "Waxed Field Jacket", zone: "outerwear", dye: DYES.myrobalan, season: "autumn", material: "8oz British waxed cotton", worn: 22 },
  { name: "Suede Harrington Jacket", zone: "outerwear", dye: DYES.catechu, season: "spring", material: "Goat suede leather", worn: 15 },
  { name: "Wool Duster Coat", zone: "outerwear", dye: DYES.iron, season: "winter", material: "Double-faced melton wool", worn: 8 },
  { name: "Indigo Dyed Noragi", zone: "outerwear", dye: DYES.indigo, season: "yearround", material: "Sashiko stitched cotton", worn: 17 },

  // ── bottoms ─────────────────────────────────────────────────────────────
  { name: "Wide-Leg Pleated Trouser", zone: "bottom", dye: DYES.catechu, season: "autumn", material: "Wool-linen twill", worn: 12 },
  { name: "Raw Denim Straight", zone: "bottom", dye: DYES.indigo, season: "yearround", material: "14oz selvedge, unwashed", worn: 47 },
  { name: "Linen Drawstring Short", zone: "bottom", dye: DYES.ecru, season: "summer", material: "Washed linen", worn: 8 },
  { name: "Bias-Cut Midi Skirt", zone: "bottom", dye: DYES.pomegranate, season: "spring", material: "Cupro satin", worn: 6 },
  { name: "Cargo Utility Pant", zone: "bottom", dye: DYES.myrobalan, season: "yearround", material: "Ripstop cotton", worn: 23 },
  { name: "Tailored Wool Trouser", zone: "bottom", dye: DYES.iron, season: "winter", material: "Super 110s worsted", worn: 15 },
  { name: "Relaxed Corduroy Pant", zone: "bottom", dye: DYES.henna, season: "autumn", material: "8-wale cotton corduroy", worn: 18 },
  { name: "Pleated Chino Trouser", zone: "bottom", dye: DYES.turmeric, season: "spring", material: "High-density cotton twill", worn: 14 },
  { name: "Japanese Selvedge Jeans", zone: "bottom", dye: DYES.vat, season: "yearround", material: "15.5oz dark indigo denim", worn: 39 },
  { name: "Silk Habotai Wide Pant", zone: "bottom", dye: DYES.lac, season: "summer", material: "Washed mulberry silk", worn: 5 },
  { name: "Cotton Fatigue Pant", zone: "bottom", dye: DYES.verdigris, season: "yearround", material: "Reverse sateen cotton", worn: 27 },
  { name: "Drawstring Linen Trouser", zone: "bottom", dye: DYES.ecru, season: "summer", material: "Belgian linen canvas", worn: 11 },

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

const PINK_DYE: Dye = { name: "Pink", hex: "#C6827E" };

export function seedCatalog(userId: string): Garment[] {
  const now = Date.now();
  const day = 86_400_000;

  // Generate 26 Pink Shirt garments for wardrobe showcase
  return Array.from({ length: 26 }).map((_, i) => {
    const zone: Zone = i < 14 ? "top" : i < 20 ? "bottom" : "shoes";
    return {
      id: crypto.randomUUID(),
      userId,
      name: "Pink Shirt",
      origin: "seed",
      zone,
      dye: PINK_DYE,
      season: "yearround",
      material: "Heavyweight loopwheel cotton",
      seed: "pink-shirt",
      imageUrl: "/seed/Pink Shirt.png",
      status: "rendered",
      inPalette: true,
      wornCount: 14 + (i % 7),
      addedAt: new Date(now - (26 - i) * day * 2).toISOString(),
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
