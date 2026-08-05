/**
 * Pure-logic checks for the two pieces most likely to break silently:
 * garment classification, and the thumbnail→full-size URL rewrites.
 *
 *   node apps/extension/test/logic.test.mjs
 *
 * No DOM, no bundler, no dependencies — the extension has none, and its tests
 * shouldn't either. Everything DOM-shaped is verified in a live browser.
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import vm from "node:vm";

const here = dirname(fileURLToPath(import.meta.url));

/** Loads a content script into a sandbox with just enough browser to survive. */
function load(files, location) {
  const sandbox = {
    globalThis: null,
    location,
    document: {
      querySelectorAll: () => [],
      querySelector: () => null,
      title: "",
    },
    getComputedStyle: () => ({ backgroundImage: "" }),
    console,
  };
  sandbox.globalThis = sandbox;
  const ctx = vm.createContext(sandbox);
  for (const f of files) {
    vm.runInContext(readFileSync(join(here, "..", f), "utf8"), ctx, { filename: f });
  }
  return ctx.RZ;
}

let pass = 0;
let fail = 0;

function check(label, actual, expected) {
  const ok = actual === expected;
  if (ok) pass++;
  else fail++;
  console.log(
    `${ok ? "  ok  " : "  FAIL"}  ${label}${ok ? "" : `\n         expected: ${expected}\n         actual:   ${actual}`}`,
  );
}

/* ── 1 · classification ─────────────────────────────────────────────────── */

const RZ = load(["src/lib/taxonomy.js"], { hostname: "example.com" });
const zoneOf = (t) => RZ.taxonomy.classify(t)?.zone ?? "none";
const vtoOf = (t) => RZ.taxonomy.classify(t)?.vto ?? "none";

console.log("\nclassification");

// straightforward
check("men's cotton t-shirt", zoneOf("Roadster Men Blue Cotton T-shirt"), "top");
check("slim fit jeans", zoneOf("Levi's 511 Slim Fit Jeans"), "bottom");
check("women's midi dress", zoneOf("Zara Satin Midi Dress"), "top");
check("dress → full body", vtoOf("Zara Satin Midi Dress"), "full_body");
check("kurta", zoneOf("Libas Women Cotton Straight Kurta"), "top");
check("saree", vtoOf("Mitera Green Silk Blend Saree"), "full_body");

// the ordering traps — each of these is wrong if a rule fires out of turn
check("denim jacket is outerwear", zoneOf("Levi's Denim Trucker Jacket"), "outerwear");
check("dress shirt is a top", zoneOf("Van Heusen Formal Dress Shirt"), "top");
check("dress shirt is upper", vtoOf("Van Heusen Formal Dress Shirt"), "upper_body");
check("shirt dress is one-piece", vtoOf("Mango Striped Shirt Dress"), "full_body");
check("short sleeve shirt is a top", zoneOf("H&M Short Sleeve Resort Shirt"), "top");
check("track pants are bottoms", zoneOf("Nike Dri-FIT Track Pants"), "bottom");
check("shorts are bottoms", zoneOf("Puma Woven Training Shorts"), "bottom");

// worn objects and jewellery — each has its own YouCam surface
check("sneakers are shoes", zoneOf("Adidas Ultraboost Running Shoes"), "shoes");
check("sneakers → shoes surface", vtoOf("Adidas Ultraboost Running Shoes"), "shoes");
check("tote bag → bag surface", vtoOf("Caprese Leather Tote Bag"), "bag");
check("cap → hat surface", vtoOf("Nike Sportswear Heritage86 Cap"), "hat");
check("chain → necklace surface", vtoOf("Men's Stainless Steel Cuban Link Chain"), "necklace");
check("chain is an accessory", zoneOf("Men's Stainless Steel Cuban Link Chain"), "accessory");
check("jhumkas → earring surface", vtoOf("Oxidised Silver Jhumka Earrings"), "earring");
check("bangle → bracelet surface", vtoOf("Gold Plated Kada Bangle"), "bracelet");
check("watch → watch surface", vtoOf("Titan Neo Analog Watch"), "watch");
check("ring → ring surface", vtoOf("Sterling Silver Signet Ring"), "ring");

