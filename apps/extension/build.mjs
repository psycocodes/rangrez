/**
 * Packs the extension for both browsers.
 *
 *   node apps/extension/build.mjs          → dist/chrome, dist/firefox
 *   node apps/extension/build.mjs --zip    → also dist/rangrez-{chrome,firefox}.zip
 *
 * There is one source tree. The only thing that differs between targets is the
 * manifest — Chrome runs the background in a service worker, Firefox in an
 * event page — so this copies the same `src/` and `assets/` into both and drops
 * the right manifest on top. Anything that behaves differently at runtime is
 * handled by `src/lib/api.js`, not by forking a file.
 *
 * Chrome doesn't need this at all: `apps/extension` loads unpacked as-is.
 * It exists for Firefox, and for producing store uploads.
 */

import { cp, mkdir, readFile, rm, writeFile, readdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const root = dirname(fileURLToPath(import.meta.url));
const dist = join(root, "dist");
const zip = process.argv.includes("--zip");

/** Everything that ships. `test/` and `dist/` never do. */
const PAYLOAD = ["src", "assets"];

const TARGETS = [
  { name: "chrome", manifest: "manifest.json" },
  { name: "firefox", manifest: "manifest.firefox.json" },
];

await rm(dist, { recursive: true, force: true });

for (const target of TARGETS) {
  const out = join(dist, target.name);
  await mkdir(out, { recursive: true });

  for (const dir of PAYLOAD) {
    await cp(join(root, dir), join(out, dir), { recursive: true });
  }

  // Both targets ship the file as `manifest.json`; only the contents differ.
  const manifest = JSON.parse(await readFile(join(root, target.manifest), "utf8"));
  await writeFile(join(out, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n");

  const files = await count(out);
  console.log(
    `  ${target.name.padEnd(8)} ${files} files  ·  background: ` +
      (manifest.background.service_worker ? "service worker" : "event page"),
  );

  if (zip) {
    const archive = join(dist, `rangrez-${target.name}.zip`);
    const res = spawnSync("zip", ["-qr", archive, "."], { cwd: out });
    if (res.status !== 0) {
      console.error(`  ! couldn't zip ${target.name} — is \`zip\` installed?`);
    } else {
      console.log(`           → ${archive.replace(root + "/", "")}`);
    }
  }
}

async function count(dir) {
  let n = 0;
  for (const entry of await readdir(dir, { withFileTypes: true, recursive: true })) {
    if (entry.isFile()) n++;
  }
  return n;
}

console.log(`\nLoad in Firefox:  about:debugging → This Firefox → Load Temporary Add-on`);
console.log(`                  → dist/firefox/manifest.json`);
console.log(`Load in Chrome:   chrome://extensions → Load unpacked → apps/extension\n`);
