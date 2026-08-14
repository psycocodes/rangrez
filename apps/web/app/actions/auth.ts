"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { endSession } from "@/lib/auth";
import { DbNotReadyError, ensureProfile } from "@/lib/db";
import { authClient } from "@/lib/supabase-auth";

export interface AuthState {
  error?: string;
  notice?: string;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function read(form: FormData) {
  return {
    name: String(form.get("name") ?? "").trim(),
    email: String(form.get("email") ?? "").trim().toLowerCase(),
    password: String(form.get("password") ?? ""),
  };
}

/**
 * Supabase owns the account; we own the profile row that hangs off it.
 *
 * Passwords never touch this codebase — `auth.signUp` stores them, and the
 * user shows up in the project's Authentication tab like any other.
 */
export async function signUp(
  _prev: AuthState,
  form: FormData,
): Promise<AuthState> {
  const { name, email, password } = read(form);

  if (!name) return { error: "We need something to print under the plate." };
  if (!EMAIL_RE.test(email)) return { error: "That email doesn't look right." };
  if (password.length < 8) return { error: "Eight characters minimum." };

  const supabase = await authClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { name } },
  });

  if (error) {
    return {
      error: /already registered|already exists/i.test(error.message)
        ? "That email is already on the ledger. Sign in instead."
        : error.message,
    };
  }

  // With "Confirm email" switched on there's no session until they click the
  // link, so say that rather than bouncing them to a page they can't see.
  if (!data.session) {
    return {
      notice:
        "Check your inbox to confirm the address, then sign in. (Turn off Confirm email in Supabase → Authentication → Sign In / Providers to skip this in development.)",
    };
  }

  try {
    await ensureProfile({ id: data.user!.id, email, name });
  } catch (err) {
    if (err instanceof DbNotReadyError) redirect("/setup");
    throw err;
  }

  // New users go straight to the avatar studio — nothing in the product works
  // until there is a body to render onto (PRD Flow A).
  redirect("/atelier");
}

export async function signIn(
  _prev: AuthState,
  form: FormData,
): Promise<AuthState> {
  const { email, password } = read(form);
  if (!EMAIL_RE.test(email)) return { error: "That email doesn't look right." };

  const supabase = await authClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error || !data.user) {
    // Same message either way — don't leak which emails exist.
    return {
      error: /not confirmed/i.test(error?.message ?? "")
        ? "That address hasn't been confirmed yet — check your inbox."
        : "That pair doesn't match anything we have.",
    };
  }

  let profile;
  try {
    profile = await ensureProfile({
      id: data.user.id,
      email,
      name:
        (data.user.user_metadata?.name as string | undefined) ??
        email.split("@")[0],
    });
  } catch (err) {
    if (err instanceof DbNotReadyError) redirect("/setup");
    throw err;
  }

  redirect(profile.avatar ? "/wardrobe" : "/atelier");
}

/**
 * Google.
 *
 * Supabase holds the client id and secret, so nothing about Google lives in
 * this repo or its env — the app only asks Supabase where to send the browser.
 * Google returns to /auth/callback, which trades the code for a session.
 */
export async function signInWithGoogle(): Promise<void> {
  const supabase = await authClient();

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${await origin()}/auth/callback`,
      // Always show the picker. Silent re-auth into whichever account Google
      // happens to have is disorienting on a shared machine.
      queryParams: { prompt: "select_account" },
    },
  });

  if (error || !data.url) {
    redirect(
      `/enter?error=${encodeURIComponent(
        error?.message ?? "Couldn't reach Google.",
      )}`,
    );
  }

  redirect(data.url);
}

/** Whatever origin served this request, so local and deployed both work. */
async function origin(): Promise<string> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto =
    h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

export async function signOut(): Promise<void> {
  await endSession();
  redirect("/enter");
}
