/**
 * ═══════════════════════════════════════════════════════════════════════════
 *  Store adapters
 * ═══════════════════════════════════════════════════════════════════════════
 *
 *  The content script runs on every site now, so this file has two jobs:
 *
 *    1. `isProduct()` — is this actually a product page? With universal
 *       injection this is the gate that keeps us quiet on blogs, listings and
 *       everything else. It is deliberately conservative.
 *    2. `gallery()` + `upgrade()` — where the photographs are, and how to
 *       rewrite a thumbnail URL into the full-size original.
 *
 *  Adapters are chosen by hostname first, then by `probe()` for platforms that
 *  aren't tied to a domain (Shopify, WooCommerce — which is most of the long
 *  tail of clothing stores), then `generic` as the floor.
 *
 *  (2) matters more than it looks. Every one of these platforms serves a small
 *  thumbnail in the DOM; feeding that to VTO produces mush. The size lives in
 *  the URL, so the original is one substitution away.
 * ═══════════════════════════════════════════════════════════════════════════
 */
globalThis.RZ = globalThis.RZ || {};

(() => {
  const q = (sel) => {
    try {
      return Array.from(document.querySelectorAll(sel));
    } catch {
      return []; // a bad selector on one adapter shouldn't kill detection
    }
  };

  const meta = (prop) =>
    document.querySelector(`meta[property="${prop}"], meta[name="${prop}"]`)
      ?.content || "";

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

  function imagesFrom(selectors) {
    const out = [];
    for (const sel of selectors) {
      for (const img of q(sel)) {
        const url =
          fromSrcset(img.getAttribute("srcset")) || img.currentSrc || img.src;
        if (url && !url.startsWith("data:")) out.push(url);
      }
      // Plenty of galleries paint slides as CSS backgrounds rather than <img>.
      for (const node of q(sel)) {
        const bg = getComputedStyle(node).backgroundImage;
        const hit = bg && bg !== "none" && bg.match(/url\(["']?(.*?)["']?\)/)?.[1];
        if (hit) out.push(hit);
      }
    }
    return out;
  }

  /* ── the universal "is this a product page" gate ───────────────────────── */

  const CART_CONTROLS = [
    'form[action*="/cart/add"]',
    'button[name="add"]',
    '[id*="AddToCart" i]',
    '[class*="add-to-cart" i]',
    '[class*="addtocart" i]',
    '[data-testid*="add-to-cart" i]',
    'button[type="submit"][name="add"]',
  ].join(",");

  function looksLikeProduct() {
    // Structured data is the strongest signal and costs one querySelectorAll.
    if (document.querySelector('script[type="application/ld+json"]')) {
      for (const tag of q('script[type="application/ld+json"]')) {
        if (/"@type"\s*:\s*"?\[?[^]]*Product/i.test(tag.textContent || "")) {
          return true;
        }
      }
    }
    if (/product/i.test(meta("og:type"))) return true;
    if (document.querySelector('[itemtype*="schema.org/Product" i]')) return true;
    if (/\/(products?|product-detail|item|dp|p|buy|gp\/product)\//.test(location.pathname)) {
      return true;
    }
    if (document.querySelector(CART_CONTROLS)) return true;
    return false;
  }

  /* ── adapters ──────────────────────────────────────────────────────────── */

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
        ]),
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
      upgrade: (u) =>
        u.replace(/\/image\/\d+\/\d+\//, "/image/832/832/").replace(/[?&]q=\d+/, "?q=90"),
    },

    {
      id: "ajio",
      label: "AJIO",
      test: (h) => /(^|\.)ajio\.com$/.test(h),
      isProduct: () => /\/p\/\d+/.test(location.pathname),
      gallery: () =>
        imagesFrom([".img-responsive", ".prod-image img", "img[src*='assets.ajio']"]),
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
      gallery: () =>
        imagesFrom(["picture img", ".product-detail-main-image-container img"]),
      upgrade: (u) => u.replace(/([?&])imwidth=\d+/, "$1imwidth=1260"),
    },

    {
      // Not a domain — a platform. This is most independent clothing labels,
      // which is exactly the case the hardcoded shop list used to miss.
      id: "shopify",
      label: "",
      test: () => false,
      probe: () =>
        Boolean(
          window.Shopify ||
            document.querySelector('script[src*="cdn.shopify.com"], link[href*="cdn.shopify.com"]') ||
            document.querySelector('[class*="shopify" i]') ||
            /\/cdn\/shop\//.test(document.documentElement.innerHTML.slice(0, 200000)),
        ),
      isProduct: () =>
        /\/products\//.test(location.pathname) || looksLikeProduct(),
      gallery: () =>
        imagesFrom([
          ".product__media img",
          ".product-single__photo img",
          "[class*='product__media'] img",
          "[class*='product-gallery'] img",
          "[class*='ProductGallery'] img",
          "[data-product-single-media-wrapper] img",
          "img[src*='/cdn/shop/']",
          "img[src*='cdn.shopify.com']",
          "img[srcset*='/cdn/shop/']",
        ]),
      // Shopify encodes size two ways: a `_400x` style suffix before the
      // extension, and a `width=` query param. Neutralise both.
      upgrade: (u) =>
        u
          .replace(
            /_(\d+x\d*|pico|icon|thumb|small|compact|medium|large|grande|original|master)(_crop_[a-z]+)?(?=\.(jpe?g|png|webp|avif))/i,
            "",
          )
          // Raise the width, never lower it — some galleries already ask for
          // 1920 and stepping that down would be a downgrade, not an upgrade.
          .replace(/([?&])width=(\d+)/i, (m, sep, w) =>
            Number(w) < 1600 ? `${sep}width=1600` : m,
          )
          .replace(/([?&])height=\d+/i, "$1"),
    },

    {
      id: "woocommerce",
      label: "",
      test: () => false,
      probe: () =>
        document.body?.classList.contains("woocommerce") ||
        Boolean(document.querySelector(".woocommerce-product-gallery, body.single-product")),
      isProduct: () =>
        Boolean(document.querySelector(".woocommerce-product-gallery")) ||
        looksLikeProduct(),
      gallery: () =>
        imagesFrom([
          ".woocommerce-product-gallery img",
          ".woocommerce-product-gallery__image img",
        ]),
      // Woo appends "-600x600" before the extension for its generated sizes.
      upgrade: (u) => u.replace(/-\d+x\d+(?=\.(jpe?g|png|webp|avif))/i, ""),
    },

    {
      id: "generic",
      label: "",
      test: () => true,
      isProduct: looksLikeProduct,
      gallery: () =>
        imagesFrom([
          "[class*='gallery' i] img",
          "[class*='product' i] img",
          "[class*='carousel' i] img",
          "[data-testid*='image' i] img",
          "picture img",
          "main img",
          "article img",
        ]),
      upgrade: (u) => u,
    },
  ];

  const GENERIC = SITES[SITES.length - 1];

  RZ.sites = {
    /**
     * The adapter for this page. Hostname match wins; then platform probes;
     * then the generic floor. Never null.
     */
    current() {
      const host = location.hostname;
      const byHost = SITES.find((s) => s.id !== "generic" && s.test(host));
      if (byHost) return byHost;

      for (const s of SITES) {
        try {
          if (s.probe?.()) return s;
        } catch {
          /* a probe that throws just doesn't match */
        }
      }
      return GENERIC;
    },
    /** Adapter by id. Lets the harness exercise a shop's rules off-site. */
    byId: (id) => SITES.find((s) => s.id === id) || null,
    looksLikeProduct,
    fromSrcset,
  };
})();
