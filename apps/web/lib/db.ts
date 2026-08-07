import "server-only";

import { randomUUID } from "node:crypto";

import { isInPalette } from "./palette";
import { seedCatalog } from "./seed";
import { supabase } from "./supabase";
import type { ColorSeason, Garment, SavedFit, User } from "./types";

/**
 * Persistence.
 *
 * Every caller goes through the functions below — nothing else touches
 * Supabase. The signatures are unchanged from the JSON-file version this
 * replaced, which is why swapping the store needed no edits anywhere else.
 *
 * Row scoping is this module's responsibility: the schema runs RLS with no
 * anon policies and the server holds the secret key, so `user_id` has to be in
 * every query here. Any function taking a row id also takes the userId, so a
 * guessed id from another account reads and writes nothing.
 */

export const newId = () => randomUUID();

/* ── row ⇄ domain ───────────────────────────────────────────────────────── */

type Row = Record<string, unknown>;

function toUser(row: Row): User {
  return {
    id: row.id as string,
    email: row.email as string,
    name: row.name as string,
    createdAt: row.created_at as string,
    avatar: (row.avatar as User["avatar"]) ?? undefined,
    preferences: {
      fitPreference: "regular",
      paletteFirst: true,
      ...((row.preferences as object) ?? {}),
    } as User["preferences"],
  };
}

function toGarment(row: Row): Garment {
  return {
    id: row.id as string,
    userId: row.user_id as string,
    name: row.name as string,
    origin: row.origin as Garment["origin"],
    zone: row.zone as Garment["zone"],
    dye: row.dye as Garment["dye"],
    season: row.season as Garment["season"],
    material: (row.material as string) ?? "",
    imageUrl: row.image_url as string,
    seed: (row.seed as string) ?? "",
    status: row.status as Garment["status"],
    taskId: (row.task_id as string) ?? undefined,
    inPalette: Boolean(row.in_palette),
    wornCount: Number(row.worn_count ?? 0),
    sourceUrl: (row.source_url as string) ?? undefined,
    addedAt: row.added_at as string,
    updatedAt: (row.updated_at as string) ?? undefined,
  };
}

function fromGarment(g: Garment): Row {
  return {
    id: g.id,
    user_id: g.userId,
    name: g.name,
    origin: g.origin,
    zone: g.zone,
    dye: g.dye,
    season: g.season,
    material: g.material,
    image_url: g.imageUrl,
    seed: g.seed,
    status: g.status,
    task_id: g.taskId ?? null,
    in_palette: g.inPalette,
    worn_count: g.wornCount,
    source_url: g.sourceUrl ?? null,
    added_at: g.addedAt,
  };
}

function toFit(row: Row): SavedFit {
  return {
    id: row.id as string,
    userId: row.user_id as string,
    name: row.name as string,
    garmentIds: (row.garment_ids as string[]) ?? [],
    note: (row.note as string) ?? undefined,
    savedAt: row.saved_at as string,
  };
}

/**
 * Thrown when the database is reachable but not set up — no tables, or a key
 * that can't see them. Distinguished from a genuine query failure so the app
 * can route to /setup instead of showing a stack trace to someone whose only
 * mistake was not having run the schema yet.
 */
export class DbNotReadyError extends Error {
  constructor(readonly detail: string) {
    super(detail);
    this.name = "DbNotReadyError";
  }
}

function isNotReady(message: string): boolean {
  return (
    message.includes("schema cache") || // PGRST205 — table doesn't exist
    message.includes("does not exist") ||
    message.includes("PGRST205") ||
    message.includes("permission denied") // RLS on, no rights
  );
}

function fail(what: string, error: unknown): never {
  const message =
    typeof error === "object" && error && "message" in error
      ? String((error as { message: unknown }).message)
      : String(error);
  if (isNotReady(message)) throw new DbNotReadyError(message);
  throw new Error(`${what}: ${message}`);
}

/** Supabase reports failures in the payload rather than throwing. */
function must(what: string, res: { error: unknown }): void {
  if (res.error) fail(what, res.error);
}

/** Cheap probe used by the setup gate. */
export async function dbReady(): Promise<true | string> {
  try {
    const { error } = await supabase()
      .from("rangrez_users")
      .select("id")
      .limit(1);
    if (error) return error.message;
    return true;
  } catch (err) {
    return err instanceof Error ? err.message : String(err);
  }
}

/* ── users ──────────────────────────────────────────────────────────────── */

export async function findUserByEmail(email: string): Promise<User | undefined> {
  const { data, error } = await supabase()
    .from("rangrez_users")
    .select("*")
    .eq("email", email.trim().toLowerCase())
    .maybeSingle();
  if (error) fail("findUserByEmail", error);
  return data ? toUser(data) : undefined;
}

export async function findUserById(id: string): Promise<User | undefined> {
  const { data, error } = await supabase()
    .from("rangrez_users")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) fail("findUserById", error);
  return data ? toUser(data) : undefined;
}

/**
 * The profile row that hangs off a Supabase Auth account.
 *
 * Called on every sign-in rather than only at sign-up, so an account created
 * any other way — a magic link, an OAuth provider later, a row added by hand
 * in the dashboard — still lands in the app with a wardrobe. Idempotent.
 */
export async function ensureProfile(input: {
  id: string;
  email: string;
  name: string;
}): Promise<User> {
  const existing = await findUserById(input.id);
  if (existing) return existing;

  const user: User = {
    id: input.id,
    email: input.email,
    name: input.name,
    createdAt: new Date().toISOString(),
    preferences: { fitPreference: "regular", paletteFirst: true },
  };

  await insertUser(user);
  return user;
}

