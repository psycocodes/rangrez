import type { Zone } from "./types";

/**
 * ═══════════════════════════════════════════════════════════════════════════
 *  Will it fit?
 * ═══════════════════════════════════════════════════════════════════════════
 *
 *  Pure. No imports that run, no DOM, no network — so the extension's node
 *  test suite can exercise it directly and so it can be reasoned about without
 *  a browser or a database.
 *
 *  The problem this solves is the one thing virtual try-on cannot: VTO shows
 *  you what a garment *looks* like, at whatever size the photograph was shot
 *  in. It says nothing about whether the M will close across your chest. So
 *  the render answers "do I like it" and this answers "which one do I order",
 *  and between them there is nothing left to guess at on a product page.
 *
 *  Three things go in:
 *
 *    · the body        — measurements the user entered once, in cm
 *    · the garment     — its cut, and the shop's size chart if the page had one
 *    · the preference  — tailored / regular / relaxed, from the profile
 *
 *  and one thing comes out: a size, a verdict in plain words, and the reason.
 *
 *  ── on ease ──────────────────────────────────────────────────────────────
 *
 *  A shirt that measures exactly your chest does not fit; it is a compression
 *  top. Every garment is cut larger than the body it is for, and how much
 *  larger *is* the cut: ~8cm across the chest is slim, ~14cm is regular, ~30cm
 *  is the oversized silhouette people buy on purpose. That gap is called ease,
 *  and it is the whole calculation here — we are not asking whether the
 *  numbers match, we are asking whether the gap between them is the gap this
 *  kind of garment is supposed to have.
 *
 *  ── on charts ────────────────────────────────────────────────────────────
 *
 *  Shops publish two incompatible kinds of size chart and almost never label
 *  which: "to fit chest 96-101cm" (body) and "garment chest 110cm" (garment).
 *  Read a garment chart as a body chart and you will confidently recommend
 *  two sizes too small. `inferBasis` below works out which it is by comparing
 *  the chart against standard body sizing, because a garment chart's numbers
 *  sit consistently above a body chart's for the same letter.
 * ═══════════════════════════════════════════════════════════════════════════
 */

/* ── the body ────────────────────────────────────────────────────────────── */

/** What the user reads their own numbers in. Storage is always cm. */
export type MeasureUnit = "cm" | "in";

export interface Measurements {
  heightCm?: number;
  weightKg?: number;
  /** Fullest part of the chest or bust, tape level under the arms. */
  chestCm?: number;
  /** Natural waist — the narrowest part, not where the trousers sit. */
  waistCm?: number;
  hipCm?: number;
  /** Seam to seam across the back. */
  shoulderCm?: number;
  /** Crotch to floor, barefoot. */
  inseamCm?: number;
  /** Shoulder point to wrist. */
  sleeveCm?: number;
  /** EU shoe size, which is the only one that is a single number. */
  footEu?: number;
  unit: MeasureUnit;
  updatedAt?: string;
}

export const EMPTY_MEASUREMENTS: Measurements = { unit: "cm" };

/** The girth measurements, which is what sizing actually turns on. */
export type Dim =
  | "chestCm" | "waistCm" | "hipCm" | "shoulderCm"
  | "inseamCm" | "sleeveCm" | "lengthCm";

/**
 * The form. Ordered by how much each one buys you: someone who fills in only
 * the first three can already be sized for almost anything.
 */
export const MEASUREMENT_FIELDS: ReadonlyArray<{
  key: keyof Measurements;
  label: string;
  hint: string;
  /** Sane bounds in cm, so a typo can't recommend a tent. */
  min: number;
  max: number;
  /** Sizing is impossible without these. */
  core: boolean;
}> = [
  { key: "chestCm", label: "Chest", hint: "Fullest part, tape under the arms", min: 60, max: 160, core: true },
  { key: "waistCm", label: "Waist", hint: "Narrowest part, not your trouser line", min: 50, max: 160, core: true },
  { key: "hipCm", label: "Hip", hint: "Fullest part, feet together", min: 60, max: 170, core: true },
  { key: "shoulderCm", label: "Shoulder", hint: "Seam to seam across the back", min: 30, max: 60, core: false },
  { key: "inseamCm", label: "Inseam", hint: "Crotch to floor, barefoot", min: 55, max: 105, core: false },
  { key: "sleeveCm", label: "Sleeve", hint: "Shoulder point to wrist", min: 45, max: 80, core: false },
  { key: "heightCm", label: "Height", hint: "Barefoot", min: 120, max: 230, core: false },
  { key: "weightKg", label: "Weight", hint: "In kilograms", min: 30, max: 220, core: false },
  { key: "footEu", label: "Shoe", hint: "EU size", min: 33, max: 52, core: false },
];

