/**
 * ═══════════════════════════════════════════════════════════════════════════
 *  Per-shop adapters
 * ═══════════════════════════════════════════════════════════════════════════
 *
 *  Two jobs each:
 *    1. `gallery()`  — where the product photographs live on this site
 *    2. `upgrade()`  — rewrite a thumbnail URL to the full-resolution original
 *
 *  (2) matters more than it looks. Every one of these sites serves a 128px
 *  thumbnail in the DOM; feeding that to VTO produces mush. Each CDN encodes
 *  its size in the URL, so the full-size original is one string substitution
 *  away — no extra requests, no scraping of a hi-res gallery.
 *
 *  Anything not listed falls through to `generic`, which reads JSON-LD and
 *  OpenGraph. That covers most Shopify/WooCommerce storefronts for free.
 * ═══════════════════════════════════════════════════════════════════════════
 */
globalThis.RZ = globalThis.RZ || {};

(() => {
  const q = (sel) => Array.from(document.querySelectorAll(sel));

  /** Largest URL in a srcset, by declared width. */
  function fromSrcset(srcset) {
    if (!srcset) return null;
    let best = null;
    let bestW = 0;
    for (const part of srcset.split(",")) {
      const [url, size] = part.trim().split(/\s+/);
      const w = size?.endsWith("w") ? parseInt(size) : 0;
      if (url && w >= bestW) {
        bestW = w;
        best = url;
      }
    }
    return best;
  }

  /** Every plausible product image an <img> on this page points at. */
  function imagesFrom(selectors) {
    const out = [];
    for (const sel of selectors) {
      for (const img of q(sel)) {
        const url = fromSrcset(img.getAttribute("srcset")) || img.currentSrc || img.src;
        if (url && !url.startsWith("data:")) out.push(url);
      }
    }
    return out;
  }

  const SITES = [
    {
      id: "amazon",
      label: "Amazon",
      test: (h) => /(^|\.)amazon\./.test(h),
      isProduct: () => /\/(dp|gp\/product)\//.test(location.pathname),
      gallery: () =>
        imagesFrom([
          "#altImages img",
          "#imgTagWrapperId img",
          "#landingImage",
          "#main-image-container img",
          "#imageBlock img",
        ]),
      // ".../I/71abc._AC_UY327_FMwebp_QL65_.jpg" → ".../I/71abc.jpg"
      // Amazon's size directives all live in that one dotted segment.
      upgrade: (u) => u.replace(/\._[A-Z0-9_,]+_\.(jpg|jpeg|png|webp)/i, ".$1"),
    },

    {
      id: "myntra",
      label: "Myntra",
      test: (h) => /(^|\.)myntra\.com$/.test(h),
      isProduct: () => /\/\d+\/buy\/?$/.test(location.pathname),
      gallery: () =>
        imagesFrom([
          ".image-grid-image",
          ".image-grid-imageContainer img",
          ".pdp-image img",
          ".common-image img",
        ]).concat(
          // Myntra paints most of the gallery as CSS background-images.
          q(".image-grid-image")
            .map((n) => getComputedStyle(n).backgroundImage)
            .map((bg) => bg?.match(/url\(["']?(.*?)["']?\)/)?.[1])
            .filter(Boolean),
        ),
      // "dpr_1.5,q_60,w_210,c_limit" → "q_90,w_1080,c_limit"
      upgrade: (u) =>
        u
          .replace(/dpr_[\d.]+,?/g, "")
          .replace(/\bw_\d+/g, "w_1080")
          .replace(/\bh_\d+/g, "h_1440")
          .replace(/\bq_\d+/g, "q_90"),
    },

    {
      id: "flipkart",
      label: "Flipkart",
      test: (h) => /(^|\.)flipkart\.com$/.test(h),
      isProduct: () => /\/p\//.test(location.pathname),
      gallery: () => imagesFrom(["img[src*='rukminim']", "img[srcset*='rukminim']"]),
      // "rukminim2.flixcart.com/image/128/128/…?q=70" → "/image/832/832/…?q=90"
      upgrade: (u) =>
        u.replace(/\/image\/\d+\/\d+\//, "/image/832/832/").replace(/[?&]q=\d+/, "?q=90"),
    },

    {
      id: "ajio",
      label: "AJIO",
      test: (h) => /(^|\.)ajio\.com$/.test(h),
      isProduct: () => /\/p\/\d+/.test(location.pathname),
      gallery: () => imagesFrom([".img-responsive", ".prod-image img", "img[src*='assets.ajio']"]),
      upgrade: (u) => u.replace(/-\d+Wx\d+H-/, "-1117Wx1400H-"),
    },

    {
      id: "zara",
      label: "Zara",
      test: (h) => /(^|\.)zara\.com$/.test(h),
      isProduct: () => /-p\d+\.html/.test(location.pathname),
      gallery: () => imagesFrom(["picture img", ".media-image__image"]),
      upgrade: (u) => u.replace(/([?&])w=\d+/, "$1w=1024"),
    },

    {
      id: "hm",
      label: "H&M",
      test: (h) => /(^|\.)hm\.com$/.test(h),
      isProduct: () => /productpage|\/product\//.test(location.pathname),
      gallery: () => imagesFrom(["picture img", ".product-detail-main-image-container img"]),
      upgrade: (u) => u.replace(/\[?fit=[^&]*/, "").replace(/([?&])imwidth=\d+/, "$1imwidth=1260"),
    },

    {
      id: "generic",
      label: "",
      test: () => true,
      isProduct: () => true,
      gallery: () =>
        imagesFrom([
          "[class*='gallery'] img",
          "[class*='product'] img",
          "[data-testid*='image'] img",
          "main img",
        ]),
      upgrade: (u) => u,
    },
  ];

  RZ.sites = {
    /** The adapter for the page we're on. Never null — `generic` catches all. */
    current() {
      const host = location.hostname;
      return SITES.find((s) => s.id !== "generic" && s.test(host)) ||
        SITES[SITES.length - 1];
    },
    /** Adapter by id. Lets the harness exercise a shop's rules off-site. */
    byId: (id) => SITES.find((s) => s.id === id) || null,
    fromSrcset,
  };
})();
