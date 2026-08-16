/**
 * ═══════════════════════════════════════════════════════════════════════════
 *  Ornament
 * ═══════════════════════════════════════════════════════════════════════════
 *
 *  Pure functions returning SVG data URIs and CSS gradient strings. No React,
 *  no DOM — a pattern is a string, and a string goes in `background-image`.
 *
 *  ── what was wrong the first time ────────────────────────────────────────
 *
 *  The first version of this file drew everything with hairline strokes: the
 *  jaali was a wireframe, the buti was an outline, the mandala was a spoke
 *  diagram. It looked like architectural drafting, and Indian ornament is not
 *  drafting — it is *dyed cloth and printed ink*.
 *
 *  Look at what these traditions actually are:
 *
 *    ajrakh        Kachchh block print. Dense filled geometry in madder and
 *                  indigo, the pattern carried by *solid shape* with thin
 *                  resist lines between — the white is the negative space
 *                  left behind, never the drawing itself.
 *    sanganeri     Jaipur block print. Filled floral butis, two or three
 *                  colours, laid on a half-drop so the field never grids up.
 *    bandhani      Tie-dye. Thousands of small filled dots clustering into
 *                  larger forms. Pure fill, zero line.
 *    zari          Brocade. Solid metal thread on saturated ground, with a
 *                  real specular gradient across each motif.
 *
 *  Not one of them is line art. So every generator below fills, layers two or
 *  three tones, and carries a gradient where the real thing has sheen. Strokes
 *  survive in exactly one place — the resist lines in ajrakh — because that is
 *  the one place the tradition puts them.
 *
 *  ── and the base is a wash, not a tile ───────────────────────────────────
 *
 *  A tiled repeat alone reads as wallpaper however good the tile is. What
 *  makes a dyed field look dyed is unevenness at a scale much larger than the
 *  repeat. `wash()` supplies that: broad off-centre blooms the pattern sits
 *  inside, so the surface has weather.
 *
 *  Colours come from the peacock wordmark, so ornament and identity are
 *  demonstrably the same object.
 * ═══════════════════════════════════════════════════════════════════════════
 */

/* ── the inks ────────────────────────────────────────────────────────────── */

export const INK = {
  /** The peacock's body. The signature colour. */
  peacock: "#0C535E",
  /** Its darkest feathers. */
  abyss: "#0E2C39",
  /** The gilt flourishes. */
  brass: "#B7772E",
  brassLight: "#C7A46C",
  /** The paper it is printed on. */
  leaf: "#FCF4E6",
  /** Spot inks a matchbox press could afford. */
  madder: "#B03A21",
  turmeric: "#D99B21",
  lac: "#B5185E",
  emerald: "#1F7A4C",
  aubergine: "#3B1A4A",
} as const;

const uri = (svg: string) =>
  `data:image/svg+xml,${encodeURIComponent(svg.replace(/\s+/g, " ").trim())}`;

const open = (w: number, h: number) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">`;