export const CM_PER_INCH = 2.54;

export const toCm = (v: number, unit: MeasureUnit) =>
  unit === "in" ? v * CM_PER_INCH : v;

export const fromCm = (v: number, unit: MeasureUnit) =>
  unit === "in" ? v / CM_PER_INCH : v;

/** Reads a form value into cm, or undefined if it is blank or out of bounds. */
export function readMeasurement(
  key: keyof Measurements,
  raw: unknown,
  unit: MeasureUnit,
): number | undefined {
  const text = String(raw ?? "").trim();
  if (!text) return undefined;
  const n = Number(text);
  if (!Number.isFinite(n) || n <= 0) return undefined;

  const field = MEASUREMENT_FIELDS.find((f) => f.key === key);
  if (!field) return undefined;

  // Weight and shoe size are not lengths; they are never converted.
  const cm = key === "weightKg" || key === "footEu" ? n : toCm(n, unit);
  if (cm < field.min || cm > field.max) return undefined;
  return Math.round(cm * 10) / 10;
}

/** How much of the picture we have. Drives whether we hedge the advice. */
export function measurementCoverage(m: Measurements): number {
  const core = MEASUREMENT_FIELDS.filter((f) => f.core);
  const have = core.filter((f) => typeof m[f.key] === "number").length;
  return have / core.length;
}

/* ── the garment ─────────────────────────────────────────────────────────── */

/** How generously the piece is cut, before any size is chosen. */
export type Cut = "slim" | "regular" | "relaxed" | "oversized";

export const CUTS: readonly Cut[] = ["slim", "regular", "relaxed", "oversized"];

/** Whether a chart's numbers describe a body or the garment itself. */
export type SizeBasis = "body" | "garment";

export interface SizeRow {
  /** As printed: "M", "32", "UK 10". */
  size: string;
  chestCm?: number;
  waistCm?: number;
  hipCm?: number;
  shoulderCm?: number;
  inseamCm?: number;
  sleeveCm?: number;
  lengthCm?: number;
  footEu?: number;
  /** When the cell was a range, what it spanned — kept for the explanation. */
  ranges?: Partial<Record<Dim, [number, number]>>;
}

export interface SizeChart {
  basis: SizeBasis;
  rows: SizeRow[];
  /** Where it came from, for the "according to…" line. */
  source?: string;
  /** False when `basis` was inferred rather than stated on the page. */
  basisStated?: boolean;
}

/** Everything we know about how this particular piece is meant to sit. */
export interface GarmentFit {
  /** The size the user owns, or the one they're looking at. */
  sizeLabel?: string;
  cut?: Cut;
  chart?: SizeChart;
  /** Stretch buys back ease; a 4-way stretch slim tee is not a slim shirt. */
  stretch?: "none" | "some" | "high";
  /** Free text the user added — "runs small", "sleeves are long". */
  note?: string;
}

/**
 * How the piece is cut, read off the product title.
 *
 * Order is the logic, exactly as in the garment classifier: "oversized" has to
 * be read before "relaxed" or a boxy tee reads as merely loose, and a bare
 * "slim" has to lose to an explicit "regular fit" appearing later in the same
 * title ("Regular Fit Slim Collar Shirt" is a regular-fit shirt).
 */
const CUT_PATTERNS: Array<[Cut, RegExp]> = [
  ["oversized", /\b(oversized|over[\s-]?size|boxy|baggy|drop[\s-]?shoulder)\b/i],
  ["relaxed", /\b(relaxed|loose|comfort[\s-]?fit|easy[\s-]?fit|wide[\s-]?leg)\b/i],
  ["regular", /\b(regular|classic|standard)[\s-]?fit\b/i],
  ["slim", /\b(slim|skinny|fitted|tapered|muscle|body[\s-]?con)\b/i],
];

export function cutFromText(text: string): Cut | undefined {
  const haystack = String(text ?? "");
  for (const [cut, re] of CUT_PATTERNS) {
    if (re.test(haystack)) return cut;
  }
  return undefined;
}

