/**
 * ═══════════════════════════════════════════════════════════════════════════
 *  What sizes does this page sell, and does it publish a chart?
 * ═══════════════════════════════════════════════════════════════════════════
 *
 *  Scraping only. Nothing here decides anything — it collects the raw table
 *  cells and the size labels, and the server works out what they mean
 *  (apps/web/lib/fit.ts, and the tests that go with it).
 *
 *  That split is not tidiness. The user's measurements are the most personal
 *  thing Rangrez holds, and a content script runs inside the shop's page: any
 *  script the shop loads could read anything this file could read. So the
 *  body never comes down here. We send up a size chart that was already
 *  public on the page and get back a letter.
 *
 *  ── on finding the chart ─────────────────────────────────────────────────
 *
 *  Almost every shop hides its size chart behind a "Size guide" link, in a
 *  modal that does not exist in the DOM until it is clicked. We do not click
 *  it — silently opening a shop's modals on someone's behalf is not ours to
 *  do. What we take is what is already there: any <table> on the page, plus
 *  the increasingly common grid-of-divs version, plus JSON-LD `size`. When
 *  there is nothing, the server falls back to standard sizing and says so.
 * ═══════════════════════════════════════════════════════════════════════════
 */
globalThis.RZ = globalThis.RZ || {};