/** `rgb(… / a)` from a hex, so one colour argument can carry many opacities. */
function rgba(hex: string, alpha: number): string {
  const n = parseInt(hex.replace("#", ""), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`;
}

/* ── the wash: weather, under everything ─────────────────────────────────── */

/**
 * Broad, off-centre blooms — a CSS gradient stack, not an image.
 *
 * This is what makes a surface read as *dyed* rather than *filled*. Cloth out
 * of a vat is never one value: it is deeper where it sat folded and lighter
 * where the liquid ran off. Three overlapping radials at wildly different
 * sizes, none of them centred, gets most of the way there.
 *
 * Returned as a background-image string, so it stacks under any tile below.
 */
export function wash(
  base: string,
  tints: Array<[string, number]> = [
    [INK.brass, 0.16],
    [INK.peacock, 0.12],
    [INK.madder, 0.07],
  ],
): string {
  const spots = [
    "120% 90% at 12% -10%",
    "100% 80% at 92% 8%",
    "130% 100% at 50% 115%",
  ];
  return tints
    .map(
      ([hex, a], i) =>
        `radial-gradient(${spots[i % spots.length]}, ${rgba(hex, a)}, ${rgba(hex, 0)} 62%)`,
    )
    .concat(`linear-gradient(${base}, ${base})`)
    .join(", ");
}

/* ── ajrakh: filled geometry with resist lines ───────────────────────────── */

/**
 * The block print of Kachchh — filled eight-point stars locked into a filled
 * ground, with fine resist lines left between them.
 *
 * Two tones and a line, which is exactly what one ajrakh block gives you.
 */
export function ajrakh(
  color: string,
  opacity = 0.14,
  size = 72,
  accent: string = INK.madder,
): string {
  const s = size;
  const h = s / 2;
  const q = s / 4;

  return uri(`${open(s, s)}
<g fill="${color}" fill-opacity="${opacity}">
<path d="M${h} 0 L${s} ${h} L${h} ${s} L0 ${h} Z"/>
<path d="M0 0 L${q} 0 L0 ${q} Z M${s} 0 L${s} ${q} L${s - q} 0 Z
        M0 ${s} L0 ${s - q} L${q} ${s} Z M${s} ${s} L${s - q} ${s} L${s} ${s - q} Z"/>
</g>
<g fill="${accent}" fill-opacity="${opacity * 1.15}">
<path d="M${h} ${q * 0.7} L${s - q * 0.7} ${h} L${h} ${s - q * 0.7} L${q * 0.7} ${h} Z"/>
</g>
<g fill="${INK.leaf}" fill-opacity="${opacity * 2.1}">
<circle cx="${h}" cy="${h}" r="${s * 0.075}"/>
<circle cx="0" cy="0" r="${s * 0.045}"/><circle cx="${s}" cy="0" r="${s * 0.045}"/>
<circle cx="0" cy="${s}" r="${s * 0.045}"/><circle cx="${s}" cy="${s}" r="${s * 0.045}"/>
</g></svg>`);
}

/* ── sanganeri: the filled floral buti ───────────────────────────────────── */

/**
 * A Jaipur block-print field: filled rosettes and leaves on a half-drop.
 *
 * Every petal is a solid shape with a second tone inside it, because a printer
 * cutting two blocks is the cheapest way to get depth and it is what these
 * actually look like. The earlier outline version read as a doodle.
 */
export function phool(
  color: string,
  opacity = 0.16,
  size = 104,
  accent: string = INK.madder,
): string {
  const s = size;
  const h = s / 2;

  /** One rosette: `n` filled petals, a contrasting heart, a ring of seeds. */
  const rosette = (cx: number, cy: number, r: number, petals = 8) => {
    const leaf = Array.from({ length: petals }, (_, i) => {
      const a = (i / petals) * 360;
      return `<path transform="rotate(${a.toFixed(1)} ${cx} ${cy})"
        d="M${cx} ${cy - r} C ${cx + r * 0.46} ${cy - r * 0.72} ${cx + r * 0.4} ${cy - r * 0.24} ${cx} ${cy}
           C ${cx - r * 0.4} ${cy - r * 0.24} ${cx - r * 0.46} ${cy - r * 0.72} ${cx} ${cy - r} Z"/>`;
    }).join("");
    const seeds = Array.from({ length: petals }, (_, i) => {
      const a = ((i + 0.5) / petals) * Math.PI * 2;
      return `<circle cx="${(cx + Math.cos(a) * r * 0.66).toFixed(1)}" cy="${(cy + Math.sin(a) * r * 0.66).toFixed(1)}" r="${(r * 0.09).toFixed(1)}"/>`;
    }).join("");

    return `<g fill="${color}" fill-opacity="${opacity}">${leaf}</g>
<g fill="${accent}" fill-opacity="${opacity * 1.25}">${seeds}<circle cx="${cx}" cy="${cy}" r="${(r * 0.2).toFixed(1)}"/></g>`;
  };

  /** A filled leaf pair on a stem, to fill the gaps the rosettes leave. */
  const sprig = (cx: number, cy: number, k: number, rot: number) => `
<g transform="translate(${cx} ${cy}) rotate(${rot}) scale(${k})" fill="${color}" fill-opacity="${opacity * 0.8}">
<path d="M0 0 C 9 -7 17 -4 17 6 C 9 10 1 7 0 0 Z"/>
<path d="M0 0 C -9 -7 -17 -4 -17 6 C -9 10 -1 7 0 0 Z"/>
<path d="M0 0 C 2 -9 1 -16 0 -22 C -1 -16 -2 -9 0 0 Z"/>
</g>`;

  return uri(`${open(s, s)}
${rosette(h * 0.5, h * 0.5, s * 0.155)}
${rosette(h * 1.5, h * 1.5, s * 0.155)}
${sprig(h * 1.5, h * 0.52, 0.62, 24)}
${sprig(h * 0.5, h * 1.52, 0.62, -24)}
</svg>`);
}

