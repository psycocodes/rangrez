import "server-only";

import { randomUUID } from "node:crypto";
import { createClient } from "./supabase/server";
import type { ColorSeason, Garment, SavedFit, User } from "./types";
import { seedCatalog } from "./seed";
import { isInPalette } from "./palette";

export const newId = () => randomUUID();

/* ── users ──────────────────────────────────────────────────────────────── */

export async function findUserByEmail(email: string): Promise<User | undefined> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("users")
    .select("*")
    .eq("email", email.trim().toLowerCase())
    .maybeSingle();
  if (error || !data) return undefined;
  return data as User;
}

export async function findUserById(id: string): Promise<User | undefined> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("users")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error || !data) return undefined;
  return data as User;
}

export async function insertUser(user: User): Promise<User> {
  const supabase = await createClient();
  
  const { error } = await supabase.from("users").insert(user);
  if (error) console.error("Error inserting user:", error);

  // Seed starter wardrobe
  const starterGarments = seedCatalog(user.id);
  await insertGarments(starterGarments);

  return user;
}

export async function updateUser(
  id: string,
  patch: (user: User) => void,
): Promise<User | undefined> {
  const supabase = await createClient();
  const user = await findUserById(id);
  if (!user) return undefined;
  
  patch(user);
  
  const { error } = await supabase.from("users").update(user).eq("id", id);
  if (error) console.error("Error updating user:", error);
  
  return user;
}

/* ── garments ───────────────────────────────────────────────────────────── */

export async function listGarments(userId: string): Promise<Garment[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("garments")
    .select("*")
    .eq("userId", userId)
    .order("addedAt", { ascending: false });
    
  if (error || !data) return [];

  // Seed starter wardrobe on first visit when authenticated
  if (data.length === 0) {
    const starter = seedCatalog(userId);
    await insertGarments(starter);
    return starter;
  }

  return data as Garment[];
}

export async function insertGarments(items: Garment[]): Promise<Garment[]> {
  const supabase = await createClient();
  const { error } = await supabase.from("garments").insert(items);
  if (error) console.error("Error inserting garments:", error);
  return items;
}

export async function updateGarment(
  id: string,
  patch: (g: Garment) => void,
): Promise<Garment | undefined> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("garments")
    .select("*")
    .eq("id", id)
    .maybeSingle();
    
  if (error || !data) return undefined;
  const g = data as Garment;
  
  patch(g);
  
  await supabase.from("garments").update(g).eq("id", id);
  return g;
}

export async function recomputePalette(
  userId: string,
  season: ColorSeason | undefined,
): Promise<number> {
  const garments = await listGarments(userId);
  let touched = 0;
  
  const supabase = await createClient();
  for (const g of garments) {
    const next = isInPalette(g.dye, season);
    if (next !== g.inPalette) {
      touched++;
      g.inPalette = next;
      await supabase.from("garments").update({ inPalette: next }).eq("id", g.id);
    }
  }
  
  return touched;
}

export async function deleteSeedGarments(userId: string): Promise<number> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("garments")
    .delete()
    .eq("userId", userId)
    .eq("origin", "seed")
    .select();
    
  if (error) return 0;
  return data ? data.length : 0;
}

/* ── saved fits ─────────────────────────────────────────────────────────── */

export async function listFits(userId: string): Promise<SavedFit[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("fits")
    .select("*")
    .eq("userId", userId)
    .order("savedAt", { ascending: false });
    
  if (error) return [];
  return data as SavedFit[];
}

export async function insertFit(fit: SavedFit): Promise<SavedFit> {
  const supabase = await createClient();
  const { error } = await supabase.from("fits").insert(fit);
  if (error) console.error("Error inserting fit:", error);
  return fit;
}
