"use server";

import { redirect } from "next/navigation";

import {
  endSession,
  hashPassword,
  startSession,
  verifyPassword,
} from "@/lib/auth";
import { DbNotReadyError, findUserByEmail, insertUser, newId } from "@/lib/db";
import type { User } from "@/lib/types";

export interface AuthState {
  error?: string;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function read(form: FormData) {
  return {
    name: String(form.get("name") ?? "").trim(),
    email: String(form.get("email") ?? "").trim().toLowerCase(),
    password: String(form.get("password") ?? ""),
  };
}

export async function signUp(
  _prev: AuthState,
  form: FormData,
): Promise<AuthState> {
  const { name, email, password } = read(form);

  if (!name) return { error: "We need something to print under the plate." };
  if (!EMAIL_RE.test(email)) return { error: "That email doesn't look right." };
  if (password.length < 8) return { error: "Eight characters minimum." };

  try {
    if (await findUserByEmail(email)) {
      return { error: "That email is already on the ledger. Sign in instead." };
    }
  } catch (err) {
    if (err instanceof DbNotReadyError) redirect("/setup");
    throw err;
  }

  const user: User = {
    id: newId(),
    email,
    name,
    passwordHash: hashPassword(password),
    createdAt: new Date().toISOString(),
    preferences: { fitPreference: "regular", paletteFirst: true },
  };

  await insertUser(user);
  await startSession(user);

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

  const user = await findUserByEmail(email);
  // Same message either way — don't leak which emails exist.
  if (!user || !verifyPassword(password, user.passwordHash)) {
    return { error: "That pair doesn't match anything we have." };
  }

  await startSession(user);
  redirect(user.avatar ? "/wardrobe" : "/atelier");
}

export async function signOut(): Promise<void> {
  await endSession();
  redirect("/enter");
}
