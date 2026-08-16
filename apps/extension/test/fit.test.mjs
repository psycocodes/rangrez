import test from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

/**
 * The fit engine.
 *
 * Imported straight out of the web app as TypeScript — node strips the types.
 * lib/fit.ts is written with no runtime imports and no path aliases precisely
 * so that works: the sizing maths is the one piece of this product that is
 * pure enough to test properly, so it gets tested properly.
 *
 * What these assert is not "the numbers I happened to get". It's the handful
 * of things that would make the feature actively wrong:
 *
 *   · recommending a size that doesn't close across the chest
 *   · reading a garment chart as a body chart (two sizes too small, every time)
 *   · confidently sizing someone whose measurements we don't have
 *   · parsing a delivery-times table as if it were a size chart
 */

const here = dirname(fileURLToPath(import.meta.url));
const fit = await import(resolve(here, "../../web/lib/fit.ts"));

/** 98cm chest, 84 waist — an ordinary M in most houses. */
const BODY = {
  unit: "cm",
  chestCm: 98,
  waistCm: 84,
  hipCm: 99,
  shoulderCm: 45,
  inseamCm: 79,
  footEu: 42,
};

/* ── standard sizing, when a page has no chart ───────────────────────────── */

test("sizes an ordinary chest to M off standard sizing", () => {
  const advice = fit.recommendSize({ body: BODY, category: "upper", cut: "regular" });
  assert.equal(advice.recommended, "M");
  assert.equal(advice.basis, "standard");
  assert.equal(advice.sizes[0].verdict, "true to size");
});

test("a slim cut in the same size reads tighter than a relaxed one", () => {
  const chart = {
    basis: "garment",
    basisStated: true,
    rows: [{ size: "M", chestCm: 110, shoulderCm: 46 }],
  };
  const slim = fit.recommendSize({ body: BODY, category: "upper", cut: "slim", chart });
  const relaxed = fit.recommendSize({ body: BODY, category: "upper", cut: "relaxed", chart });

  // 12cm of ease is roomy for a slim cut and about right for a relaxed one.
  const order = fit.VERDICT_ORDER;
  assert.ok(
    order.indexOf(slim.sizes[0].verdict) > order.indexOf(relaxed.sizes[0].verdict),
    `slim read as "${slim.sizes[0].verdict}", relaxed as "${relaxed.sizes[0].verdict}" — ` +
      "the same garment must read looser on the tighter cut",
  );
});

test("preferring tailored moves the recommendation down a size", () => {
  // A regular upper wants +14cm of ease, so M at 112 is dead centre for a
  // 98cm chest. The fixture is built around that on purpose: the test is
  // about the preference moving the answer, so the neutral answer has to be
  // unambiguous first.
  const chart = {
    basis: "garment",
    basisStated: true,
    rows: [
      { size: "S", chestCm: 106 },
      { size: "M", chestCm: 112 },
      { size: "L", chestCm: 118 },
    ],
  };
  const regular = fit.recommendSize({ body: BODY, category: "upper", chart, preference: "regular" });
  const tailored = fit.recommendSize({ body: BODY, category: "upper", chart, preference: "tailored" });
  const roomy = fit.recommendSize({ body: BODY, category: "upper", chart, preference: "relaxed" });

  assert.equal(regular.recommended, "M");
  assert.equal(tailored.recommended, "S");
  assert.equal(roomy.recommended, "L");
});

test("stretch forgives a tight garment but never flatters a loose one", () => {
  const tight = { basis: "garment", basisStated: true, rows: [{ size: "M", chestCm: 102 }] };
  const loose = { basis: "garment", basisStated: true, rows: [{ size: "M", chestCm: 124 }] };

  const tightNone = fit.recommendSize({ body: BODY, category: "upper", chart: tight, stretch: "none" });
  const tightHigh = fit.recommendSize({ body: BODY, category: "upper", chart: tight, stretch: "high" });
  assert.ok(tightHigh.sizes[0].score > tightNone.sizes[0].score);

  const looseNone = fit.recommendSize({ body: BODY, category: "upper", chart: loose, stretch: "none" });
  const looseHigh = fit.recommendSize({ body: BODY, category: "upper", chart: loose, stretch: "high" });
  assert.ok(looseHigh.sizes[0].score <= looseNone.sizes[0].score);
});

