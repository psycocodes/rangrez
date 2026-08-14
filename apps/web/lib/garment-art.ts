import type { Dye, Zone } from "./types";

/**
 * ═══════════════════════════════════════════════════════════════════════════
 *  Drawing the starter wardrobe
 * ═══════════════════════════════════════════════════════════════════════════
 *
 *  The starter pieces used to be random stock photographs pulled from picsum
 *  by seed. Deterministic, but meaningless: a card reading "Raw Denim Straight"
 *  showed a typewriter, and once those cards were dealt onto the look creator's
 *  wheels the mismatch was the first thing you saw.
 *
 *  So they are drawn instead. Each piece gets a flat-lay of the garment it
 *  actually claims to be, in its own catalogued dye, as an inline SVG data URI.
 *  No network, no licensing, no 404 in two years, and the picture always agrees
 *  with the label.
 *
 *  These are unmistakably illustrations, which is the honest thing for demo
 *  data to be — nobody will mistake a starter piece for a photograph of a
 *  garment they own.
 * ═══════════════════════════════════════════════════════════════════════════
 */

type Shape =
  | "shirt" | "tee" | "tank" | "knit"
  | "trouser" | "shorts" | "skirt"
  | "jacket" | "coat"
  | "shoe" | "boot" | "sneaker"
  | "bag" | "scarf" | "belt" | "glasses";

/**
 * Which drawing a piece gets, from its name and rail.
 *
 * Order matters the same way it does in the classifier: "Shearling Chore Coat"
 * has to be read as a coat before "chore" means anything else, and a "Silk Wrap
 * Blouse" is a shirt rather than a wrap.
 */
function shapeFor(name: string, zone: Zone): Shape {
  const n = name.toLowerCase();

  if (/sunglass|eyewear|spectacle/.test(n)) return "glasses";
  if (/belt/.test(n)) return "belt";
  if (/scarf|stole|shawl/.test(n)) return "scarf";
  if (/tote|bag|purse|clutch|backpack/.test(n)) return "bag";

  if (/boot/.test(n)) return "boot";
  if (/sneaker|trainer|low-top|canvas|plimsoll|slide|sandal/.test(n)) return "sneaker";
  if (zone === "shoes") return "shoe";

  if (/trench|overcoat|parka|chore coat|\bcoat\b/.test(n)) return "coat";
  if (zone === "outerwear") return "jacket";

  if (/skirt/.test(n)) return "skirt";
  if (/short/.test(n)) return "shorts";
  if (zone === "bottom") return "trouser";

  if (/knit|crewneck|sweater|jumper|cardigan|merino(?!.*tank)/.test(n)) return "knit";
  if (/tank|camisole|vest/.test(n)) return "tank";
  if (/tee|t-shirt|jersey|long-sleeve/.test(n)) return "tee";
  return "shirt";
}

/* ── the drawings ─────────────────────────────────────────────────────────
 * One 400×500 frame each. `f` is the dye, `s` a darker line of the same, so
 * every garment is drawn in its own colour rather than outlined in black.
 * `BACK` is the frame's own ground, used to cut openings back out of a shape.
 * ---------------------------------------------------------------------- */

const BACK = "#E4DCCA";