(() => {
  const MAX_TABLES = 6;
  const MAX_ROWS = 40;
  const MAX_COLS = 16;
  const MAX_SIZES = 40;

  const text = (node) =>
    String(node?.textContent ?? "").replace(/\s+/g, " ").trim().slice(0, 40);

  /** Words that mean a control is a size picker rather than a colour picker. */
  const SIZE_ATTR = /size/i;
  /** What a size label looks like: S, XXL, 32, UK 10, 7.5, 28W. */
  const SIZE_LABEL = /^(?:x{0,3}[sl]|m|xs|s|l|free|one\s?size|\d{1,2}(?:\.\d)?[a-z]{0,2}|(?:uk|us|eu|w)\s?\d{1,2}(?:\.\d)?)$/i;

  /** A table's headers must mention at least one of these to be worth sending. */
  const CHART_HINT = /\b(size|chest|bust|waist|hip|shoulder|length|inseam|sleeve|uk|us|eu)\b/i;

  /* ── the sizes on offer ──────────────────────────────────────────────── */

  /**
   * Every size the page shows, in DOM order, minus the ones it has crossed out.
   *
   * Out-of-stock detection is best-effort by design: recommending a size that
   * cannot be bought is a mild annoyance, while filtering too aggressively and
   * recommending nothing is a broken feature. So an element only counts as
   * unavailable when it says so unambiguously.
   */
  function sizes() {
    const found = [];
    const seen = new Set();

    const add = (label, available) => {
      const clean = label.trim();
      if (!clean || clean.length > 14) return;
      if (!SIZE_LABEL.test(clean)) return;
      const key = clean.toUpperCase();
      if (seen.has(key)) return;
      seen.add(key);
      found.push({ label: clean, available });
    };

    // 1 · a real <select>, which is what a Shopify theme ships by default
    for (const select of document.querySelectorAll("select")) {
      const context = [
        select.name, select.id, select.className,
        select.getAttribute("aria-label"),
        select.closest("label")?.textContent,
      ].join(" ");
      if (!SIZE_ATTR.test(context)) continue;
      for (const option of select.options) {
        add(text(option), !option.disabled);
      }
    }

    // 2 · the buttons-and-chips version, which is what everyone else ships
    const chips = document.querySelectorAll(
      "[class*='size' i] button, [class*='size' i] li, [class*='size' i] label," +
        "[id*='size' i] button, [id*='size' i] li," +
        "button[class*='size' i], li[class*='size' i]",
    );
    for (const chip of chips) {
      const label = text(chip);
      if (!label) continue;

      // The selectors above match both a wrapper and the control inside it,
      // and the wrapper comes first in document order — so a <li> would claim
      // the label before the <button disabled> it contains ever got looked at,
      // and every sold-out size read as in stock. Resolve to the innermost
      // control first, then ask it.
      const control =
        chip.matches("button, input, select, option")
          ? chip
          : chip.querySelector("button, input") ?? chip;

      const flat = [
        control.className,
        control.getAttribute("aria-label"),
        // A shop may equally well grey out the wrapper and leave the button
        // alone, so the class hint is taken from both.
        chip.className,
      ].join(" ");

      const unavailable =
        control.disabled === true ||
        control.getAttribute("aria-disabled") === "true" ||
        chip.getAttribute("aria-disabled") === "true" ||
        Boolean(control.closest("[aria-disabled='true']")) ||
        /\b(sold[\s-]?out|unavailable|out[\s-]?of[\s-]?stock|disabled)\b/i.test(flat);

      add(label, !unavailable);
      if (found.length >= MAX_SIZES) break;
    }

    return found.slice(0, MAX_SIZES);
  }

  /* ── the chart ───────────────────────────────────────────────────────── */

  /** Text around a table — where "to fit" and "measured flat" tend to live. */
  function contextAround(node) {
    const parts = [
      node.querySelector("caption")?.textContent,
      node.previousElementSibling?.textContent,
      node.parentElement?.previousElementSibling?.textContent,
      node.closest("section, div[class*='size' i], div[class*='chart' i]")
        ?.querySelector("h1, h2, h3, h4, p")?.textContent,
    ];
    return parts
      .filter(Boolean)
      .join(" · ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 400);
  }

  function fromTableElement(node) {
    const rows = Array.from(node.rows ?? []).slice(0, MAX_ROWS + 1);
    if (rows.length < 3) return null;

    const grid = rows.map((row) =>
      Array.from(row.cells).slice(0, MAX_COLS).map(text),
    );

    // The header is the first row that has any text in it. A <thead> would be
    // nicer and roughly half of these tables don't have one.
    const headerAt = grid.findIndex((r) => r.some(Boolean));
    if (headerAt < 0) return null;

    const headers = grid[headerAt];
    if (!CHART_HINT.test(headers.join(" "))) return null;

    const body = grid.slice(headerAt + 1).filter((r) => r.some(Boolean));
    if (body.length < 2) return null;

    return { headers, rows: body, context: contextAround(node) };
  }

  /**
   * The grid-of-divs size chart.
   *
   * A lot of modern storefronts build the chart out of divs with `role="row"`
   * and `role="cell"`, or out of a CSS grid with no roles at all. The first
   * case is worth handling because the roles tell us the shape exactly; the
   * second is not, because guessing a table out of arbitrary divs produces
   * confident nonsense far more often than it produces a chart.
   */
  function fromAriaGrid(node) {
    const rows = Array.from(node.querySelectorAll("[role='row']")).slice(
      0,
      MAX_ROWS + 1,
    );
    if (rows.length < 3) return null;

    const grid = rows.map((row) =>
      Array.from(row.querySelectorAll("[role='cell'], [role='columnheader'], [role='rowheader']"))
        .slice(0, MAX_COLS)
        .map(text),
    );

    const headers = grid[0] ?? [];
    if (!headers.length || !CHART_HINT.test(headers.join(" "))) return null;

    const body = grid.slice(1).filter((r) => r.some(Boolean));
    if (body.length < 2) return null;

    return { headers, rows: body, context: contextAround(node) };
  }

  function tables() {
    const out = [];
    for (const node of document.querySelectorAll("table")) {
      const table = fromTableElement(node);
      if (table) out.push(table);
      if (out.length >= MAX_TABLES) return out;
    }
    for (const node of document.querySelectorAll("[role='table'], [role='grid']")) {
      const table = fromAriaGrid(node);
      if (table) out.push(table);
      if (out.length >= MAX_TABLES) return out;
    }
    return out;
  }

  /* ── the copy that describes the cut ─────────────────────────────────── */

  /**
   * Title plus whatever the page says about fit and fabric.
   *
   * Bounded hard: this is sent to our own server, and a product description
   * can be tens of kilobytes of care instructions. 1200 characters is enough
   * to catch "Slim Fit" in a title and "2% elastane" in a composition line.
   */
  function copy() {
    const bits = [
      document.querySelector("h1")?.textContent,
      document.title,
      ...Array.from(
        document.querySelectorAll(
          "[class*='fit' i], [class*='composition' i], [class*='fabric' i]," +
            "[class*='material' i], [class*='description' i]",
        ),
      )
        .slice(0, 8)
        .map((n) => n.textContent),
    ];
    return bits
      .filter(Boolean)
      .join(" · ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 1200);
  }

  RZ.sizing = {
    /**
     * Everything the fit route needs, gathered in one pass.
     * @returns {{sizes: {label:string, available:boolean}[], tables: object[], text: string}}
     */
    read() {
      try {
        return { sizes: sizes(), tables: tables(), text: copy() };
      } catch (err) {
        // A shop with an exotic DOM must not be able to take the try-on down
        // over the fit advice, which is the smaller half of the feature.
        console.debug("[rangrez] couldn't read sizing", err);
        return { sizes: [], tables: [], text: "" };
      }
    },
  };
})();