// genuinely no surface
check("sunglasses have no surface", vtoOf("Ray-Ban Aviator Sunglasses"), "none");
check("belt has no surface", vtoOf("Hidesign Reversible Leather Belt"), "none");

// not clothes at all → no offer
check("a laptop is not a garment", zoneOf("Dell Inspiron 15 Laptop, 16GB RAM"), "none");
check("a kettle is not a garment", zoneOf("Prestige 1.5L Electric Kettle"), "none");
check("a novel is not a garment", zoneOf("Sapiens: A Brief History of Humankind"), "none");

// context-only fallback
check("category page context", zoneOf("Men · Topwear · Western Wear"), "top");

/* ── 2 · thumbnail → full size ──────────────────────────────────────────── */

console.log("\nimage upgrades");

const upgradeOn = (hostname, url) => {
  const rz = load(["src/lib/sites.js"], { hostname, href: `https://${hostname}/x` });
  return rz.sites.current().upgrade(url);
};

check(
  "amazon strips the size directive",
  upgradeOn(
    "www.amazon.in",
    "https://m.media-amazon.com/images/I/71QKQ9mwV7L._AC_UY327_FMwebp_QL65_.jpg",
  ),
  "https://m.media-amazon.com/images/I/71QKQ9mwV7L.jpg",
);

check(
  "myntra widens and drops dpr",
  upgradeOn(
    "www.myntra.com",
    "https://assets.myntassets.com/dpr_1.5,q_60,w_210,c_limit,fl_progressive/assets/images/1/2/3/x.jpg",
  ),
  "https://assets.myntassets.com/q_90,w_1080,c_limit,fl_progressive/assets/images/1/2/3/x.jpg",
);

check(
  "flipkart bumps the tile size",
  upgradeOn(
    "www.flipkart.com",
    "https://rukminim2.flixcart.com/image/128/128/xif0q/shirt/a/b/c/x.jpeg?q=70",
  ),
  "https://rukminim2.flixcart.com/image/832/832/xif0q/shirt/a/b/c/x.jpeg?q=90",
);

check(
  "ajio swaps the dimension token",
  upgradeOn("www.ajio.com", "https://assets.ajio.com/medias/sys_master/root/x-473Wx593H-46.jpg"),
  "https://assets.ajio.com/medias/sys_master/root/x-1117Wx1400H-46.jpg",
);

const upgradeVia = (id, url) => {
  const rz = load(["src/lib/sites.js"], { hostname: "shop.test", href: "https://shop.test/x" });
  return rz.sites.byId(id).upgrade(url);
};

check(
  "shopify drops the _400x suffix",
  upgradeVia("shopify", "https://holyheaden.in/cdn/shop/files/jacket_400x.jpg?v=17"),
  "https://holyheaden.in/cdn/shop/files/jacket.jpg?v=17",
);
check(
  "shopify drops a named size",
  upgradeVia("shopify", "https://cdn.shopify.com/s/files/1/1/2/x_grande.jpg?v=9"),
  "https://cdn.shopify.com/s/files/1/1/2/x.jpg?v=9",
);
check(
  "shopify widens the width param",
  upgradeVia("shopify", "https://holyheaden.in/cdn/shop/files/a.jpg?v=1&width=300"),
  "https://holyheaden.in/cdn/shop/files/a.jpg?v=1&width=1600",
);
check(
  "woocommerce drops the generated size",
  upgradeVia("woocommerce", "https://shop.test/wp-content/uploads/2026/01/tee-600x600.jpg"),
  "https://shop.test/wp-content/uploads/2026/01/tee.jpg",
);
check(
  "unknown shop is left alone",
  upgradeOn("some-random-store.com", "https://cdn.shop/x_400x.jpg"),
  "https://cdn.shop/x_400x.jpg",
);

/* ── 3 · srcset ─────────────────────────────────────────────────────────── */

console.log("\nsrcset");

const rzGeneric = load(["src/lib/sites.js"], { hostname: "shop.test" });
check(
  "largest declared width wins",
  rzGeneric.sites.fromSrcset("a.jpg 200w, b.jpg 1200w, c.jpg 640w"),
  "b.jpg",
);
check("empty srcset is null", rzGeneric.sites.fromSrcset(""), null);

/* ── report ─────────────────────────────────────────────────────────────── */

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
