import "server-only";

import { redirect } from "next/navigation";
import { createClient } from "./supabase/server";
import { findUserById, insertUser } from "./db";
import type { User } from "./types";

export async function getCurrentUser(): Promise<User | null> {
  const supabase = await createClient();
  const { data: { user: authUser }, error } = await supabase.auth.getUser();
  
  if (error || !authUser) return null;

  let domainUser = await findUserById(authUser.id);

  // Self-heal: If user exists in Supabase Auth but public.users row is missing
  if (!domainUser) {
    const newUser: User = {
      id: authUser.id,
      email: authUser.email || "",
      name: authUser.user_metadata?.name || authUser.email?.split("@")[0] || "Atelier Member",
      passwordHash: "",
      createdAt: new Date().toISOString(),
      preferences: { fitPreference: "regular", paletteFirst: true },
    };
    try {
      domainUser = await insertUser(newUser);
    } catch (e) {
      console.error("Failed to self-heal user profile:", e);
      return newUser; // Return in-memory fallback user so we never enter a 307 redirect loop
    }
  }

  return domainUser;
}

/** For pages that cannot render without a user. Redirects to the door. */
export async function requireUser(): Promise<User> {
  const user = await getCurrentUser();
  if (!user) redirect("/enter");
  return user;
}