test("too tight is punished harder than equally too loose", () => {
  const chart = {
    basis: "garment",
    basisStated: true,
    // Regular upper wants +14cm ease. These are 8cm under and 8cm over it.
    rows: [{ size: "TIGHT", chestCm: 104 }, { size: "LOOSE", chestCm: 120 }],
  };
  const advice = fit.recommendSize({ body: BODY, category: "upper", chart });
  const tight = advice.sizes.find((s) => s.size === "TIGHT");
  const loose = advice.sizes.find((s) => s.size === "LOOSE");
  assert.ok(loose.score > tight.score, "a garment you cannot close is worse than one that drapes");
});

/* ── the basis problem ───────────────────────────────────────────────────── */

test("a garment chart read as a body chart would size two down — so it isn't", () => {
  // Same letters, garment measurements: every row sits ~15cm above the body
  // it is cut for, which is what a regular fit looks like as a flat number.
  const rows = [
    { size: "S", chestCm: 106 },
    { size: "M", chestCm: 112 },
    { size: "L", chestCm: 118 },
    { size: "XL", chestCm: 124 },
  ];

  const asGarment = fit.recommendSize({
    body: BODY,
    category: "upper",
    chart: { basis: "garment", basisStated: true, rows },
  });
  const asBody = fit.recommendSize({
    body: BODY,
    category: "upper",
    chart: { basis: "body", basisStated: true, rows },
  });

  assert.equal(asGarment.recommended, "M");
  // Read as body measurements the same table says "you are an S", because a
  // body chart is asking which row *is* you rather than which row has room
  // for you. That is the failure this whole distinction exists to prevent.
  assert.equal(asBody.recommended, "S");
});

test("a body chart already prices in the cut and the stretch", () => {
  // "Our slim shirt in M fits a 96-101cm chest" has the slimness and the
  // elastane in it already. Adding our own ease on top double-counts the
  // shop's homework — this reported a dead-centre M as 3cm roomy.
  const chart = {
    basis: "body",
    basisStated: true,
    rows: [
      { size: "S", chestCm: 93.5 },
      { size: "M", chestCm: 98.5 },
      { size: "L", chestCm: 103.5 },
    ],
  };
  const body = { unit: "cm", chestCm: 98 };

  for (const extra of [
    {},
    { cut: "slim" },
    { cut: "oversized" },
    { stretch: "high" },
    { cut: "slim", stretch: "high" },
  ]) {
    const advice = fit.recommendSize({ body, category: "upper", chart, ...extra });
    assert.equal(advice.recommended, "M", `${JSON.stringify(extra)} moved a body chart`);
    assert.ok(
      Math.abs(advice.sizes[0].dims[0].deviation) < 1,
      `${JSON.stringify(extra)} skewed the deviation to ${advice.sizes[0].dims[0].deviation}`,
    );
  }
});

test("a preference nudges a body chart without overruling it", () => {
  const chart = {
    basis: "body",
    basisStated: true,
    rows: [
      { size: "S", chestCm: 93.5 },
      { size: "M", chestCm: 98.5 },
      { size: "L", chestCm: 103.5 },
    ],
  };

  // Dead centre of the M: no preference should be able to move it.
  const centred = { unit: "cm", chestCm: 98 };
  for (const preference of ["tailored", "regular", "relaxed"]) {
    assert.equal(
      fit.recommendSize({ body: centred, category: "upper", chart, preference }).recommended,
      "M",
      `${preference} overruled a chart that was not close`,
    );
  }

  // Borderline between M and L: now the preference gets to decide.
  const between = { unit: "cm", chestCm: 101 };
  assert.equal(
    fit.recommendSize({ body: between, category: "upper", chart, preference: "relaxed" }).recommended,
    "L",
  );
  assert.equal(
    fit.recommendSize({ body: between, category: "upper", chart, preference: "tailored" }).recommended,
    "M",
  );
});