/**
 * Stretch buys back ease, so it changes which size is right. Elastane content
 * is the honest signal — "stretch" alone is a marketing word that appears on
 * rigid denim, so it counts for less than a stated fibre.
 */
export function stretchFromText(text: string): GarmentFit["stretch"] | undefined {
  const haystack = String(text ?? "");
  if (/\b(4|four)[\s-]?way\s+stretch\b/i.test(haystack)) return "high";
  if (/\b([5-9]|[1-9]\d)\s*%\s*(elastane|spandex|lycra)\b/i.test(haystack)) return "high";
  if (/\b(elastane|spandex|lycra|stretch(able)?)\b/i.test(haystack)) return "some";
  if (/\b(rigid|non[\s-]?stretch|100\s*%\s*cotton)\b/i.test(haystack)) return "none";
  return undefined;
}

export type FitCategory = "upper" | "lower" | "shoes" | "none";

export function fitCategory(zone: Zone): FitCategory {
  if (zone === "top" || zone === "outerwear") return "upper";
  if (zone === "bottom") return "lower";
  if (zone === "shoes") return "shoes";
  return "none";
}

/**
 * Target ease, in cm, per cut. These are the numbers a pattern cutter works
 * to — not something we tuned to make the demo look good.
 */
const EASE: Record<"upper" | "lower", Partial<Record<Dim, Record<Cut, number>>>> = {
  upper: {
    chestCm:    { slim: 8,  regular: 14,  relaxed: 20,  oversized: 30 },
    shoulderCm: { slim: 0,  regular: 1.5, relaxed: 3.5, oversized: 6 },
    // Lengths want to land on you, not around you.
    sleeveCm:   { slim: 0,  regular: 0,   relaxed: 1,   oversized: 2 },
  },
  lower: {
    waistCm:    { slim: 1,  regular: 3,   relaxed: 6,   oversized: 10 },
    hipCm:      { slim: 3,  regular: 6,   relaxed: 10,  oversized: 16 },
    inseamCm:   { slim: 0,  regular: 0,   relaxed: 0,   oversized: 0 },
  },
};

/** What the profile's fitPreference does to those targets, in cm. */
const PREFERENCE_SHIFT: Record<"relaxed" | "regular" | "tailored", number> = {
  tailored: -4,
  regular: 0,
  relaxed: 5,
};

/**
 * How much of that shift survives on a body-basis chart.
 *
 * One alpha size is about 5–6cm of body range, so the full shift would move
 * everyone who prefers a relaxed fit up a size and everyone who prefers
 * tailored down one, chart regardless. At this strength it decides borderline
 * cases and leaves clear ones alone, which is what a preference should do.
 */
const BODY_PREFERENCE_FACTOR = 0.45;

/** Stretch lets a garment be cut closer without being tight. */
const STRETCH_ALLOWANCE: Record<NonNullable<GarmentFit["stretch"]>, number> = {
  none: 0,
  some: 2.5,
  high: 5,
};

/** Girth dimensions get eased; lengths do not. */
const IS_GIRTH: Partial<Record<Dim, boolean>> = {
  chestCm: true,
  waistCm: true,
  hipCm: true,
};

/** How much each dimension is allowed to decide, per category. */
const WEIGHTS: Record<"upper" | "lower", Partial<Record<Dim, number>>> = {
  upper: { chestCm: 0.62, shoulderCm: 0.24, sleeveCm: 0.14 },
  lower: { waistCm: 0.54, hipCm: 0.28, inseamCm: 0.18 },
};

/* ── the answer ──────────────────────────────────────────────────────────── */

export type Verdict =
  | "too tight" | "snug" | "true to size" | "roomy" | "too loose";

export const VERDICT_ORDER: readonly Verdict[] = [
  "too tight", "snug", "true to size", "roomy", "too loose",
];

export interface DimVerdict {
  dim: Dim;
  label: string;
  /** Signed cm away from the ease this cut wants. Negative = tighter. */
  deviation: number;
  verdict: Verdict;
}

export interface SizeVerdict {
  size: string;
  /** 0–100. Not a probability; a ranking. */
  score: number;
  verdict: Verdict;
  dims: DimVerdict[];
  /**
   * Where this size sat in the chart before we ranked it.
   *
   * `sizes` comes back best-first, which is what you want for picking one and
   * exactly wrong for drawing a size scale — S M L XL re-sorted by score is no
   * longer a scale. Keeping the original position means a caller can have both
   * orders without the chart being sent twice.
   */
  index: number;
}

