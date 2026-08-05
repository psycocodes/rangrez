/**
 * ═══════════════════════════════════════════════════════════════════════════
 *  What is this garment?
 * ═══════════════════════════════════════════════════════════════════════════
 *
 *  Runs against the product title, breadcrumb trail and JSON-LD category. The
 *  order of the rules IS the logic: a "denim jacket" must be read as outerwear
 *  before the denim rule claims it as a bottom, and a "dress shirt" must be
 *  read as a top before the dress rule claims it as a one-piece.
 *
 *  Classification decides three things:
 *    · whether we show the button at all (no garment term → not a clothes page)
 *    · which Apparel VTO category the render is requested under
 *    · which zone the piece lands in if the user saves it to the wardrobe
 * ═══════════════════════════════════════════════════════════════════════════
 */
globalThis.RZ = globalThis.RZ || {};

(() => {
  /**
   * `vto` is the Apparel VTO category, or null where the API simply cannot
   * help — shoes and jewellery are recognised on purpose so the panel can say
   * so, rather than spending a call to fail.
   *
   * `zone` maps onto the wardrobe's five rails. One-pieces have no rail of
   * their own yet, so they hang with the tops and carry the detail in the
   * material line.
   */
  const RULES = [
    // ── exceptions, first, or the general rules below would eat them ──────
    { re: /\bdress\s+shirt(s)?\b/i,            label: "Shirt",     zone: "top",       vto: "upper_body" },
    { re: /\bshirt\s+dress(es)?\b/i,           label: "Dress",     zone: "top",       vto: "full_body"  },
    { re: /\b(short|long|half|full|three.quarter|3\/4)[\s-]*sleeve/i,
                                               label: "Top",       zone: "top",       vto: "upper_body" },
    { re: /\btrack\s*(pant|suit)/i,            label: "Trackpant", zone: "bottom",    vto: "lower_body" },

    // ── one-piece ────────────────────────────────────────────────────────
    { re: /\b(dress(es)?|gown|frock|jumpsuit|playsuit|romper|dungaree|overall)s?\b/i,
                                               label: "Dress",     zone: "top",       vto: "full_body"  },
    { re: /\b(saree|sari|lehenga|anarkali|kaftan|caftan|abaya|kimono|co[\s-]?ord|salwar|kameez|churidar)\b/i,
                                               label: "One-piece", zone: "top",       vto: "full_body"  },

    // ── outerwear, before bottoms so "denim jacket" resolves correctly ───
    { re: /\b(jacket|blazer|coat|overcoat|trench|parka|bomber|anorak|windcheater|windbreaker|puffer|gilet|waistcoat|shrug|poncho|cape)s?\b/i,
                                               label: "Outerwear", zone: "outerwear", vto: "upper_body" },

    // ── bottoms ──────────────────────────────────────────────────────────
    { re: /\b(jeans?|trousers?|pants?|chinos?|shorts?|skirts?|leggings?|jeggings?|joggers?|palazzos?|culottes?|cargos?|pyjamas?|pajamas?|dhoti|capri)\b/i,
                                               label: "Bottom",    zone: "bottom",    vto: "lower_body" },

    // ── tops ─────────────────────────────────────────────────────────────
    { re: /\b(t[\s-]?shirts?|tees?|shirts?|tops?|blouses?|kurtas?|kurtis?|sweat(er|shirt)s?|hoodies?|pullovers?|jumpers?|cardigans?|polos?|tanks?|camisoles?|bodysuits?|vests?|crop\s*top)\b/i,
                                               label: "Top",       zone: "top",       vto: "upper_body" },

    // ── recognised, but Apparel VTO can't dress a body with them ─────────
    { re: /\b(shoes?|sneakers?|trainers?|boots?|sandals?|heels?|loafers?|flip[\s-]?flops?|slippers?|derby|oxfords?|mules?|espadrilles?|sliders?|clogs?)\b/i,
                                               label: "Shoes",     zone: "shoes",     vto: null },
    { re: /\b(chains?|necklaces?|bracelets?|rings?|earrings?|pendants?|anklets?|brooch|jewell?ery|watch(es)?|belts?|bags?|backpacks?|wallets?|clutch(es)?|purses?|totes?|sunglass(es)?|goggles?|caps?|hats?|beanie|scarf|scarves|stole|ties?|socks?|gloves?)\b/i,
                                               label: "Accessory", zone: "accessory", vto: null },
  ];

  /** Words that mean "this page is about clothes" even without a noun match. */
  const CONTEXT = /\b(clothing|apparel|fashion|menswear|womenswear|western\s*wear|ethnic\s*wear|innerwear|topwear|bottomwear|activewear|loungewear)\b/i;

  RZ.taxonomy = {
    /**
     * @param {string} haystack title + breadcrumbs + category, concatenated
     * @returns {{label:string, zone:string, vto:string|null, matched:string}|null}
     */
    classify(haystack) {
      const text = String(haystack || "").replace(/\s+/g, " ");
      for (const rule of RULES) {
        const hit = text.match(rule.re);
        if (hit) {
          return {
            label: rule.label,
            zone: rule.zone,
            vto: rule.vto,
            matched: hit[0].trim(),
          };
        }
      }
      // A clothing-context page with no recognisable noun is still worth an
      // offer — we just can't promise which rail it belongs on.
      if (CONTEXT.test(text)) {
        return { label: "Garment", zone: "top", vto: "upper_body", matched: "apparel" };
      }
      return null;
    },

    /** Human sentence for the panel when VTO can't help. */
    unsupportedReason(label) {
      if (label === "Shoes") {
        return "Apparel VTO dresses a body — it doesn't fit shoes yet.";
      }
      return "Apparel VTO dresses a body — it doesn't hang jewellery or bags yet.";
    },
  };
})();