test("infers a garment chart from numbers that sit above standard bodies", () => {
  const chart = fit.parseSizeChart({
    headers: ["Size", "Chest (cm)"],
    rows: [["S", "103"], ["M", "109"], ["L", "114"], ["XL", "119"]],
  });
  assert.equal(chart.basis, "garment");
  assert.equal(chart.basisStated, false);
});

test("infers a body chart from numbers that match standard bodies", () => {
  const chart = fit.parseSizeChart({
    headers: ["Size", "Chest (cm)"],
    rows: [["S", "91"], ["M", "97"], ["L", "102"], ["XL", "107"]],
  });
  assert.equal(chart.basis, "body");
});

test("believes the page when it says which", () => {
  const stated = fit.parseSizeChart({
    context: "To fit chest",
    headers: ["Size", "Chest"],
    rows: [["S", "103"], ["M", "109"], ["L", "114"]],
  });
  assert.equal(stated.basis, "body");
  assert.equal(stated.basisStated, true);
});

/* ── reading a shop's table ──────────────────────────────────────────────── */

test("parses a plain centimetre chart", () => {
  const chart = fit.parseSizeChart({
    headers: ["Size", "Chest (cm)", "Waist (cm)", "Shoulder (cm)"],
    rows: [
      ["S", "96", "80", "43"],
      ["M", "101", "85", "45"],
      ["L", "106", "90", "47"],
    ],
  });
  assert.equal(chart.rows.length, 3);
  assert.equal(chart.rows[1].chestCm, 101);
  assert.equal(chart.rows[1].shoulderCm, 45);
});

test("converts an inch chart without being told", () => {
  const chart = fit.parseSizeChart({
    headers: ["Size", "Chest", "Waist"],
    rows: [["S", "36", "30"], ["M", "38", "32"], ["L", "40", "34"]],
  });
  // 38in ≈ 96.5cm. Read as centimetres this would have been a child's chart.
  assert.ok(Math.abs(chart.rows[1].chestCm - 96.5) < 0.6, `got ${chart.rows[1].chestCm}`);
});

test("takes the midpoint of a range and remembers the span", () => {
  const chart = fit.parseSizeChart({
    context: "To fit body measurements",
    headers: ["Size", "Chest (cm)"],
    rows: [["S", "86-91"], ["M", "92 – 97"], ["L", "98 to 103"]],
  });
  assert.equal(chart.rows[1].chestCm, 94.5);
  assert.deepEqual(chart.rows[1].ranges.chestCm, [92, 97]);
});

test("reads a chart that was printed on its side", () => {
  const chart = fit.parseSizeChart({
    headers: ["", "S", "M", "L"],
    rows: [
      ["Chest (cm)", "96", "101", "106"],
      ["Waist (cm)", "80", "85", "90"],
    ],
  });
  assert.deepEqual(chart.rows.map((r) => r.size), ["S", "M", "L"]);
  assert.equal(chart.rows[1].chestCm, 101);
});

test("refuses a table that isn't a size chart", () => {
  assert.equal(
    fit.parseSizeChart({
      headers: ["Region", "Delivery", "Cost"],
      rows: [["Metro", "2-3 days", "Free"], ["Rest of India", "4-6 days", "₹49"]],
    }),
    null,
  );
  assert.equal(fit.parseSizeChart({ headers: ["Size"], rows: [["M"]] }), null);
  assert.equal(
    fit.parseSizeChart({ headers: ["Size", "Chest"], rows: [["M", "101"]] }),
    null,
    "one row is not a chart — there is nothing to choose between",
  );
});

/* ── jeans ───────────────────────────────────────────────────────────────── */

test("a numeric waist size carries its own measurements", () => {
  assert.ok(Math.abs(fit.numericWaistRow("32").waistCm - 81.3) < 0.2);
  const row = fit.numericWaistRow("W32 L34");
  assert.ok(Math.abs(row.waistCm - 81.3) < 0.2);
  assert.ok(Math.abs(row.inseamCm - 86.4) < 0.2);
  assert.equal(fit.numericWaistRow("M"), null);
  assert.equal(fit.numericWaistRow("99"), null, "not a waist any human has");
});

