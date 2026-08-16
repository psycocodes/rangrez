/**
 * ═══════════════════════════════════════════════════════════════════════════
 *  Photographs for the starter wardrobe
 * ═══════════════════════════════════════════════════════════════════════════
 *
 *  The seed pieces used to be drawn — SVG flat-lays in each item's catalogued
 *  dye. That was right when the alternative was stock photography of a
 *  typewriter on a card reading "Raw Denim Straight", and wrong the moment you
 *  wanted to *try one on*: Apparel VTO cannot decode a drawing, so every
 *  starter piece was a piece the point of the product couldn't be tested with.
 *
 *  This takes product photographs out of assets/clothes/, cuts the garment out
 *  of each with lib/garment-cut.ts — the same pipeline a shop page goes
 *  through — and writes them to public/seed/ as PNGs with a real alpha
 *  channel, so a card tints itself around the piece instead of framing a white
 *  rectangle.
 *
 *  ── adding more ─────────────────────────────────────────────────────────
 *
 *  Drop a file in assets/clothes/ named after the piece it is a photograph of:
 *  `raw-denim-straight.jpg`, `leather-derby.png`. Anything before the first
 *  dot is read as the name, so `cropped-trench.jpg.webp` works too. Then:
 *
 *      node scripts/seed-photos.mjs                 cut everything in there
 *      node scripts/seed-photos.mjs --sync-db       …and update existing rows
 *
 *  It prints what is still unphotographed when it finishes. An automated
 *  sweep of a stock library was tried first and is not coming back: with no
 *  human in the loop it filled the wardrobe with an abstract pattern, two
 *  people in a garden and a watch on a notebook. One good photograph chosen by
 *  someone beats twenty-six found by a scoring function.
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { createHash } from "node:crypto";
import { readdirSync, readFileSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { extractGarment } from "../lib/garment-cut.ts";
import { classify } from "../lib/garment-kind.ts";

const here = dirname(fileURLToPath(import.meta.url));
const web = resolve(here, "..");
const IN_DIR = resolve(web, "../extension/assets/clothes");
const OUT_DIR = resolve(web, "public/seed");

/**
 * Files whose names say nothing about what they are photographs of.
 *
 * A retailer's CDN calls a photograph `p2994477.jpg`, and there is no reading
 * that back. Anything named after its piece skips this entirely; this is only
 * for what is already sitting in the folder.
 */
const ALIASES = {
  "1_6b8140c5": "raw-denim-straight",
  chriscross: "boxy-heavyweight-tee",
  istockphoto: "quilted-bomber",
  p2994477: "canvas-low-top",
};

const slug = (s) =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

/**
 * The item list, read out of lib/seed.ts.
 *
 * Parsed rather than duplicated: two lists of twenty-six garments drift within
 * a week, and the failure is silent — a piece renamed in one place and not the
 * other simply stops having a photograph.
 */
function items() {
  const source = readFileSync(resolve(web, "lib/seed.ts"), "utf8");
  const found = [...source.matchAll(/\{\s*name:\s*"([^"]+)",\s*zone:\s*"(\w+)"/g)].map(
    ([, name]) => ({ name, slug: slug(name) }),
  );
  if (found.length < 10) {
    throw new Error("Couldn't read the item list out of lib/seed.ts — reformatted?");
  }
  return found;
}

/** Which seed piece is this file a photograph of? */
function match(file, known) {
  const stem = slug(file.split(".")[0]);
  if (known.has(stem)) return stem;
  for (const [fragment, target] of Object.entries(ALIASES)) {
    if (stem.includes(slug(fragment))) return target;
  }
  return null;
}