export interface FitAdvice {
  /** Best size, if we could pick one. */
  recommended?: string;
  /** The runner-up, when it is genuinely close — "size up if you like room". */
  alternate?: string;
  confidence: "high" | "medium" | "low";
  /** Did we use the shop's chart, or fall back to standard alpha sizing. */
  basis: "chart" | "standard" | "none";
  sizes: SizeVerdict[];
  /** One line for the panel headline. */
  headline: string;
  /** One sentence under it. */
  detail: string;
  /** Measurements that would sharpen this, by field label. */
  missing: string[];
}

const DIM_LABEL: Record<Dim, string> = {
  chestCm: "chest",
  waistCm: "waist",
  hipCm: "hip",
  shoulderCm: "shoulders",
  inseamCm: "inseam",
  sleeveCm: "sleeve",
  lengthCm: "length",
};

/**
 * Deviation → words. Asymmetric on purpose: a garment 4cm tighter than its
 * cut intends is noticeably tight, whereas 4cm looser is barely a drape.
 */
function verdictFor(deviation: number): Verdict {
  if (deviation < -6) return "too tight";
  if (deviation < -2.5) return "snug";
  if (deviation <= 3.5) return "true to size";
  if (deviation <= 9) return "roomy";
  return "too loose";
}

/**
 * Deviation → score, as a Gaussian with a narrower tight side. Tight is the
 * failure people actually return things over; loose is a style choice.
 */
function scoreFor(deviation: number, girth: boolean): number {
  const sigma = deviation < 0
    ? (girth ? 6.5 : 3)
    : (girth ? 10 : 4.5);
  return 100 * Math.exp(-((deviation / sigma) ** 2));
}

/* ── standard sizing, for when the page has no chart ─────────────────────── */

/**
 * Body measurements per alpha size, in cm. This is the ordinary high-street
 * table — close enough to Zara, Uniqlo, H&M and the Indian majors that a
 * recommendation off it is worth making, and clearly flagged as a fallback so
 * nobody mistakes it for the shop's own numbers.
 */
const STANDARD: Record<"male" | "female", SizeRow[]> = {
  male: [
    { size: "XS",  chestCm: 86,  waistCm: 71,  hipCm: 86,  shoulderCm: 41 },
    { size: "S",   chestCm: 91,  waistCm: 76,  hipCm: 91,  shoulderCm: 43 },
    { size: "M",   chestCm: 97,  waistCm: 81,  hipCm: 97,  shoulderCm: 45 },
    { size: "L",   chestCm: 102, waistCm: 86,  hipCm: 102, shoulderCm: 47 },
    { size: "XL",  chestCm: 107, waistCm: 94,  hipCm: 107, shoulderCm: 49 },
    { size: "XXL", chestCm: 112, waistCm: 102, hipCm: 112, shoulderCm: 51 },
  ],
  female: [
    { size: "XS",  chestCm: 79, waistCm: 61, hipCm: 86,  shoulderCm: 36 },
    { size: "S",   chestCm: 84, waistCm: 66, hipCm: 91,  shoulderCm: 37 },
    { size: "M",   chestCm: 89, waistCm: 71, hipCm: 96,  shoulderCm: 38.5 },
    { size: "L",   chestCm: 94, waistCm: 76, hipCm: 101, shoulderCm: 40 },
    { size: "XL",  chestCm: 99, waistCm: 84, hipCm: 107, shoulderCm: 41.5 },
    { size: "XXL", chestCm: 107, waistCm: 91, hipCm: 114, shoulderCm: 43 },
  ],
};

export function standardChart(gender: "male" | "female" = "male"): SizeChart {
  return {
    basis: "body",
    basisStated: true,
    rows: STANDARD[gender].map((r) => ({ ...r })),
    source: "standard sizing",
  };
}

/**
 * A numeric waist size ("32", "W32 L34") is inches, everywhere, always. Turned
 * into a one-row chart so the same comparison runs over it.
 */