/* ── bandhani: dots, and only dots ───────────────────────────────────────── */

/**
 * Tie-dye. Small filled dots clustering into a larger diamond, which is how a
 * bandhani field resolves when you step back from it. No line anywhere.
 */
export function bandhani(color: string, opacity = 0.2, size = 56): string {
  const s = size;
  const h = s / 2;

  // A diamond of dots, densest at the centre.
  const cluster = (cx: number, cy: number, r: number) => {
    const out: string[] = [];
    for (let ring = 0; ring <= 2; ring++) {
      const count = ring === 0 ? 1 : ring * 4;
      for (let i = 0; i < count; i++) {
        const a = (i / count) * Math.PI * 2 + ring * 0.4;
        const d = ring * r * 0.42;
        out.push(
          `<circle cx="${(cx + Math.cos(a) * d).toFixed(1)}" cy="${(cy + Math.sin(a) * d).toFixed(1)}" r="${(r * 0.13).toFixed(2)}"/>`,
        );
      }
    }
    return out.join("");
  };

  return uri(`${open(s, s)}
<g fill="${color}" fill-opacity="${opacity}">
${cluster(h * 0.5, h * 0.5, s * 0.34)}
${cluster(h * 1.5, h * 1.5, s * 0.34)}
</g></svg>`);
}

/* ── zari: brocade, with sheen ───────────────────────────────────────────── */

/**
 * A gold motif on a saturated ground, with a real gradient across it.
 *
 * Brocade is metal thread, so it has a specular run — flat gold looks like
 * mustard. The linear gradient is the whole point of this one.
 */
export function zari(color: string = INK.brass, opacity = 0.3, size = 88): string {
  const s = size;
  const h = s / 2;

  return uri(`${open(s, s)}
<defs>
<linearGradient id="z" x1="0" y1="0" x2="1" y2="1">
<stop offset="0" stop-color="${color}" stop-opacity="${opacity * 0.45}"/>
<stop offset=".48" stop-color="${INK.brassLight}" stop-opacity="${opacity}"/>
<stop offset="1" stop-color="${color}" stop-opacity="${opacity * 0.35}"/>
</linearGradient>
</defs>
<g fill="url(#z)">
<path d="M${h} ${h * 0.24} C ${h * 1.5} ${h * 0.55} ${h * 1.5} ${h * 1.45} ${h} ${h * 1.76}
         C ${h * 0.5} ${h * 1.45} ${h * 0.5} ${h * 0.55} ${h} ${h * 0.24} Z"/>
<circle cx="${h}" cy="${h}" r="${s * 0.055}" fill="${INK.leaf}" fill-opacity="${opacity * 0.8}"/>
<path d="M0 0 C ${s * 0.14} ${s * 0.06} ${s * 0.06} ${s * 0.14} 0 ${s * 0.2} Z"/>
<path d="M${s} ${s} C ${s * 0.86} ${s * 0.94} ${s * 0.94} ${s * 0.86} ${s} ${s * 0.8} Z"/>
</g></svg>`);
}

/* ── rays and mandala: filled, and lit ───────────────────────────────────── */

/**
 * The sunburst behind every deity on every label — filled wedges, fading out
 * with distance so the centre glows rather than the edges shouting.
 */
export function rays(color: string, opacity = 0.16, count = 30): string {
  const R = 200;
  const spokes = Array.from({ length: count }, (_, i) => {
    const a = (i / count) * Math.PI * 2;
    const w = i % 2 === 0 ? 0.03 : 0.014;
    const p = (o: number) =>
      `${(R + Math.cos(a + o) * R * 1.6).toFixed(1)} ${(R + Math.sin(a + o) * R * 1.6).toFixed(1)}`;
    return `<path d="M${R} ${R} L${p(-w)} L${p(w)} Z"/>`;
  }).join("");

  return uri(`${open(R * 2, R * 2)}
<defs>
<radialGradient id="r">
<stop offset="0" stop-color="${color}" stop-opacity="${opacity * 1.5}"/>
<stop offset=".55" stop-color="${color}" stop-opacity="${opacity * 0.7}"/>
<stop offset="1" stop-color="${color}" stop-opacity="0"/>
</radialGradient>
</defs>
<g fill="url(#r)">${spokes}</g></svg>`);
}

