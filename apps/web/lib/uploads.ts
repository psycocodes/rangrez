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

  const bytes = Buffer.from(await file.arrayBuffer());
  const name = `${randomUUID()}.${ext}`;

  await fs.mkdir(DIR, { recursive: true });
  await fs.writeFile(path.join(DIR, name), new Uint8Array(bytes));

  return { url: `/uploads/${name}`, bytes, contentType };
}