const DRAW: Record<Shape, (f: string, s: string) => string> = {
  shirt: (f, s) => `
    <path d="M150 96 L200 128 L250 96 L302 112 L348 194 L302 218 L274 172 L274 424 L126 424 L126 172 L98 218 L52 194 L98 112 Z" fill="${f}"/>
    <path d="M150 96 L200 128 L250 96" fill="none" stroke="${s}" stroke-width="3"/>
    <path d="M200 128 L200 424" stroke="${s}" stroke-width="2" opacity=".55"/>
    <path d="M274 172 L302 218 M126 172 L98 218" stroke="${s}" stroke-width="2" opacity=".4"/>
    <circle cx="200" cy="206" r="4" fill="${s}"/><circle cx="200" cy="268" r="4" fill="${s}"/><circle cx="200" cy="330" r="4" fill="${s}"/>`,

  tee: (f, s) => `
    <path d="M152 100 Q200 138 248 100 L306 120 L342 186 L296 208 L274 178 L274 412 L126 412 L126 178 L104 208 L58 186 L94 120 Z" fill="${f}"/>
    <path d="M152 100 Q200 138 248 100" fill="none" stroke="${s}" stroke-width="4"/>
    <path d="M274 178 L296 208 M126 178 L104 208" stroke="${s}" stroke-width="2" opacity=".4"/>`,

  tank: (f, s) => `
    <path d="M158 132 Q166 96 190 92 L190 120 Q200 130 210 120 L210 92 Q234 96 242 132 L242 412 L158 412 Z" fill="${f}"/>
    <path d="M190 120 Q200 130 210 120" fill="none" stroke="${s}" stroke-width="3"/>
    <path d="M158 396 L242 396" stroke="${s}" stroke-width="2" opacity=".5"/>`,

  knit: (f, s) => `
    <path d="M152 104 Q200 140 248 104 L306 126 L336 190 L300 214 L282 190 L282 404 L118 404 L118 190 L100 214 L64 190 L94 126 Z" fill="${f}"/>
    <path d="M152 104 Q200 140 248 104" fill="none" stroke="${s}" stroke-width="6"/>
    <path d="M118 386 L282 386" stroke="${s}" stroke-width="6"/>
    <path d="M160 214 L160 386 M200 214 L200 386 M240 214 L240 386" stroke="${s}" stroke-width="2" opacity=".35"/>`,

  trouser: (f, s) => `
    <path d="M136 92 L264 92 L276 196 L234 438 L206 438 L200 258 L194 438 L166 438 L124 196 Z" fill="${f}"/>
    <path d="M136 116 L264 116" stroke="${s}" stroke-width="3" opacity=".7"/>
    <path d="M200 116 L200 258" stroke="${s}" stroke-width="2" opacity=".5"/>
    <rect x="136" y="92" width="128" height="10" fill="${s}" opacity=".55"/>`,

  shorts: (f, s) => `
    <path d="M136 108 L264 108 L272 190 L252 320 L212 320 L200 226 L188 320 L148 320 L128 190 Z" fill="${f}"/>
    <path d="M136 132 L264 132" stroke="${s}" stroke-width="3" opacity=".7"/>
    <path d="M200 132 L200 226" stroke="${s}" stroke-width="2" opacity=".5"/>
    <rect x="136" y="108" width="128" height="10" fill="${s}" opacity=".55"/>`,

  skirt: (f, s) => `
    <path d="M150 112 L250 112 L292 404 L108 404 Z" fill="${f}"/>
    <rect x="150" y="112" width="100" height="12" fill="${s}" opacity=".6"/>
    <path d="M186 124 L166 404 M214 124 L234 404" stroke="${s}" stroke-width="2" opacity=".35"/>`,

  // Jackets and coats hang OPEN — a wedge of the backdrop down the middle and
  // two turned-back lapels. Drawn closed they were identical in silhouette to
  // a shirt, and both read as dresses on the card.
  jacket: (f, s) => `
    <path d="M146 92 L200 146 L254 92 L308 112 L346 186 L300 210 L276 172 L276 428 L124 428 L124 172 L100 210 L54 186 L92 112 Z" fill="${f}"/>
    <path d="M200 146 L236 428 L164 428 Z" fill="${BACK}"/>
    <path d="M146 92 L200 146 L182 250 L142 124 Z" fill="${s}" opacity=".55"/>
    <path d="M254 92 L200 146 L218 250 L258 124 Z" fill="${s}" opacity=".55"/>
    <path d="M276 172 L300 210 M124 172 L100 210" stroke="${s}" stroke-width="2" opacity=".4"/>
    <rect x="124" y="404" width="152" height="10" fill="${s}" opacity=".45"/>`,

  coat: (f, s) => `
    <path d="M146 84 L200 140 L254 84 L310 106 L350 184 L304 208 L280 168 L280 456 L120 456 L120 168 L96 208 L50 184 L90 106 Z" fill="${f}"/>
    <path d="M200 140 L240 456 L160 456 Z" fill="${BACK}"/>
    <path d="M146 84 L200 140 L180 258 L140 118 Z" fill="${s}" opacity=".55"/>
    <path d="M254 84 L200 140 L220 258 L260 118 Z" fill="${s}" opacity=".55"/>
    <rect x="120" y="292" width="160" height="12" fill="${s}" opacity=".5"/>
    <circle cx="150" cy="336" r="6" fill="${s}"/><circle cx="250" cy="336" r="6" fill="${s}"/>`,

  shoe: (f, s) => `
    <path d="M92 322 L150 256 L206 262 L252 292 L306 306 L326 330 L322 356 L92 356 Z" fill="${f}"/>
    <path d="M92 356 L326 356 L322 376 L92 376 Z" fill="${s}"/>
    <path d="M150 256 L182 300 M172 268 L206 306" stroke="${s}" stroke-width="3" opacity=".6"/>
    <path d="M206 262 L214 306" stroke="${s}" stroke-width="3" opacity=".6"/>`,

  boot: (f, s) => `
    <path d="M140 150 L232 150 L238 300 L302 316 L324 340 L320 366 L140 366 Z" fill="${f}"/>
    <path d="M140 366 L324 366 L320 388 L140 388 Z" fill="${s}"/>
    <path d="M140 178 L232 178" stroke="${s}" stroke-width="3" opacity=".65"/>
    <path d="M232 226 L238 300" stroke="${s}" stroke-width="3" opacity=".5"/>`,

  sneaker: (f, s) => `
    <path d="M84 316 L146 250 L196 258 L238 288 L296 302 L322 326 L320 350 L84 350 Z" fill="${f}"/>
    <path d="M84 350 L320 350 L316 382 L84 382 Z" fill="${s}"/>
    <path d="M84 366 L316 366" stroke="${f}" stroke-width="3" opacity=".65"/>
    <path d="M150 268 L176 302 M172 258 L200 296 M196 262 L222 300" stroke="${s}" stroke-width="3" opacity=".55"/>`,

  bag: (f, s) => `
    <path d="M124 196 L276 196 L292 412 L108 412 Z" fill="${f}"/>
    <path d="M164 196 Q164 132 200 132 Q236 132 236 196" fill="none" stroke="${s}" stroke-width="9"/>
    <rect x="108" y="230" width="184" height="10" fill="${s}" opacity=".4"/>`,

  scarf: (f, s) => `
    <path d="M132 96 L268 96 L252 300 Q200 344 148 300 Z" fill="${f}"/>
    <path d="M148 300 L140 404 L188 384 L200 344 L212 384 L260 404 L252 300" fill="${f}" opacity=".85"/>
    <path d="M132 150 L268 150 M132 210 L268 210" stroke="${s}" stroke-width="4" opacity=".45"/>`,

  belt: (f, s) => `
    <rect x="70" y="228" width="260" height="44" rx="6" fill="${f}"/>
    <rect x="236" y="212" width="76" height="76" rx="8" fill="none" stroke="${s}" stroke-width="10"/>
    <circle cx="120" cy="250" r="5" fill="${s}"/><circle cx="152" cy="250" r="5" fill="${s}"/><circle cx="184" cy="250" r="5" fill="${s}"/>`,

  glasses: (f, s) => `
    <circle cx="136" cy="250" r="52" fill="${f}" opacity=".55" stroke="${s}" stroke-width="8"/>
    <circle cx="264" cy="250" r="52" fill="${f}" opacity=".55" stroke="${s}" stroke-width="8"/>
    <path d="M188 244 Q200 232 212 244" fill="none" stroke="${s}" stroke-width="8"/>
    <path d="M84 240 L54 224 M316 240 L346 224" stroke="${s}" stroke-width="8"/>`,
};

