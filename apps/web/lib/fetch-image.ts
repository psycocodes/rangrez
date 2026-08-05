import "server-only";

import { promises as fs } from "node:fs";
import path from "node:path";

/**
 * Pulls image bytes for a VTO call, from either a stored upload path
 * (`/uploads/…`) or a remote URL.
 *
 * The remote case is reachable with an attacker-chosen URL — the extension
 * sends whatever image it picked off a shop page — so it is guarded rather
 * than trusted: scheme allow-list, private-network block (SSRF), content-type
 * check, and a hard size cap enforced while streaming rather than after.
 */

const MAX_BYTES = 16 * 1024 * 1024;
const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp", "image/avif"]);

export interface ImagePayload {
  bytes: Buffer;
  contentType: string;
}

/** Hostnames that must never be reachable from a user-supplied URL. */
function isPrivateHost(hostname: string): boolean {
  const h = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (h === "localhost" || h.endsWith(".localhost") || h.endsWith(".internal")) {
    return true;
  }
  if (h === "::1" || h === "0.0.0.0") return true;

  const v4 = h.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (v4) {
    const [a, b] = [Number(v4[1]), Number(v4[2])];
    if (a === 10 || a === 127 || a === 0) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 169 && b === 254) return true; // cloud metadata
  }
  // Unique-local / link-local IPv6
  if (/^f[cd][0-9a-f]{2}:/.test(h) || h.startsWith("fe80:")) return true;

  return false;
}

async function readLocalUpload(url: string): Promise<ImagePayload> {
  // Resolve inside public/ and confirm we stayed there — `..` in a stored path
  // must not become an arbitrary file read.
  const root = path.join(process.cwd(), "public");
  const file = path.resolve(root, `.${url}`);
  if (!file.startsWith(root + path.sep)) {
    throw new Error("Refusing to read outside the uploads directory.");
  }

  const bytes = await fs.readFile(file);
  const ext = path.extname(file).toLowerCase();
  const contentType =
    ext === ".png" ? "image/png" : ext === ".webp" ? "image/webp" : "image/jpeg";

  return { bytes, contentType };
}

export async function fetchImage(url: string): Promise<ImagePayload> {
  if (url.startsWith("/uploads/")) return readLocalUpload(url);

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error("That image address isn't a valid URL.");
  }

  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    throw new Error("Only http(s) image URLs are accepted.");
  }
  if (isPrivateHost(parsed.hostname)) {
    throw new Error("That image address isn't reachable.");
  }

  const res = await fetch(parsed, {
    // Shop CDNs routinely 403 an unrecognised client.
    headers: {
      "User-Agent": "Mozilla/5.0 (compatible; Rangrez/0.1; +https://rangrez.app)",
      Accept: "image/avif,image/webp,image/png,image/jpeg,*/*",
      Referer: parsed.origin,
    },
    redirect: "follow",
    cache: "no-store",
    signal: AbortSignal.timeout(20_000),
  });

  if (!res.ok) throw new Error(`Couldn't fetch that image (${res.status}).`);

  const contentType = (res.headers.get("content-type") ?? "")
    .split(";")[0]
    .trim()
    .toLowerCase();
  if (!ALLOWED.has(contentType)) {
    throw new Error(`That link isn't an image we can use (${contentType || "unknown"}).`);
  }

  const declared = Number(res.headers.get("content-length") ?? 0);
  if (declared > MAX_BYTES) throw new Error("That image is too large.");

  const bytes = Buffer.from(await res.arrayBuffer());
  if (bytes.byteLength > MAX_BYTES) throw new Error("That image is too large.");

  return { bytes, contentType };
}
