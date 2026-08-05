import type { ColorSeason, Dye } from "./types";

/**
 * Colour-season ranking.
 *
 * This is deliberately *ours*, not YouCam's. The API tells us the user's skin
 * tone / season; deciding which of their garments flatter it is independent
 * logic layered on top — see PRD §8. It runs client- and server-side with no
 * extra API spend.
 */

/* ── colour maths ───────────────────────────────────────────────────────── */

export function hexToHsl(hex: string): { h: number; s: number; l: number } {
  const clean = hex.replace("#", "");
  const n = parseInt(
    clean.length === 3
      ? clean
          .split("")
          .map((c) => c + c)
          .join("")
      : clean,
    16,
  );
  const r = ((n >> 16) & 255) / 255;
  const g = ((n >> 8) & 255) / 255;
  const b = (n & 255) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  const l = (max + min) / 2;

  if (d === 0) return { h: 0, s: 0, l };

  const s = d / (1 - Math.abs(2 * l - 1));
  let h: number;
  if (max === r) h = ((g - b) / d) % 6;
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  h = Math.round(h * 60);
  if (h < 0) h += 360;

  return { h, s, l };
}

/** Warm hues sit in the red→yellow arc; cool hues in the green→violet arc. */
function temperatureOf(hex: string): "warm" | "cool" | "neutral" {
  const { h, s } = hexToHsl(hex);
  if (s < 0.12) return "neutral";
  if (h < 70 || h > 330) return "warm";
  if (h >= 70 && h < 150) return "neutral";
  return "cool";
}

/**
 * 0–100. Temperature agreement carries most of the weight; depth agreement
 * (does the garment's value sit near the season's own values) carries the rest.
 */
export function matchScore(dye: Dye, season: ColorSeason | undefined): number {
  if (!season) return 50;

  const temp = temperatureOf(dye.hex);
  let score = temp === season.temperature ? 78 : temp === "neutral" ? 62 : 30;

  const { l } = hexToHsl(dye.hex);
  const seasonDepth =
    season.palette.reduce((sum, p) => sum + hexToHsl(p.hex).l, 0) /
    Math.max(season.palette.length, 1);
  score += (1 - Math.min(Math.abs(l - seasonDepth) * 2.4, 1)) * 22;

  return Math.round(Math.max(0, Math.min(100, score)));
}

export function isInPalette(dye: Dye, season: ColorSeason | undefined): boolean {
  return matchScore(dye, season) >= 70;
}

/* ── the twelve seasons ─────────────────────────────────────────────────── */

const P = (name: string, hex: string): Dye => ({ name, hex });

export const SEASONS: Record<string, Omit<ColorSeason, "confidence">> = {
  "Deep Autumn": {
    name: "Deep Autumn",
    temperature: "warm",
    palette: [
      P("Madder", "#B03A21"),
      P("Turmeric", "#D99B21"),
      P("Catechu", "#6E4326"),
      P("Moss", "#5C6034"),
      P("Pomegranate", "#7C2D3A"),
      P("Iron Black", "#1F1D1A"),
    ],
    note: "Deep, warm and saturated. Earth pigments over pastels — madder and catechu carry you; icy blues will drain the warmth out of your skin.",
  },
  "Soft Autumn": {
    name: "Soft Autumn",
    temperature: "warm",
    palette: [
      P("Myrobalan", "#8A8A52"),
      P("Henna", "#8E4B2E"),
      P("Ecru", "#CFC3AA"),
      P("Sage", "#93A08A"),
      P("Clay", "#B07A5E"),
      P("Umber", "#5E4A38"),
    ],
    note: "Muted and warm. Everything a half-step dusty. High-contrast black-and-white pairings will overpower you; keep the values close together.",
  },
  "Cool Winter": {
    name: "Cool Winter",
    temperature: "cool",
    palette: [
      P("Indigo", "#26356E"),
      P("Iron Black", "#1F1D1A"),
      P("Lac Rose", "#B5607E"),
      P("Vat Blue", "#161D3D"),
      P("Snow", "#E8E9EC"),
      P("Verdigris", "#2E6B5E"),
    ],
    note: "Clear, cool, high contrast. Indigo and true black are yours. Warm earth tones — turmeric, henna — will read as muddy against you.",
  },
  "Bright Spring": {
    name: "Bright Spring",
    temperature: "warm",
    palette: [
      P("Turmeric", "#D99B21"),
      P("Coral", "#E2664E"),
      P("Leaf", "#6E9A3C"),
      P("Aqua", "#3FA6A0"),
      P("Ivory", "#EFE7D5"),
      P("Bright Madder", "#C64227"),
    ],
    note: "Warm and clear at high saturation. Push the chroma — muted, dusty pieces will look like they've faded on you.",
  },
  "Cool Summer": {
    name: "Cool Summer",
    temperature: "cool",
    palette: [
      P("Pale Indigo", "#6C7FB8"),
      P("Slate", "#5B6674"),
      P("Rose Quartz", "#C29BA6"),
      P("Seafoam", "#8FB2AC"),
      P("Pearl", "#DEDCD6"),
      P("Plum", "#5F4C6B"),
    ],
    note: "Cool and softened. Think laundered rather than new. Orange-based reds and hot yellows will fight your undertone.",
  },
};

export const SEASON_NAMES = Object.keys(SEASONS);

export function buildSeason(name: string, confidence = 0.9): ColorSeason {
  const base = SEASONS[name] ?? SEASONS["Deep Autumn"];
  return { ...base, confidence };
}
