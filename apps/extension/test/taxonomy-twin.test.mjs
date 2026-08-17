import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import test from "node:test";
import assert from "node:assert/strict";

/**
 * The classifier exists twice.
 *
 * apps/extension/src/lib/taxonomy.js runs in a content script and ships as
 * plain JS in an IIFE; apps/web/lib/garment-kind.ts runs on the server and in
 * the upload dock. Neither can import the other, so the rule table is copied —
 * a deliberate trade against building a shared package for twenty regexes.
 *
 * This test is the price of that decision. It parses the rule table out of
 * both files and asserts they still agree, so "a jacket is outerwear" cannot
 * quietly become true in one half of the product and false in the other.
 *
 * It reads the TypeScript as text rather than importing it: no TS toolchain in
 * this runner, and the rule table is a flat literal, so text is enough.
 */

const here = dirname(fileURLToPath(import.meta.url));
const EXT_FILE = resolve(here, "../src/lib/taxonomy.js");
const WEB_FILE = resolve(here, "../../web/lib/garment-kind.ts");

/**
 * Pulls `{ re: /…/i, label: "…", zone: "…", vto: … }` out of a source file.
 * Both copies write the table in this shape; a rule that stops matching this
 * pattern would drop out of the comparison silently, so the count is asserted
 * too.
 */
function parseRules(source) {
  const RULE = /re:\s*(\/(?:\\.|\[(?:\\.|[^\]])*\]|[^/])+\/[a-z]*)\s*,\s*[\s\S]*?label:\s*"([^"]+)"\s*,\s*zone:\s*"([^"]+)"\s*,\s*vto:\s*(?:"([^"]+)"|null)/g;
  const out = [];
  for (const m of source.matchAll(RULE)) {
    out.push({ re: m[1], label: m[2], zone: m[3], vto: m[4] ?? null });
  }
  return out;
}

const extension = parseRules(readFileSync(EXT_FILE, "utf8"));
const web = parseRules(readFileSync(WEB_FILE, "utf8"));

test("the classifier's two copies still agree", async (t) => {
  await t.test("both tables parsed", () => {
    assert.ok(
      extension.length >= 18,
      `only parsed ${extension.length} rules from taxonomy.js — has the shape changed?`,
    );
    assert.equal(
      web.length,
      extension.length,
      "the two rule tables have different lengths",
    );
  });

  await t.test("rules match, in order", () => {
    for (let i = 0; i < extension.length; i++) {
      assert.deepEqual(
        web[i],
        extension[i],
        `rule ${i} differs between the two copies:\n` +
          `  extension: ${JSON.stringify(extension[i])}\n` +
          `  web:       ${JSON.stringify(web[i])}`,
      );
    }
  });

  // Order is the logic — "denim jacket" must hit outerwear before bottoms —
  // so a reordering is a behaviour change even when every rule is present.
  await t.test("outerwear is still tested before bottoms", () => {
    for (const table of [extension, web]) {
      const outer = table.findIndex((r) => r.label === "Outerwear");
      const bottom = table.findIndex((r) => r.label === "Bottom");
      assert.ok(outer >= 0 && bottom >= 0, "expected both rules to exist");
      assert.ok(outer < bottom, "outerwear must be classified before bottoms");
    }
  });
});
