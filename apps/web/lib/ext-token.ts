import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";

import { findUserById } from "./db";
import type { User } from "./types";

/**
 * Pairing token for the Chrome extension.
 *
 * The extension cannot use the session cookie: it calls the API from a service
 * worker on a `chrome-extension://` origin, and our cookie is SameSite=Lax by
 * design. So the app mints a separate bearer token, the user picks it up once
 * by visiting /connect, and the extension stores it in `chrome.storage.local`.
 *
 * Same HMAC construction as the session cookie, different secret label, so a
 * session cookie can never be replayed as an extension token or vice versa.
 */

const LABEL = "rangrez.ext.v1";
const MAX_AGE_MS = 1000 * 60 * 60 * 24 * 90; // 90 days

interface TokenBody {
  userId: string;
  issuedAt: number;
}

function secret(): string {
  return `${LABEL}:${process.env.SESSION_SECRET || "rangrez-insecure-dev-secret"}`;
}

function sign(payload: string): string {
  return createHmac("sha256", secret()).update(payload).digest("base64url");
}

export function mintExtensionToken(user: User): string {
  const payload = Buffer.from(
    JSON.stringify({ userId: user.id, issuedAt: Date.now() } satisfies TokenBody),
  ).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

function verify(token: string): TokenBody | null {
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return null;

  const expected = Buffer.from(sign(payload));
  const actual = Buffer.from(sig);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
    return null;
  }

  try {
    const body = JSON.parse(
      Buffer.from(payload, "base64url").toString(),
    ) as TokenBody;
    if (Date.now() - body.issuedAt > MAX_AGE_MS) return null;
    return body;
  } catch {
    return null;
  }
}

/** Resolves the `Authorization: Bearer …` header to a user, or null. */
export async function userFromRequest(req: Request): Promise<User | null> {
  const header = req.headers.get("authorization");
  if (!header?.startsWith("Bearer ")) return null;

  const body = verify(header.slice(7).trim());
  if (!body) return null;

  return (await findUserById(body.userId)) ?? null;
}
