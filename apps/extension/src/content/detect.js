/**
 * ═══════════════════════════════════════════════════════════════════════════
 *  Is there a garment on this page, and where are its photographs?
 * ═══════════════════════════════════════════════════════════════════════════
 *
 *  Three sources, most trustworthy first:
 *    1. JSON-LD Product   — structured, and nearly every shop ships it
 *    2. OpenGraph tags    — coarse, but always present
 *    3. The site adapter  — DOM selectors, for the gallery the other two miss
 *
 *  We only surface the button when the taxonomy actually recognises a garment
 *  noun. A page that merely lives on a fashion domain is not enough — offering
 *  a try-on over a returns policy would be worse than staying quiet.
 * ═══════════════════════════════════════════════════════════════════════════
 */
globalThis.RZ = globalThis.RZ || {};

(() => {
  const MAX_CANDIDATES = 8;

  const meta = (prop) =>
    document.querySelector(`meta[property="${prop}"], meta[name="${prop}"]`)
      ?.content || "";

  /** Every JSON-LD node on the page, flattened out of @graph wrappers. */
  function jsonLdNodes() {
    const out = [];
    for (const tag of document.querySelectorAll('script[type="application/ld+json"]')) {
      let parsed;
      try {
        parsed = JSON.parse(tag.textContent || "");
      } catch {
        continue; // malformed JSON-LD is extremely common; just skip it
      }
      const stack = [parsed];
      while (stack.length) {
        const node = stack.pop();
        if (!node || typeof node !== "object") continue;
        if (Array.isArray(node)) {
          stack.push(...node);
          continue;
        }
        out.push(node);
        if (node["@graph"]) stack.push(node["@graph"]);
      }
    }
    return out;
  }

  function productNode(nodes) {
    return nodes.find((n) => {
      const t = n["@type"];
      const types = Array.isArray(t) ? t : [t];
      return types.some((x) => String(x).toLowerCase() === "product");
    });
  }

  /** Breadcrumb text is where the category usually hides on Indian shops. */
  function breadcrumbs(nodes) {
    const trail = nodes
      .filter((n) => String(n["@type"]).toLowerCase() === "breadcrumblist")
      .flatMap((n) => n.itemListElement || [])
      .map((el) => el?.name || el?.item?.name)
      .filter(Boolean);

    if (trail.length) return trail.join(" ");

    return Array.from(
      document.querySelectorAll(
        "[class*='breadcrumb'] a, [class*='Breadcrumb'] a, nav[aria-label*='readcrumb'] a",
      ),
    )
      .map((a) => a.textContent?.trim())
      .filter(Boolean)
      .join(" ");
  }

  function titleOf(product) {
    return (
      product?.name ||
      meta("og:title") ||
      document.querySelector("h1")?.textContent?.trim() ||
      document.title
    ).trim();
  }

  function brandOf(product) {
    const b = product?.brand;
    if (typeof b === "string") return b;
    if (b?.name) return b.name;
    return meta("og:site_name") || "";
  }

  /** Absolute, deduped, thumbnails rewritten to full size. */
  function normalise(urls, site) {
    const seen = new Set();
    const out = [];

    for (const raw of urls) {
      if (!raw) continue;
      let abs;
      try {
        abs = new URL(raw, location.href).toString();
      } catch {
        continue;
      }
      if (!/^https?:/.test(abs)) continue;
      // Sprites, spinners, badges and payment logos all live in the DOM too.
      if (/sprite|logo|placeholder|loader|spinner|icon|swatch/i.test(abs)) continue;

      const upgraded = site.upgrade(abs);
      if (seen.has(upgraded)) continue;
      seen.add(upgraded);
      out.push({ url: upgraded, thumb: abs });
    }

    return out.slice(0, MAX_CANDIDATES);
  }

  RZ.detect = function detect() {
    const site = RZ.sites.current();
    if (!site.isProduct()) return null;

    const nodes = jsonLdNodes();
    const product = productNode(nodes);

    const title = titleOf(product);
    if (!title) return null;

    // Everything the classifier gets to look at.
    const haystack = [
      title,
      brandOf(product),
      product?.category || "",
      breadcrumbs(nodes),
      meta("og:description").slice(0, 200),
      document.querySelector("h1")?.textContent || "",
    ].join(" · ");

    const category = RZ.taxonomy.classify(haystack);
    if (!category) return null;

    const ldImages = []
      .concat(product?.image || [])
      .map((i) => (typeof i === "string" ? i : i?.url))
      .filter(Boolean);

    const candidates = normalise(
      [...ldImages, meta("og:image"), ...site.gallery()],
      site,
    );
    if (!candidates.length) return null;

    return {
      site: { id: site.id, label: site.label || location.hostname.replace(/^www\./, "") },
      title,
      brand: brandOf(product),
      category,
      candidates,
      sourceUrl: location.href,
    };
  };
})();
