import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";
import { redirect } from "next/navigation";

import { DbNotReadyError, ensureProfile, findUserById } from "./db";
import { authClient } from "./supabase-auth";
import type { User } from "./types";
import { googlePhotoFromMetadata } from "./profile-photo";

/**
 * ─────────────────────────────────────────────────────────────────────────────
 *  AUTH  ·  Supabase Auth
 * ─────────────────────────────────────────────────────────────────────────────
 *  Accounts live in Supabase's own `auth.users` table — visible in the
 *  Authentication tab, with password hashing, session refresh and rotation
 *  handled by Supabase rather than by us. This replaced a hand-rolled scrypt
 *  hash in an application table, which worked but meant owning password
 *  storage for no good reason.
 *
 *  Profile data we actually care about — display name, avatar plate, colour
 *  season, preferences — stays in `rangrez_users`, keyed by the auth user's
 *  id. `ensureProfile()` creates that row the first time we see a session, so
 *  an account created any other way (magic link, OAuth later) still works.
 *
 *  Sessions are Supabase's cookies. They refresh on their own, so "stay logged
 *  in" is no longer something this file has to implement.
 *
 *  ADDING GOOGLE: `signInWithOAuth({ provider: "google" })` plus a callback
 *  route. Nothing below or downstream changes — `getCurrentUser()` already
 *  reads whatever session Supabase has.
 * ─────────────────────────────────────────────────────────────────────────────
 */

/* ── what the app calls ─────────────────────────────────────────────────── */

export async function getCurrentUser(): Promise<User | null> {
  let authUser;
  try {
    const supabase = await authClient();
    const { data } = await supabase.auth.getUser();
    authUser = data.user;
  } catch {
    return null;
  }

  if (!authUser) return null;

  try {
    const user =
      (await findUserById(authUser.id)) ??
      (await ensureProfile({
        id: authUser.id,
        email: authUser.email ?? "",
        name:
          (authUser.user_metadata?.name as string | undefined) ??
          authUser.email?.split("@")[0] ??
          "You",
      }));

    /* The Google picture rides along from the session rather than being read
       back out of our table. It is not our data — the user can change it on
       Google's side at any moment — so storing it would only ever give us a
       stale copy of someone's face. Attached here, at the one place that has
       both the profile and the session in hand. */
    return { ...user, googlePhotoUrl: googlePhotoFromMetadata(authUser.user_metadata) };
  } catch (err) {
    // Nothing works before the schema exists. Send people somewhere that says
    // so rather than letting a Postgres error surface as a broken page.
    if (err instanceof DbNotReadyError) redirect("/setup");
    throw err;
  }
}

/** For pages that cannot render without a user. Redirects to the door. */
export async function requireUser(): Promise<User> {
  const user = await getCurrentUser();
  if (!user) redirect("/enter");
  return user;
}

export async function endSession(): Promise<void> {
  const supabase = await authClient();
  await supabase.auth.signOut();
}

/* ── the extension's bearer token ───────────────────────────────────────── */

/**
 * The extension calls the API from a `chrome-extension://` origin where
 * Supabase's cookies don't apply, so it carries a token we mint instead. It is
 * scoped to one user id and nothing else, and is verified in lib/ext-token.ts.
 */
const EXT_LABEL = "rangrez.ext.v1";

export function extensionSecret(): string {
  return `${EXT_LABEL}:${process.env.SESSION_SECRET || "rangrez-insecure-dev-secret"}`;
}

export function signExtensionPayload(payload: string): string {
  return createHmac("sha256", extensionSecret()).update(payload).digest("base64url");
}

export function verifyExtensionSignature(payload: string, sig: string): boolean {
  const expected = Buffer.from(signExtensionPayload(payload));
  const actual = Buffer.from(sig);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}
