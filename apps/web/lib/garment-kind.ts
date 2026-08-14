import type { VtoTarget } from "./youcam";
import type { Zone } from "./types";

/**
 * ═══════════════════════════════════════════════════════════════════════════
 *  What is this garment?
 * ═══════════════════════════════════════════════════════════════════════════
 *
 *  The extension runs this against a product title and breadcrumb trail. The
 *  dashboard runs it against a filename — "black-denim-jacket.jpg" is a
 *  surprisingly good classifier input, because people name photographs after
 *  what is in them.
 *
 *  ⚠ This is a deliberate twin of apps/extension/src/lib/taxonomy.js. The
 *  extension ships plain JS into a content-script IIFE and cannot import from
 *  here; keeping two copies of one table is the lesser evil against building a
 *  shared package to hold twenty regexes. If you change a rule, change both —
 *  the tests in apps/extension/test pin the extension's copy.
 *
 *  The order of the rules IS the logic: a "denim jacket" must be read as
 *  outerwear before the denim rule claims it as a bottom, and a "dress shirt"
 *  must be read as a top before the dress rule claims it as a one-piece.
 * ═══════════════════════════════════════════════════════════════════════════
 */

export interface Kind {
  label: string;
  zone: Zone;
  /** null means YouCam genuinely has no surface for it (eyewear, belts). */
  vto: VtoTarget | null;
}

interface Rule extends Kind {
  re: RegExp;
}

const RULES: Rule[] = [
  // ── exceptions, first, or the general rules below would eat them ──────
  { re: /\bdress\s+shirt(s)?\b/i,  label: "Shirt",     zone: "top",       vto: "upper_body" },
  { re: /\bshirt\s+dress(es)?\b/i, label: "Dress",     zone: "top",       vto: "full_body"  },
  { re: /\b(short|long|half|full|three.quarter|3\/4)[\s-]*sleeve/i,
                                   label: "Top",       zone: "top",       vto: "upper_body" },
  { re: /\btrack\s*(pant|suit)/i,  label: "Trackpant", zone: "bottom",    vto: "lower_body" },

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

  // ── worn objects: their own YouCam surfaces ──────────────────────────
  { re: /\b(shoes?|sneakers?|trainers?|boots?|sandals?|heels?|loafers?|flip[\s-]?flops?|slippers?|derby|oxfords?|mules?|espadrilles?|sliders?|clogs?|footwear)\b/i,
                                   label: "Shoes",     zone: "shoes",     vto: "shoes"    },
  { re: /\b(bags?|handbags?|backpacks?|rucksacks?|totes?|clutch(es)?|purses?|satchels?|slings?|duffels?)\b/i,
                                   label: "Bag",       zone: "accessory", vto: "bag"      },
  { re: /\b(caps?|hats?|beanies?|beanie|bucket\s*hat|snapback|fedora|visor)\b/i,
                                   label: "Hat",       zone: "accessory", vto: "hat"      },

  // ── jewellery: the 2d-vto family ─────────────────────────────────────
  { re: /\b(chains?|necklaces?|pendants?|chokers?|mangalsutra)\b/i,
                                   label: "Chain",     zone: "accessory", vto: "necklace" },
  { re: /\b(earrings?|studs?|jhumkas?|hoops?)\b/i,
                                   label: "Earrings",  zone: "accessory", vto: "earring"  },
  { re: /\b(bracelets?|bangles?|anklets?|kadas?|cuffs?)\b/i,
                                   label: "Bracelet",  zone: "accessory", vto: "bracelet" },
  { re: /\bwatch(es)?\b/i,         label: "Watch",     zone: "accessory", vto: "watch"    },
  { re: /\brings?\b/i,             label: "Ring",      zone: "accessory", vto: "ring"     },

  // ── recognised, but genuinely no surface exists ──────────────────────
  { re: /\b(sunglass(es)?|eyewear|goggles?|spectacles?|frames?)\b/i,
                                   label: "Eyewear",   zone: "accessory", vto: null },
  { re: /\b(belts?|wallets?|scarf|scarves|stole|ties?|socks?|gloves?|brooch|jewell?ery)\b/i,
                                   label: "Accessory", zone: "accessory", vto: null },
];

/**
 * Best guess from free text. Never returns null — an upload the classifier
 * can't read is still a garment the user chose to add, so it falls through to
 * a top, which is both the commonest case and the safest VTO surface.
 */
export function classify(text: string): Kind {
  const haystack = String(text || "").replace(/[_\-.]+/g, " ").replace(/\s+/g, " ");
  for (const rule of RULES) {
    if (rule.re.test(haystack)) {
      return { label: rule.label, zone: rule.zone, vto: rule.vto };
    }
  }
  return { label: "Piece", zone: "top", vto: "upper_body" };
}

/**
 * Every rail the upload dock offers, in the order it offers them. Accessories
 * are listed by what they actually are rather than as one bucket, because the
 * YouCam surface differs per kind — a watch and a necklace are not the same
 * request, and asking the user once here beats guessing wrong at render time.
 */
export const UPLOAD_KINDS: Array<{ id: string; label: string } & Kind> = [
  { id: "top",       label: "Top",       zone: "top",       vto: "upper_body" },
  { id: "bottom",    label: "Bottom",    zone: "bottom",    vto: "lower_body" },
  { id: "outerwear", label: "Outerwear", zone: "outerwear", vto: "upper_body" },
  { id: "onepiece",  label: "One-piece", zone: "top",       vto: "full_body"  },
  { id: "shoes",     label: "Shoes",     zone: "shoes",     vto: "shoes"      },
  { id: "bag",       label: "Bag",       zone: "accessory", vto: "bag"        },
  { id: "hat",       label: "Hat",       zone: "accessory", vto: "hat"        },
  { id: "necklace",  label: "Chain",     zone: "accessory", vto: "necklace"   },
  { id: "earring",   label: "Earrings",  zone: "accessory", vto: "earring"    },
  { id: "bracelet",  label: "Bracelet",  zone: "accessory", vto: "bracelet"   },
  { id: "watch",     label: "Watch",     zone: "accessory", vto: "watch"      },
  { id: "ring",      label: "Ring",      zone: "accessory", vto: "ring"       },
];

/** Which dock chip a classifier result should land on. */
export function kindIdFor(kind: Kind): string {
  return (
    UPLOAD_KINDS.find((k) => k.vto === kind.vto && k.zone === kind.zone)?.id ??
    "top"
  );
}
