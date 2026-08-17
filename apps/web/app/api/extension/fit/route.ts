import { cors, preflight } from "@/lib/cors";
import { userFromRequest } from "@/lib/ext-token";
import {
  cutFromText,
  fitCategory,
  parseSizeChart,
  recommendSize,
  stretchFromText,
  type Cut,
  type FitCategory,
  type RawTable,
  type SizeChart,
} from "@/lib/fit";
import { ZONES, type Zone } from "@/lib/types";

export const OPTIONS = preflight;

/**
 * POST /api/extension/fit — which size, and why.
 *
 * The split of labour here is deliberate and is the reason this is a route at
 * all rather than a function in the content script:
 *
 *   the extension  scrapes. Messy, per-shop, DOM-shaped work: which tables on
 *                  this page might be a size chart, which sizes are in stock.
 *   this route     interprets. All of it, in one place, tested — see
 *                  lib/fit.ts and test/fit.test.mjs.
 *
 *   and, the point: **the body never leaves the server.** The extension asks
 *   "given this chart, what should they buy" and gets a letter back. It never
 *   holds the measurements, so a compromised content script on a shop's page
 *   has nothing to read, and no product page is ever in a position to learn
 *   the shape of the person browsing it.
 */

/** Bounds on what we will look at, because a page can hand us anything. */
const MAX_TABLES = 6;
const MAX_ROWS = 40;
const MAX_COLS = 16;
const MAX_CELL = 40;
const MAX_SIZES = 40;

interface Body {
  /** Wardrobe rail from the classifier — mapped to a fit category here. */
  zone?: string;
  /** Sizes the page actually offers, ideally only those in stock. */
  sizes?: string[];
  /** Every table on the page that might be a size chart. */
  tables?: RawTable[];
  /** Title plus any fit/fabric copy, for reading the cut off. */
  text?: string;
  /** Overrides the guess, if the page stated it outright. */
  cut?: string;
}

const CUTS_OK = new Set(["slim", "regular", "relaxed", "oversized"]);

/** Trims a scraped table down to something bounded before it is parsed. */
function clean(table: RawTable): RawTable | null {
  if (!table || typeof table !== "object") return null;
  const cell = (v: unknown) => String(v ?? "").slice(0, MAX_CELL).trim();

  const headers = Array.isArray(table.headers)
    ? table.headers.slice(0, MAX_COLS).map(cell)
    : [];
  const rows = Array.isArray(table.rows)
    ? table.rows
        .slice(0, MAX_ROWS)
        .map((r) => (Array.isArray(r) ? r.slice(0, MAX_COLS).map(cell) : []))
        .filter((r) => r.length)
    : [];

  if (!headers.length || !rows.length) return null;
  return { headers, rows, context: String(table.context ?? "").slice(0, 400) };
}

/**
 * Best of the candidate tables.
 *
 * A product page will hand us the size chart, a care-instructions table and a
 * delivery-times table with equal confidence. `parseSizeChart` rejects the
 * ones that aren't charts; between the survivors, more rows and more measured
 * columns is the better chart, because that is the one someone bothered to
 * fill in properly.
 */
function bestChart(tables: RawTable[]): SizeChart | null {
  let best: SizeChart | null = null;
  let bestScore = 0;

  for (const raw of tables.slice(0, MAX_TABLES)) {
    const table = clean(raw);
    if (!table) continue;

    let chart: SizeChart | null = null;
    try {
      chart = parseSizeChart(table);
    } catch {
      continue; // a malformed table is not worth failing the request over
    }
    if (!chart) continue;

    const measured = chart.rows.reduce(
      (n, row) => n + Object.keys(row).filter((k) => k !== "size" && k !== "ranges").length,
      0,
    );
    const score = chart.rows.length * 2 + measured + (chart.basisStated ? 5 : 0);
    if (score > bestScore) {
      bestScore = score;
      best = chart;
    }
  }

  return best;
}

export async function POST(req: Request) {
  const user = await userFromRequest(req);
  if (!user) {
    return cors({ error: "Not connected.", code: "no-token" }, { status: 401 });
  }

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return cors({ error: "Expected JSON." }, { status: 400 });
  }

  const zone: Zone = ZONES.includes(body.zone as Zone) ? (body.zone as Zone) : "top";
  const category: FitCategory = fitCategory(zone);

  const text = String(body.text ?? "").slice(0, 2000);
  const claimed = String(body.cut ?? "");
  const cut: Cut | undefined = CUTS_OK.has(claimed)
    ? (claimed as Cut)
    : cutFromText(text);

  const sizes = Array.isArray(body.sizes)
    ? body.sizes
        .slice(0, MAX_SIZES)
        .map((s) => String(s ?? "").slice(0, 14).trim())
        .filter(Boolean)
    : [];

  const chart = bestChart(Array.isArray(body.tables) ? body.tables : []);

  const advice = recommendSize({
    body: user.measurements,
    category,
    cut,
    stretch: stretchFromText(text),
    preference: user.preferences.fitPreference,
    chart,
    offered: sizes,
    gender: user.preferences.vtoGender ?? "male",
  });

  return cors({
    advice,
    /**
     * The chart we actually read, handed back so that saving the piece can
     * store it alongside. Without this the extension would have to re-scrape
     * and re-parse at save time — and a size chart is a property of the
     * garment, not of the page it happened to be on. Six months later the
     * page may be gone and the wardrobe should still know what an M was.
     */
    chart,
    // Echoed so the panel can say what it worked from — "we read the shop's
    // chart" and "we guessed from standard sizing" deserve different wording,
    // and the user deserves to know which one they got.
    read: {
      cut: cut ?? null,
      chartRows: chart?.rows.length ?? 0,
      chartBasis: chart?.basis ?? null,
      offered: sizes.length,
    },
    /** So the panel can offer a link when there is nothing to go on yet. */
    needsMeasurements: advice.missing.length > 0,
  });
}
