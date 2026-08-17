import "server-only";

import { promises as fs } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";

/**
 * Local disk stand-in for the S3/Cloudinary bucket in the PRD tech stack.
 * Files land in `public/uploads/` and are served straight off the origin.
 * Swap the two functions here for a signed-upload client and nothing else
 * changes.
 */

const DIR = path.join(process.cwd(), "public", "uploads");

const EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/heic": "heic",
};

export const ACCEPTED = Object.keys(EXT);
export const MAX_BYTES = 12 * 1024 * 1024; // 12 MB

export interface StoredFile {
  url: string;
  bytes: Buffer;
  contentType: string;
}

export async function storeUpload(file: File): Promise<StoredFile> {
  const contentType = file.type || "image/jpeg";
  const ext = EXT[contentType];
  if (!ext) {
    throw new Error(`Unsupported image type: ${contentType}. Use JPG, PNG or WebP.`);
  }
  if (file.size > MAX_BYTES) {
    throw new Error("That image is over 12 MB — shrink it and try again.");
  }

  return storeBytes(Buffer.from(await file.arrayBuffer()), contentType);
}

/**
 * The same thing for bytes we already hold — a finished VTO render being
 * copied onto our own origin, rather than a file the user chose.
 *
 * Callers that already validated the type get it back unchecked; an unknown
 * content type lands as a .jpg, which is what every one of these actually is.
 */
export async function storeBytes(
  bytes: Buffer,
  contentType: string,
): Promise<StoredFile> {
  const ext = EXT[contentType] ?? "jpg";
  const name = `${randomUUID()}.${ext}`;

  await fs.mkdir(DIR, { recursive: true });
  await fs.writeFile(path.join(DIR, name), new Uint8Array(bytes));

  return { url: `/uploads/${name}`, bytes, contentType };
}
