import "server-only";

import { createHmac, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { DbNotReadyError, findUserById } from "./db";
import type { Session, User } from "./types";

/**
 * ─────────────────────────────────────────────────────────────────────────────
 *  DUMMY AUTH  ·  deliberately thin, deliberately replaceable
 * ─────────────────────────────────────────────────────────────────────────────
 *  Email + password, scrypt-hashed, with an HMAC-signed httpOnly session
 *  cookie. Good enough to demo per-user private catalogs (PRD §4.5) and no
 *  more.
 *
 *  MIGRATING TO "SIGN IN WITH GOOGLE":
 *  The rest of the app only ever touches `getCurrentUser()` / `requireUser()`
 *  / `endSession()`. Nothing imports the password functions except the two
 *  server actions in app/actions/auth.ts. So the swap is:
 *    1. add next-auth (or Auth.js) with the Google provider
 *    2. reimplement `getCurrentUser()` on top of its session
 *    3. delete `hashPassword` / `verifyPassword` and the two actions
 *    4. drop `passwordHash` from the User type
 *  No page, layout or component changes.
 * ─────────────────────────────────────────────────────────────────────────────
 */

const COOKIE = "rangrez_session";
const MAX_AGE = 60 * 60 * 24 * 60; // 60 days
/** Re-issue once a session is a day old, so an active user never falls out. */
const ROLL_AFTER_MS = 1000 * 60 * 60 * 24;

function secret(): string {
  return process.env.SESSION_SECRET || "rangrez-insecure-dev-secret";
}

/* ── passwords ──────────────────────────────────────────────────────────── */

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const candidate = scryptSync(password, salt, 64);
  const expected = Buffer.from(hash, "hex");
  return (
    candidate.length === expected.length && timingSafeEqual(candidate, expected)
  );
}

/* ── session cookie ─────────────────────────────────────────────────────── */

function sign(payload: string): string {
  return createHmac("sha256", secret()).update(payload).digest("base64url");
}

function encode(session: Session): string {
  const payload = Buffer.from(JSON.stringify(session)).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

function decode(token: string | undefined): Session | null {
  if (!token) return null;
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return null;

  // Constant-time compare so a bad cookie can't be brute-forced byte by byte.
  const expected = Buffer.from(sign(payload));
  const actual = Buffer.from(sig);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
    return null;
  }

  try {
    return JSON.parse(Buffer.from(payload, "base64url").toString()) as Session;
  } catch {
    return null;
  }
}

export async function startSession(user: User): Promise<void> {
  const jar = await cookies();
  jar.set(COOKIE, encode({ userId: user.id, email: user.email, issuedAt: Date.now() }), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE,
  });
}

export async function endSession(): Promise<void> {
  const jar = await cookies();
  jar.delete(COOKIE);
}

export async function getSession(): Promise<Session | null> {
  const jar = await cookies();
  return decode(jar.get(COOKIE)?.value);
}

/* ── what the app actually calls ────────────────────────────────────────── */

export async function getCurrentUser(): Promise<User | null> {
  const session = await getSession();
  if (!session) return null;

  let user: User | undefined;
  try {
    user = await findUserById(session.userId);
  } catch (err) {
    // Nothing works before the schema exists. Send people somewhere that says
    // so rather than letting a Postgres error surface as a broken page.
    if (err instanceof DbNotReadyError) redirect("/setup");
    throw err;
  }

  if (!user) {
    // The cookie outlived its user (wiped database, deleted account). Clear it
    // rather than leaving a valid-looking session that resolves to nobody.
    await endSession().catch(() => {});
    return null;
  }

  // Roll the expiry forward for anyone still using the app, so "logged in"
  // means logged in until they say otherwise.
  if (Date.now() - session.issuedAt > ROLL_AFTER_MS) {
    await startSession(user).catch(() => {});
  }

  return user;
}

/** For pages that cannot render without a user. Redirects to the door. */
export async function requireUser(): Promise<User> {
  const user = await getCurrentUser();
  if (!user) redirect("/enter");
  return user;
}