test("sizes jeans off the labels alone when there is no chart", () => {
  const advice = fit.recommendSize({
    body: BODY,
    category: "lower",
    offered: ["30", "32", "34", "36"],
  });
  // 84cm is 33in — between the two, and it rounds up. A 32 would run 2.7cm
  // tight and a 34 runs 2.4cm loose; you can belt a loose waistband and you
  // cannot let out a tight one, which is exactly the asymmetry the scoring
  // encodes. Every denim size guide gives the same answer.
  assert.equal(advice.recommended, "34");
  assert.equal(advice.alternate, "32", "32 is close enough to be worth offering");
  assert.equal(advice.basis, "chart");
});

/* ── only recommending what the shop sells ───────────────────────────────── */

test("never recommends a size the page doesn't offer", () => {
  const advice = fit.recommendSize({
    body: BODY,
    category: "upper",
    offered: ["L", "XL", "XXL"],
  });
  assert.ok(["L", "XL", "XXL"].includes(advice.recommended));
  assert.equal(advice.sizes.length, 3);
});

test("falls back to the whole chart when nothing offered matches it", () => {
  const advice = fit.recommendSize({
    body: BODY,
    category: "upper",
    offered: ["ONE SIZE"],
  });
  assert.equal(advice.recommended, "M");
});

/* ── shoes ───────────────────────────────────────────────────────────────── */

test("picks the nearest shoe size", () => {
  const advice = fit.recommendSize({
    body: BODY,
    category: "shoes",
    chart: { basis: "body", rows: [{ size: "41", footEu: 41 }, { size: "42", footEu: 42 }, { size: "43", footEu: 43 }] },
  });
  assert.equal(advice.recommended, "42");
});

test("asks for a shoe size rather than guessing one", () => {
  const advice = fit.recommendSize({
    body: { unit: "cm", chestCm: 98 },
    category: "shoes",
  });
  assert.equal(advice.recommended, undefined);
  assert.equal(advice.basis, "none");
});

/* ── knowing when not to answer ──────────────────────────────────────────── */

test("declines rather than guessing with no measurements at all", () => {
  const advice = fit.recommendSize({ body: { unit: "cm" }, category: "upper" });
  assert.equal(advice.recommended, undefined);
  assert.equal(advice.confidence, "low");
  assert.deepEqual(advice.missing, ["Chest", "Waist", "Hip"]);
});

test("accessories have no size to pick", () => {
  const advice = fit.recommendSize({ body: BODY, category: "none" });
  assert.equal(advice.recommended, undefined);
  assert.match(advice.detail, /one size/i);
});

test("confidence tracks how much we actually know", () => {
  const chart = {
    basis: "body",
    basisStated: true,
    rows: [{ size: "S", chestCm: 91 }, { size: "M", chestCm: 97 }, { size: "L", chestCm: 102 }],
  };
  const full = fit.recommendSize({ body: BODY, category: "upper", chart });
  const partial = fit.recommendSize({
    body: { unit: "cm", chestCm: 98 },
    category: "upper",
    chart,
  });
  assert.equal(full.confidence, "high");
  assert.notEqual(partial.confidence, "high");
  assert.ok(partial.missing.length > 0);
});

test("offers the runner-up only when it is genuinely close", () => {
  const close = fit.recommendSize({
    body: { unit: "cm", chestCm: 99.5 },
    category: "upper",
    chart: {
      basis: "body",
      basisStated: true,
      rows: [{ size: "M", chestCm: 97 }, { size: "L", chestCm: 102 }],
    },
  });
  assert.ok(close.alternate, "half way between two sizes should offer both");

  const clear = fit.recommendSize({
    body: { unit: "cm", chestCm: 97 },
    category: "upper",
    chart: {
      basis: "body",
      basisStated: true,
      rows: [{ size: "M", chestCm: 97 }, { size: "XXL", chestCm: 112 }],
    },
  });
  assert.equal(clear.alternate, undefined);
});

