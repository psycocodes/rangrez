/**
 * ═══════════════════════════════════════════════════════════════════════════
 *  Fetch the segmentation weights
 * ═══════════════════════════════════════════════════════════════════════════
 *
 *      node scripts/fetch-matte-model.mjs
 *
 *  Puts BiRefNet-lite in `.models/`, which is gitignored — 213MB does not
 *  belong in a history. Once it is there, lib/segment.ts picks it up and every
 *  cutout goes through the model instead of the flood fill; delete the file and
 *  everything falls back to the way it worked before.
 *
 *  ── you also need a runtime ──────────────────────────────────────────────
 *
 *  `onnxruntime-node` ships a prebuilt binary per platform, and ONNX Runtime
 *  no longer publishes one for **macOS on x64**. An Apple Silicon Mac running
 *  an Intel build of Node — which is easy to end up with, and is what this was
 *  developed against — therefore has no native runtime at all. Check with:
 *
 *      node -p "process.platform + '/' + process.arch"
 *
 *  If that says `darwin/x64` on an M-series machine, install an arm64 Node
 *  (`nvm install --lts` under an arm64 shell, or Homebrew's) and reinstall.
 *  The WASM build is tried as a fallback and does load, but the model wants
 *  more memory at 1024² than a wasm32 heap can give it, so it is not a
 *  substitute here.
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { createWriteStream } from "node:fs";
import { mkdir, rename, stat } from "node:fs/promises";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const out = resolve(here, "../.models/birefnet-lite.onnx");
const SOURCE =
  "https://huggingface.co/onnx-community/BiRefNet_lite-ONNX/resolve/main/onnx/model.onnx";

try {
  const info = await stat(out);
  if (info.size > 1_000_000) {
    console.log(`Already here — ${(info.size / 1024 / 1024) | 0}MB at ${out}`);
    process.exit(0);
  }
} catch {
  // not there yet
}

await mkdir(dirname(out), { recursive: true });
console.log("Fetching BiRefNet-lite (MIT, ~213MB) …");

const res = await fetch(SOURCE);
if (!res.ok || !res.body) {
  console.error(`Couldn't fetch it: HTTP ${res.status}`);
  process.exit(1);
}

// Streamed to a temporary name and moved into place, so a run interrupted
// halfway cannot leave a truncated model that loads and then behaves oddly.
const part = `${out}.part`;
await pipeline(Readable.fromWeb(res.body), createWriteStream(part));
await rename(part, out);

const { size } = await stat(out);
console.log(`Done — ${(size / 1024 / 1024) | 0}MB at ${out}`);
console.log("Cutouts will use it from the next server start.");