async function main() {
  const args = process.argv.slice(2);
  const known = new Map(items().map((i) => [i.slug, i.name]));
  mkdirSync(OUT_DIR, { recursive: true });

  // Written fresh every run, so a photograph swapped out in assets/clothes
  // doesn't leave its cutout behind under a name nothing points at any more.
  rmSync(OUT_DIR, { recursive: true, force: true });
  mkdirSync(OUT_DIR, { recursive: true });

  const manifest = {};
  const files = readdirSync(IN_DIR).filter((f) => /\.(jpe?g|png|webp|avif)$/i.test(f));

  for (const file of files) {
    const seed = match(file, known);
    if (!seed) {
      console.log(`  ${file} — can't tell what this is; rename it after a piece`);
      continue;
    }

    // The same classifier a shop page goes through, so a coat is framed as a
    // coat here for the same reason it is there.
    const target = classify(known.get(seed)).vto ?? "full_body";
    const cut = await extractGarment(readFileSync(resolve(IN_DIR, file)), target);
    if (!cut) {
      console.log(`  ${seed.padEnd(26)} — couldn't cut a garment out of that one`);
      continue;
    }

    // The filename carries a hash of the bytes in it, and that is not
    // decoration. Swap the photograph behind a stable name like
    // `/seed/quilted-bomber.png` and every layer in front of it goes on
    // serving the old one — next/image keys its optimised copies by URL, the
    // browser keys its cache by URL, and the database row is the same string
    // it always was. A leather jacket stayed on screen through three correct
    // rebuilds that way. Content-addressed, the URL changes when the picture
    // changes, and nothing anywhere has a stale copy to hand back.
    const stamp = createHash("sha256").update(cut.bytes).digest("hex").slice(0, 8);
    const name = `${seed}.${stamp}.png`;

    writeFileSync(resolve(OUT_DIR, name), cut.bytes);
    manifest[seed] = { file: `/seed/${name}`, hex: cut.dominantColor, source: file };
    console.log(
      `  ${seed.padEnd(26)} ${cut.dominantColor}  ${(cut.bytes.length / 1024) | 0}kB  ${stamp}`,
    );
  }

  writeManifest(manifest);

  const missing = [...known.keys()].filter((s) => !manifest[s]);
  console.log(`\n${Object.keys(manifest).length} photographed, ${missing.length} still drawn:`);
  console.log(`  ${missing.join("  ")}`);

  if (args.includes("--sync-db")) await sync(manifest);
}

function writeManifest(manifest) {
  const sorted = Object.fromEntries(Object.entries(manifest).sort());
  writeFileSync(
    resolve(web, "lib/seed-photos.ts"),
    `import type { SeedPhoto } from "./types";

/**
 * GENERATED — do not edit. \`node scripts/seed-photos.mjs\` writes this.
 *
 * One entry per photographed starter piece: where the cutout lives, and the
 * colour measured off it. The colour is here rather than in lib/seed.ts
 * because the card tints itself from the garment's dye, and a card in Turmeric
 * holding a photograph of a black jacket is worse than either alone.
 *
 * Pieces with no entry fall back to the drawn art in lib/garment-art.ts.
 */
export const SEED_PHOTOS: Record<string, SeedPhoto> = ${JSON.stringify(sorted, null, 2)};
`,
  );
}

/**
 * Rewrites the starter rows already sitting in the database.
 *
 * lib/seed.ts only runs at sign-up, so without this the person who has been
 * developing against this account since day one is the one person who never
 * sees the change. Matched on `seed` — the slug each starter row carries —
 * and scoped to `origin = 'seed'`, so nothing anybody uploaded is touched.
 */
async function sync(manifest) {
  const env = Object.fromEntries(
    readFileSync(resolve(web, ".env.local"), "utf8")
      .split("\n")
      .filter((l) => l.includes("=") && !l.trim().startsWith("#"))
      .map((l) => [
        l.slice(0, l.indexOf("=")).trim(),
        l.slice(l.indexOf("=") + 1).trim().replace(/^["']|["']$/g, ""),
      ]),
  );

  const base = env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "");
  const key = env.SUPABASE_SECRET_KEY;
  if (!base || !key) throw new Error("No Supabase URL/secret in .env.local");

  const { nearestDye } = await import("../lib/dyes.ts");
  const headers = {
    apikey: key,
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
    Prefer: "return=representation",
  };

  let rows = 0;
  for (const [seed, photo] of Object.entries(manifest)) {
    const res = await fetch(
      `${base}/rest/v1/rangrez_garments?origin=eq.seed&seed=eq.${seed}&select=id`,
      {
        method: "PATCH",
        headers,
        body: JSON.stringify({
          image_url: photo.file,
          dye: nearestDye(photo.hex),
          // The drawn version was never on a body, and the photograph isn't
          // the same garment as whatever was rendered from it. Clearing this
          // puts the piece back to "not tried on yet", which is the truth.
          try_on_url: null,
          status: "rendered",
        }),
      },
    );
    if (res.ok) rows += (await res.json()).length;
    else console.warn(`  ${seed}: ${(await res.json()).message}`);
  }
  console.log(`${rows} starter rows updated in the database`);
}

await main();
