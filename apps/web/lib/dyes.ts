import { hexToHsl } from "./palette.ts";
import type { Dye } from "./types";

/**
 * The dye card.
 *
 * Lifted out of lib/seed.ts, which is where it grew up. It moved because it
 * isn't seed data: every garment in the product gets a dye name, whether it
 * came from the starter wardrobe, an upload or a shop page. Keeping it here
 * also lets scripts/seed-photos.mjs name a colour under plain node, which it
 * cannot do from lib/seed.ts — that file reaches for the SVG art generator.
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
 * Names an arbitrary colour as one of the house dyes — and keeps the colour.
 *
 * A garment digitised off a shop page arrives with a measured average colour,
 * not a dye name. Rather than storing `#7B3F2A` and printing a hex on the
 * card — which would break the language of the catalog — we snap it to the
 * nearest dye on the card. Distance is weighted toward hue: an off-black and a
 * navy differ far more meaningfully than two navies of different lightness.
 *
 * The *name* snaps; the hex does not. Returning the house dye's hex as well
 * threw away the only measurement we had: a royal blue tee at #1950BC came
 * back as Indigo #26356E, and since the card takes its whole palette from this
 * hex, every vivid piece in the wardrobe arrived on a card two steps duller
 * than the garment on it. The catalogue gets its thirteen dye names, the card
 * gets the actual cloth.
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

  return { name: best.name, hex };
}