/** Darkens a hex toward ink, for the drawing's own line work. */
function shade(hex: string, amount = 0.42): string {
  const n = hex.replace("#", "");
  const to = [0x14, 0x12, 0x0e]; // the house ink
  const out = [0, 1, 2].map((i) => {
    const c = parseInt(n.slice(i * 2, i * 2 + 2), 16);
    return Math.round(c + (to[i] - c) * amount)
      .toString(16)
      .padStart(2, "0");
  });
  return `#${out.join("")}`;
}

/**
 * A flat-lay of this garment, in its own dye, as a data URI.
 *
 * Inline rather than a file per shape because the colour changes per piece and
 * an SVG file cannot take a parameter. At well under a kilobyte each this sits
 * comfortably in the `image_url` column alongside real upload paths.
 */
export function garmentArt(name: string, zone: Zone, dye: Dye): string {
  const shape = shapeFor(name, zone);
  const line = shade(dye.hex);

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 500" width="400" height="500">
<rect width="400" height="500" fill="${BACK}"/>
<g opacity=".5">${Array.from({ length: 13 }, (_, i) =>
    `<path d="M0 ${i * 40} H400" stroke="#14120E" stroke-opacity=".05" stroke-width="1"/>`,
  ).join("")}</g>
${DRAW[shape](dye.hex, line)}
</svg>`;

  return `data:image/svg+xml,${encodeURIComponent(svg.replace(/\s+/g, " ").trim())}`;
}
