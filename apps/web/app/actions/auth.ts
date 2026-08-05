"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { findUserByEmail } from "@/lib/db";

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

  const supabase = await createClient();
  
  // Create user in Supabase Auth (the Postgres trigger `on_auth_user_created` creates public.users row)
  const { data: authData, error: signUpError } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        name,
      },
    },
  });

  if (signUpError) {
    if (signUpError.message.includes("already registered")) {
       return { error: "That email is already on the ledger. Sign in instead." };
    }
    return { error: signUpError.message };
  }
  
  if (!authData.user) {
    return { error: "Something went wrong during sign up." };
  }

  revalidatePath("/", "layout");
  redirect("/atelier");
}

export async function signIn(
  _prev: AuthState,
  form: FormData,
): Promise<AuthState> {
  const { email, password } = read(form);

  if (!EMAIL_RE.test(email)) return { error: "That email doesn't look right." };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    if (error.message.includes("Email not confirmed")) {
      return { error: "Please confirm your email or disable 'Confirm Email' in Supabase Auth settings." };
    }
    return { error: "That pair doesn't match anything we have." };
  }

  const user = await findUserByEmail(email);

  revalidatePath("/", "layout");
  redirect(user?.avatar ? "/wardrobe" : "/atelier");
}

export async function signOut(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/enter");
}