export function numericWaistRow(size: string): SizeRow | null {
  const w = size.match(/(?:^|\bw)(\d{2})(?:\b|l)/i);
  if (!w) return null;
  const inches = Number(w[1]);
  if (inches < 22 || inches > 54) return null;

  const l = size.match(/\bl(\d{2})\b/i);
  const row: SizeRow = { size, waistCm: inches * CM_PER_INCH };
  if (l) {
    const leg = Number(l[1]);
    if (leg >= 26 && leg <= 40) row.inseamCm = leg * CM_PER_INCH;
  }
  return row;
}

/* ── reading a shop's size chart ─────────────────────────────────────────── */

/** A table as the content script scraped it: header cells, then body rows. */
export interface RawTable {
  headers: string[];
  rows: string[][];
  /** Caption, heading, or any nearby text — where "to fit" usually hides. */
  context?: string;
}

const HEADER_PATTERNS: Array<[Dim, RegExp]> = [
  ["chestCm", /\b(chest|bust)\b/i],
  ["waistCm", /\bwaist\b/i],
  ["hipCm", /\b(hip|seat)s?\b/i],
  ["shoulderCm", /\bshoulder/i],
  ["inseamCm", /\b(inseam|in\s*seam|inside\s*leg|in\s*leg)\b/i],
  ["sleeveCm", /\bsleeve\b/i],
  ["lengthCm", /\b(length|front\s*length|garment\s*length)\b/i],
];

const SIZE_HEADER = /\b(size|sizes|uk|us|eu|int|intl|international|label)\b/i;