export async function insertUser(user: User): Promise<User> {
  must(
    "insertUser",
    await supabase().from("rangrez_users").insert({
      id: user.id,
      email: user.email,
      name: user.name,
      avatar: user.avatar ?? null,
      preferences: user.preferences,
      created_at: user.createdAt,
    }),
  );

  // A brand-new closet is a bad first impression, so we seed a starter
  // wardrobe — but demo data must never be able to fail an account. This
  // exact insert once left users created with no wardrobe and no way back in.
  const seeded = await supabase()
    .from("rangrez_garments")
    .insert(seedCatalog(user.id).map(fromGarment));
  if (seeded.error) {
    console.warn(`[db] starter wardrobe skipped: ${seeded.error.message}`);
  }

  return user;
}

export async function updateUser(
  id: string,
  patch: (user: User) => void,
): Promise<User | undefined> {
  const user = await findUserById(id);
  if (!user) return undefined;

  patch(user);
  must(
    "updateUser",
    await supabase()
      .from("rangrez_users")
      .update({
        name: user.name,
        avatar: user.avatar ?? null,
        preferences: user.preferences,
      })
      .eq("id", id),
  );
  return user;
}

/* ── garments ───────────────────────────────────────────────────────────── */

export async function listGarments(userId: string): Promise<Garment[]> {
  const { data, error } = await supabase()
    .from("rangrez_garments")
    .select("*")
    .eq("user_id", userId)
    .order("added_at", { ascending: false });
  if (error) fail("listGarments", error);
  return (data ?? []).map(toGarment);
}

export async function getGarment(
  userId: string,
  id: string,
): Promise<Garment | undefined> {
  const { data, error } = await supabase()
    .from("rangrez_garments")
    .select("*")
    .eq("user_id", userId)
    .eq("id", id)
    .maybeSingle();
  if (error) fail("getGarment", error);
  return data ? toGarment(data) : undefined;
}

export async function insertGarments(items: Garment[]): Promise<Garment[]> {
  if (!items.length) return [];
  must(
    "insertGarments",
    await supabase().from("rangrez_garments").insert(items.map(fromGarment)),
  );
  return items;
}

/**
 * Field-level edit, for the wardrobe's own CRUD. Scoped by userId so a guessed
 * id belonging to someone else updates nothing.
 */
export async function patchGarment(
  userId: string,
  id: string,
  fields: Partial<
    Pick<
      Garment,
      "name" | "zone" | "dye" | "season" | "material" | "wornCount" | "inPalette"
    >
  >,
): Promise<Garment | undefined> {
  const row: Row = {};
  if (fields.name !== undefined) row.name = fields.name;
  if (fields.zone !== undefined) row.zone = fields.zone;
  if (fields.dye !== undefined) row.dye = fields.dye;
  if (fields.season !== undefined) row.season = fields.season;
  if (fields.material !== undefined) row.material = fields.material;
  if (fields.wornCount !== undefined) row.worn_count = fields.wornCount;
  if (fields.inPalette !== undefined) row.in_palette = fields.inPalette;
  if (!Object.keys(row).length) return getGarment(userId, id);

  const { data, error } = await supabase()
    .from("rangrez_garments")
    .update(row)
    .eq("user_id", userId)
    .eq("id", id)
    .select()
    .maybeSingle();
  if (error) fail("patchGarment", error);
  return data ? toGarment(data) : undefined;
}

export async function deleteGarment(userId: string, id: string): Promise<boolean> {
  const { error, count } = await supabase()
    .from("rangrez_garments")
    .delete({ count: "exact" })
    .eq("user_id", userId)
    .eq("id", id);
  if (error) fail("deleteGarment", error);
  return (count ?? 0) > 0;
}

/**
 * Re-rank the whole catalog against a colour season. Called whenever the
 * avatar's analysis lands or the user overrides their season by hand — the
 * ranking is ours, not YouCam's, so it costs nothing to redo (PRD §8).
 */
export async function recomputePalette(
  userId: string,
  season: ColorSeason | undefined,
): Promise<number> {
  const garments = await listGarments(userId);

  // Two statements keyed on the outcome, rather than one per garment: at 30
  // pieces that is two round trips instead of thirty.
  const inside: string[] = [];
  const outside: string[] = [];
  let changed = 0;

  for (const g of garments) {
    const next = isInPalette(g.dye, season);
    (next ? inside : outside).push(g.id);
    if (next !== g.inPalette) changed++;
  }

  const apply = async (ids: string[], value: boolean) => {
    if (!ids.length) return;
    must(
      "recomputePalette",
      await supabase()
        .from("rangrez_garments")
        .update({ in_palette: value })
        .eq("user_id", userId)
        .in("id", ids),
    );
  };

  await Promise.all([apply(inside, true), apply(outside, false)]);
  return changed;
}

export async function deleteSeedGarments(userId: string): Promise<number> {
  const { error, count } = await supabase()
    .from("rangrez_garments")
    .delete({ count: "exact" })
    .eq("user_id", userId)
    .eq("origin", "seed");
  if (error) fail("deleteSeedGarments", error);
  return count ?? 0;
}

/* ── saved fits ─────────────────────────────────────────────────────────── */

export async function listFits(userId: string): Promise<SavedFit[]> {
  const { data, error } = await supabase()
    .from("rangrez_fits")
    .select("*")
    .eq("user_id", userId)
    .order("saved_at", { ascending: false });
  if (error) fail("listFits", error);
  return (data ?? []).map(toFit);
}

export async function insertFit(fit: SavedFit): Promise<SavedFit> {
  must(
    "insertFit",
    await supabase().from("rangrez_fits").insert({
      id: fit.id,
      user_id: fit.userId,
      name: fit.name,
      garment_ids: fit.garmentIds,
      note: fit.note ?? null,
      saved_at: fit.savedAt,
    }),
  );
  return fit;
}