/**
 * A mandala to sit behind one focal element. Filled petals in concentric
 * rings, each ring offset against the last, lit from the middle.
 */
export function mandala(color: string, opacity = 0.22, rings = 5): string {
  const R = 180;

  const ring = (inner: number, outer: number, petals: number, phase: number) => {
    // Width comes from the arc each petal is allotted, NOT from how deep the
    // band is. Deriving it from depth is what made every previous attempt a
    // dandelion: an outer ring is barely deeper than an inner one but has
    // three times the circumference, so its petals came out as thin spikes
    // with gaps between them. Filling the slot is what makes a ring a ring.
    const mid = (inner + outer) / 2;
    const w = ((2 * Math.PI * mid) / petals) * 0.44;

    return Array.from({ length: petals }, (_, i) => {
      const a = ((i + phase) / petals) * 360;
      const top = R - outer;
      const bottom = R - inner;
      const belly = R - mid;
      return `<path transform="rotate(${a.toFixed(2)} ${R} ${R})" d="M${R} ${top.toFixed(1)} C ${(R + w).toFixed(1)} ${(top + (bottom - top) * 0.3).toFixed(1)} ${(R + w).toFixed(1)} ${belly.toFixed(1)} ${R} ${bottom.toFixed(1)} C ${(R - w).toFixed(1)} ${belly.toFixed(1)} ${(R - w).toFixed(1)} ${(top + (bottom - top) * 0.3).toFixed(1)} ${R} ${top.toFixed(1)} Z"/>`;
    }).join("");
  };

  const body = Array.from({ length: rings }, (_, i) => {
    const inner = R * (0.14 + (i / rings) * 0.76);
    const outer = R * (0.14 + ((i + 1) / rings) * 0.76) * 0.985;
    return `<g fill="url(#m)" opacity="${(1 - i * 0.1).toFixed(2)}">${ring(inner, outer, 10 + i * 7, i % 2 ? 0.5 : 0)}</g>`;
  }).join("");

  const hem = Array.from({ length: 56 }, (_, i) => {
    const a = (i / 56) * Math.PI * 2;
    return `<circle cx="${(R + Math.cos(a) * R * 0.965).toFixed(1)}" cy="${(R + Math.sin(a) * R * 0.965).toFixed(1)}" r="3"/>`;
  }).join("");

  return uri(`${open(R * 2, R * 2)}
<defs>
<radialGradient id="m">
<stop offset="0" stop-color="${INK.brassLight}" stop-opacity="${opacity * 1.6}"/>
<stop offset=".6" stop-color="${color}" stop-opacity="${opacity}"/>
<stop offset="1" stop-color="${color}" stop-opacity="${opacity * 0.55}"/>
</radialGradient>
</defs>
<g fill="${color}" fill-opacity="${opacity * 0.5}">${hem}</g>
${body}
<circle cx="${R}" cy="${R}" r="${R * 0.1}" fill="${INK.brassLight}" fill-opacity="${opacity * 1.4}"/>
</svg>`);
}

/* ── the small stuff ─────────────────────────────────────────────────────── */

/** The dot screen of cheap offset printing. Multiply this over a flat colour. */
export function halftone(color: string, opacity = 0.16, size = 6): string {
  return uri(`${open(size, size)}
<circle cx="${size / 2}" cy="${size / 2}" r="${size * 0.19}" fill="${color}" fill-opacity="${opacity}"/>
</svg>`);
}

/** Corner ornament — one motif, rotated four ways by CSS to close a frame. */
export function cornerMotif(color: string, opacity = 0.85, size = 36): string {
  const s = size;
  return uri(`${open(s, s)}
<g fill="${color}" fill-opacity="${opacity}">
<path d="M3 ${s} L3 11 Q3 3 11 3 L${s} 3 L${s} 6 L12 6 Q6 6 6 12 L6 ${s} Z"/>
<path d="M11 21 Q17 12 27 11 Q22 21 11 21 Z"/>
<circle cx="${s - 9}" cy="${s - 9}" r="2.2"/>
</g></svg>`);
}

/** Off-register printing, as a text-shadow. One pixel; two looks broken. */
export const MISREGISTER = {
  light: "1px 0 0 rgba(12,83,94,.3), -1px 0 0 rgba(181,24,94,.22)",
  dark: "1px 0 0 rgba(217,155,33,.38), -1px 0 0 rgba(176,58,33,.32)",
} as const;