/** "96-101", "96 – 101", "96 to 101", "37.5" → a number, plus the span. */
function readCell(text: string): { value: number; range?: [number, number] } | null {
  const cleaned = String(text ?? "")
    .replace(/["”″']/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!cleaned) return null;

  const nums = cleaned.match(/\d+(?:\.\d+)?/g);
  if (!nums || !nums.length) return null;

  const parsed = nums.map(Number).filter((n) => Number.isFinite(n) && n > 0);
  if (!parsed.length) return null;

  if (parsed.length >= 2 && /[-–—]|\bto\b/i.test(cleaned)) {
    const lo = Math.min(parsed[0], parsed[1]);
    const hi = Math.max(parsed[0], parsed[1]);
    return { value: (lo + hi) / 2, range: [lo, hi] };
  }
  return { value: parsed[0] };
}

/**
 * Are these numbers inches or centimetres?
 *
 * Stated units win. Otherwise magnitude decides, and it decides cleanly: no
 * adult's chest is 40cm and none is 100 inches, so a median under 60 for a
 * girth column can only be inches.
 */
function detectUnit(text: string, medianGirth: number): MeasureUnit {
  if (/\b(cm|centimet)/i.test(text)) return "cm";
  if (/\b(in|inch|inches|")\b/i.test(text)) return "in";
  return medianGirth > 0 && medianGirth < 60 ? "in" : "cm";
}

const median = (xs: number[]) => {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
};

/**
 * Shops publish size charts both ways up. When the first column holds
 * dimension names instead of size labels, the table is on its side.
 */
function needsTranspose(table: RawTable): boolean {
  const firstColumn = table.rows.map((r) => r[0] ?? "");
  const dimish = firstColumn.filter((c) =>
    HEADER_PATTERNS.some(([, re]) => re.test(c)),
  ).length;
  return dimish >= 2 && dimish >= firstColumn.length / 2;
}

function transpose(table: RawTable): RawTable {
  const grid = [table.headers, ...table.rows];
  const width = Math.max(...grid.map((r) => r.length));
  const flipped: string[][] = [];
  for (let c = 0; c < width; c++) flipped.push(grid.map((r) => r[c] ?? ""));
  return {
    headers: flipped[0] ?? [],
    rows: flipped.slice(1),
    context: table.context,
  };
}

/**
 * Body chart or garment chart?
 *
 * Say so if the page says so. Otherwise compare against standard body sizing
 * for the same letters: a garment chart sits consistently above it, because a
 * garment is always cut bigger than the body it fits. 6cm is the threshold —
 * below that is vanity sizing, above it is ease.
 */
function inferBasis(rows: SizeRow[], context: string): {
  basis: SizeBasis;
  stated: boolean;
} {
  if (/\b(to fit|body measurement|your measurement|fits? (a )?(chest|bust|waist))/i.test(context)) {
    return { basis: "body", stated: true };
  }
  if (/\b(garment measurement|product measurement|measured flat|actual measurement)\b/i.test(context)) {
    return { basis: "garment", stated: true };
  }

  const gaps: number[] = [];
  for (const row of rows) {
    const key = row.size.trim().toUpperCase();
    const std = STANDARD.male.find((s) => s.size === key)
      ?? STANDARD.female.find((s) => s.size === key);
    if (!std) continue;
    if (row.chestCm && std.chestCm) gaps.push(row.chestCm - std.chestCm);
    else if (row.waistCm && std.waistCm) gaps.push(row.waistCm - std.waistCm);
  }

  if (gaps.length >= 2) {
    return { basis: median(gaps) > 6 ? "garment" : "body", stated: false };
  }
  // Ranges are how body charts are written ("to fit 96-101"); a garment has
  // one measurement, not a span.
  return { basis: "body", stated: false };
}

/**
 * Turn a scraped table into a chart, or null if it wasn't a size chart at all.
 * Deliberately strict — a delivery-times table that parsed into nonsense would
 * be worse than having no chart, because it would look authoritative.
 */
export function parseSizeChart(raw: RawTable): SizeChart | null {
  let table = raw;
  if (needsTranspose(table)) table = transpose(table);

  const headers = table.headers.map((h) => String(h ?? "").trim());
  if (headers.length < 2 || !table.rows.length) return null;

  // Which column is the size label. Usually column 0, and it is the fallback,
  // but some charts put "Size" third after brand and fit.
  let sizeCol = headers.findIndex((h) => SIZE_HEADER.test(h));
  if (sizeCol < 0) sizeCol = 0;

  const columns: Array<{ index: number; dim: Dim }> = [];
  headers.forEach((header, index) => {
    if (index === sizeCol) return;
    const hit = HEADER_PATTERNS.find(([, re]) => re.test(header));
    if (hit) columns.push({ index, dim: hit[0] });
  });
  if (!columns.length) return null;

  // Unit is decided once for the whole table, off the girth columns — a chart
  // that mixed inches and centimetres between columns would be a broken chart.
  const girthSamples: number[] = [];
  for (const col of columns) {
    if (!IS_GIRTH[col.dim]) continue;
    for (const row of table.rows) {
      const cell = readCell(row[col.index] ?? "");
      if (cell) girthSamples.push(cell.value);
    }
  }
  const unitText = [headers.join(" "), raw.context ?? ""].join(" ");
  const unit = detectUnit(unitText, median(girthSamples));

  const rows: SizeRow[] = [];
  for (const cells of table.rows) {
    const size = String(cells[sizeCol] ?? "").trim();
    // A row whose label is itself a measurement is a stray header, not a size.
    if (!size || size.length > 14 || HEADER_PATTERNS.some(([, re]) => re.test(size))) {
      continue;
    }

    const row: SizeRow = { size };
    const ranges: Partial<Record<Dim, [number, number]>> = {};
    let filled = 0;

    for (const col of columns) {
      const cell = readCell(cells[col.index] ?? "");
      if (!cell) continue;
      row[col.dim] = Math.round(toCm(cell.value, unit) * 10) / 10;
      if (cell.range) {
        ranges[col.dim] = [
          Math.round(toCm(cell.range[0], unit) * 10) / 10,
          Math.round(toCm(cell.range[1], unit) * 10) / 10,
        ];
      }
      filled++;
    }

    if (!filled) continue;
    if (Object.keys(ranges).length) row.ranges = ranges;
    rows.push(row);
  }

  if (rows.length < 2) return null;

  const context = [raw.context ?? "", headers.join(" ")].join(" ");
  const { basis, stated } = inferBasis(rows, context);

  return { basis, basisStated: stated, rows, source: "this page" };
}

/* ── the comparison ──────────────────────────────────────────────────────── */

export interface FitRequest {
  body: Measurements;
  category: FitCategory;
  cut?: Cut;
  stretch?: GarmentFit["stretch"];
  preference?: "relaxed" | "regular" | "tailored";
  chart?: SizeChart | null;
  /** Sizes the page actually offers, when they differ from the chart's rows. */
  offered?: string[];
  /** Only used to pick a standard chart when the page had none. */
  gender?: "male" | "female";
}

/**
 * Judge one row against one body.
 *
 * The two chart bases meet here and nowhere else: on a body chart the row
 * already *is* the body it fits, so the target gap is zero; on a garment chart
 * the row is the garment, so the target gap is the ease its cut calls for.
 * Everything downstream is the same either way, which is the point of pinning
 * the basis down before we get here.
 */
function judgeRow(
  row: SizeRow,
  req: FitRequest,
  basis: SizeBasis,
): Omit<SizeVerdict, "index"> | null {
  if (req.category === "shoes") {
    if (!req.body.footEu || !row.footEu) return null;
    const deviation = row.footEu - req.body.footEu;
    // Shoe sizes are discrete; half a size out is the whole story.
    return {
      size: row.size,
      score: 100 * Math.exp(-((deviation / 0.8) ** 2)),
      verdict: verdictFor(deviation * 4),
      dims: [{
        dim: "lengthCm",
        label: "length",
        deviation,
        verdict: verdictFor(deviation * 4),
      }],
    };
  }

  if (req.category === "none") return null;
  const family = req.category;
  const cut = req.cut ?? "regular";
  const shift = PREFERENCE_SHIFT[req.preference ?? "regular"];
  const give = STRETCH_ALLOWANCE[req.stretch ?? "none"];

  const dims: DimVerdict[] = [];
  let weighted = 0;
  let total = 0;

  for (const [dim, weight] of Object.entries(WEIGHTS[family]) as Array<[Dim, number]>) {
    const garment = row[dim as keyof SizeRow] as number | undefined;
    const body = req.body[dim as keyof Measurements] as number | undefined;
    if (typeof garment !== "number" || typeof body !== "number") continue;

    const girth = Boolean(IS_GIRTH[dim]);

    // How far apart the two numbers *should* be, and this is where the two
    // chart bases stop meaning the same thing.
    //
    // A garment chart states the garment, so the gap we want is the ease its
    // cut calls for, adjusted by how the wearer likes things to sit and by how
    // much the fabric gives.
    //
    // A body chart states the body the size fits — and the shop has already
    // done all of that arithmetic to arrive at it. "Our slim shirt in M fits a
    // 96–101cm chest" has the slimness and the elastane priced in. Adding our
    // own cut ease or stretch allowance on top double-counts the shop's
    // homework: it was reporting a 98cm chest as 3cm roomy in an M whose range
    // is centred on 98.5.
    //
    // What does survive is the wearer's own preference, at less than half
    // strength — someone who likes things loose really should size up, but a
    // preference ought to break a tie rather than overrule the chart.
    const target = basis === "body"
      ? (girth ? shift * BODY_PREFERENCE_FACTOR : 0)
      : (EASE[family][dim]?.[cut] ?? 0) +
        (girth ? shift - give : 0);

    const deviation = garment - body - target;

    dims.push({
      dim,
      label: DIM_LABEL[dim],
      deviation: Math.round(deviation * 10) / 10,
      verdict: verdictFor(girth ? deviation : deviation * 2),
    });

    weighted += scoreFor(girth ? deviation : deviation * 2, girth) * weight;
    total += weight;
  }

  if (!total) return null;

  // The headline verdict follows the dimension that decides the most, not an
  // average — "true to size overall, too tight across the chest" is not a
  // shirt that fits, and averaging would call it one.
  const lead = dims.reduce((a, b) =>
    (WEIGHTS[family][b.dim] ?? 0) > (WEIGHTS[family][a.dim] ?? 0) ? b : a,
  );

  return {
    size: row.size,
    score: Math.round(weighted / total),
    verdict: lead.verdict,
    dims,
  };
}

/** Rows the page actually sells, when it told us. */
function restrictToOffered(rows: SizeRow[], offered?: string[]): SizeRow[] {
  if (!offered?.length) return rows;
  const wanted = new Set(offered.map((s) => s.trim().toUpperCase()));
  const kept = rows.filter((r) => wanted.has(r.size.trim().toUpperCase()));
  return kept.length ? kept : rows;
}

export function recommendSize(req: FitRequest): FitAdvice {
  const missing = MEASUREMENT_FIELDS.filter(
    (f) => f.core && typeof req.body[f.key] !== "number",
  ).map((f) => f.label);

  const none = (headline: string, detail: string): FitAdvice => ({
    confidence: "low",
    basis: "none",
    sizes: [],
    headline,
    detail,
    missing,
  });

  if (req.category === "none") {
    return none("No size to pick", "This kind of piece comes one size.");
  }

  if (req.category === "shoes" && !req.body.footEu) {
    return none("Add your shoe size", "One number in your profile and this becomes a recommendation.");
  }

  // Everything else needs at least one girth measurement to compare against.
  const hasGirth = ["chestCm", "waistCm", "hipCm"].some(
    (k) => typeof req.body[k as keyof Measurements] === "number",
  );
  if (req.category !== "shoes" && !hasGirth) {
    return none(
      "Add your measurements",
      "Chest, waist and hip — once, in your profile — and every product page gets a size.",
    );
  }

  let chart = req.chart ?? null;
  let basisKind: FitAdvice["basis"] = "chart";

  // Numeric jeans sizes ("32", "W32 L34") carry their own measurements, so a
  // page that offers them needs no chart at all.
  if (!chart && req.offered?.length) {
    const numeric = req.offered
      .map(numericWaistRow)
      .filter((r): r is SizeRow => r !== null);
    if (numeric.length >= 2) {
      chart = { basis: "body", basisStated: true, rows: numeric, source: "the size labels" };
    }
  }

  if (!chart) {
    chart = standardChart(req.gender ?? "male");
    basisKind = "standard";
  }

  const rows = restrictToOffered(chart.rows, req.offered);
  const judged = rows
    .map((row, index) => {
      const verdict = judgeRow(row, req, chart.basis);
      return verdict ? { ...verdict, index } : null;
    })
    .filter((v): v is SizeVerdict => v !== null)
    .sort((a, b) => b.score - a.score);

  if (!judged.length) {
    return none(
      "Not enough to go on",
      basisKind === "chart"
        ? "This page's size chart doesn't cover the measurements we hold."
        : "Add your measurements in your profile and this fills in.",
    );
  }

  const best = judged[0];
  const second = judged[1];
  // Two sizes within a few points is a genuine choice, not a tie to break.
  const alternate = second && best.score - second.score < 12 ? second.size : undefined;

  const coverage = measurementCoverage(req.body);
  const confidence: FitAdvice["confidence"] =
    basisKind === "chart" && coverage >= 0.66 && best.score >= 70
      ? "high"
      : best.score >= 55 && coverage >= 0.33
        ? "medium"
        : "low";

  return {
    recommended: best.size,
    alternate,
    confidence,
    basis: basisKind,
    sizes: judged,
    headline: `${best.size} — ${best.verdict}`,
    detail: explain(best, chart, basisKind, alternate),
    missing,
  };
}

/**
 * The sentence under the headline. It has one job: say which measurement
 * decided it, because "M" with no reason is a guess and "M — 3cm of room
 * across the chest" is advice.
 */
function explain(
  best: SizeVerdict,
  chart: SizeChart,
  basisKind: FitAdvice["basis"],
  alternate?: string,
): string {
  const lead = best.dims[0];
  const where = basisKind === "chart"
    ? `${chart.source ?? "the shop"}'s ${chart.basis === "body" ? "fit" : "garment"} chart`
    : "standard sizing";

  const parts: string[] = [];

  if (lead) {
    const off = Math.abs(lead.deviation);
    // A body chart states the body it fits, so the gap is between you and the
    // size. A garment chart states the garment, so the gap is between the ease
    // it has and the ease that cut is supposed to have. Same number, two quite
    // different sentences — saying "than that cut usually does" about a body
    // chart would be describing a comparison we never made.
    const against = chart.basis === "body" ? "this size" : "that cut";
    if (off <= 1.5) {
      parts.push(`Lands on your ${lead.label} almost exactly`);
    } else if (lead.deviation < 0) {
      parts.push(
        `Runs ${off.toFixed(1)}cm closer through the ${lead.label} than ${against} allows for`,
      );
    } else {
      parts.push(
        `Leaves ${off.toFixed(1)}cm more room through the ${lead.label} than ${against} allows for`,
      );
    }
  }

  parts.push(`according to ${where}`);

  let sentence = parts.join(", ") + ".";
  if (alternate) {
    sentence += ` ${alternate} is close — take it if you want the looser one.`;
  }
  if (basisKind === "standard") {
    sentence += " This page published no size chart, so that is high-street standard sizing rather than the shop's own.";
  } else if (chart.basisStated === false) {
    sentence += ` We read that chart as ${chart.basis} measurements; the page didn't say which.`;
  }
  return sentence;
}