/* ── reading the cut off a product title ─────────────────────────────────── */

test("reads the cut out of a product title", () => {
  assert.equal(fit.cutFromText("Men's Slim Fit Oxford Shirt"), "slim");
  assert.equal(fit.cutFromText("Oversized Boxy Tee"), "oversized");
  assert.equal(fit.cutFromText("Relaxed Fit Chino"), "relaxed");
  assert.equal(fit.cutFromText("Regular Fit Poplin Shirt"), "regular");
  assert.equal(fit.cutFromText("Wide-Leg Pleated Trouser"), "relaxed");
  assert.equal(fit.cutFromText("Cotton Shirt"), undefined, "no claim is not a claim");
});

test("oversized beats relaxed, and an explicit regular fit beats a stray slim", () => {
  // A boxy oversized tee is not merely loose.
  assert.equal(fit.cutFromText("Loose Oversized Sweatshirt"), "oversized");
  // "Slim collar" describes the collar, not the shirt.
  assert.equal(fit.cutFromText("Regular Fit Slim Collar Shirt"), "regular");
});

test("reads stretch off the fabric, not the marketing", () => {
  assert.equal(fit.stretchFromText("4-way stretch performance chino"), "high");
  assert.equal(fit.stretchFromText("98% cotton, 2% elastane"), "some");
  assert.equal(fit.stretchFromText("12% elastane knit"), "high");
  assert.equal(fit.stretchFromText("Stretch denim"), "some");
  assert.equal(fit.stretchFromText("100% cotton rigid denim"), "none");
  assert.equal(fit.stretchFromText("Linen shirt"), undefined);
});

test("the cut it reads actually changes the size it picks", () => {
  const chart = {
    basis: "garment",
    basisStated: true,
    rows: [
      { size: "S", chestCm: 104 },
      { size: "M", chestCm: 112 },
      { size: "L", chestCm: 122 },
      { size: "XL", chestCm: 130 },
    ],
  };
  const slim = fit.recommendSize({
    body: BODY, category: "upper", chart,
    cut: fit.cutFromText("Slim Fit Shirt"),
  });
  const oversized = fit.recommendSize({
    body: BODY, category: "upper", chart,
    cut: fit.cutFromText("Oversized Boxy Shirt"),
  });
  assert.equal(slim.recommended, "S");
  assert.equal(oversized.recommended, "XL");
});

/* ── the form ────────────────────────────────────────────────────────────── */

test("reads inches into centimetres and rejects nonsense", () => {
  assert.ok(Math.abs(fit.readMeasurement("chestCm", "38", "in") - 96.5) < 0.1);
  assert.equal(fit.readMeasurement("chestCm", "98", "cm"), 98);
  assert.equal(fit.readMeasurement("chestCm", "", "cm"), undefined);
  assert.equal(fit.readMeasurement("chestCm", "0", "cm"), undefined);
  assert.equal(fit.readMeasurement("chestCm", "-5", "cm"), undefined);
  assert.equal(fit.readMeasurement("chestCm", "980", "cm"), undefined, "out of bounds");
  assert.equal(fit.readMeasurement("chestCm", "banana", "cm"), undefined);
});

test("weight and shoe size are never unit-converted", () => {
  assert.equal(fit.readMeasurement("weightKg", "72", "in"), 72);
  assert.equal(fit.readMeasurement("footEu", "42", "in"), 42);
});

test("every advice path returns a headline and a detail", () => {
  const cases = [
    { body: BODY, category: "upper" },
    { body: BODY, category: "lower" },
    { body: BODY, category: "shoes" },
    { body: BODY, category: "none" },
    { body: { unit: "cm" }, category: "upper" },
  ];
  for (const c of cases) {
    const advice = fit.recommendSize(c);
    assert.ok(advice.headline.length > 0, `no headline for ${c.category}`);
    assert.ok(advice.detail.length > 0, `no detail for ${c.category}`);
    assert.ok(!/undefined|NaN/.test(advice.headline + advice.detail),
      `leaked a placeholder: ${advice.headline} / ${advice.detail}`);
  }
});
