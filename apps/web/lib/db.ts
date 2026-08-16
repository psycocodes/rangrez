import "server-only";

import { randomUUID } from "node:crypto";

import type { Measurements } from "./fit";
import { isInPalette } from "./palette";
import { seedCatalog } from "./seed";
import { supabase } from "./supabase";
import type { Avatar, ColorSeason, Garment, SavedFit, User } from "./types";

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
  // Accounts predating the multi-plate migration have a single `avatar` and an
  // empty `avatars`, so the column that is populated wins. The SQL backfills
  // this too; reading defensively means a half-migrated row still signs in.
  const stored = (row.avatars as Avatar[] | null) ?? [];
  const legacy = (row.avatar as Avatar | null) ?? null;
  const avatars = stored.length ? stored : legacy ? [legacy] : [];

  const activeAvatarId =
    (row.active_avatar_id as string | null) ?? avatars[0]?.id ?? undefined;

  const preferences = {
    fitPreference: "regular",
    paletteFirst: true,
    ...((row.preferences as object) ?? {}),
  } as User["preferences"] & { heightCm?: number };

  const measurements = {
    unit: "cm",
    ...((row.measurements as object) ?? {}),
  } as Measurements;

  // Height used to live on preferences, which meant a body number sat in the
  // settings object while the rest of the body lived somewhere else. It moves
  // here on read so the one people already entered isn't lost; the old key is
  // left where it is rather than deleted, because nothing reads it any more.
  if (measurements.heightCm === undefined && preferences.heightCm) {
    measurements.heightCm = preferences.heightCm;
  }

  return {
    id: row.id as string,
    email: row.email as string,
    name: row.name as string,
    createdAt: row.created_at as string,
    avatars,
    activeAvatarId,
    // The same object as the array entry, not a copy: `u.avatar.colorSeason = x`
    // inside an updateUser patch has to reach the row that gets written back.
    avatar: avatars.find((a) => a.id === activeAvatarId) ?? avatars[0],
    measurements,
    preferences,
  };
}

/** The plate a try-on should land on, by id or else whichever is active. */
export function pickAvatar(user: User, id?: string | null): Avatar | undefined {
  if (id) {
    const named = user.avatars.find((a) => a.id === id);
    if (named) return named;
  }
  return user.avatar;
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
    tryOnUrl: (row.try_on_url as string) ?? undefined,
    tryOnAvatarId: (row.try_on_avatar_id as string) ?? undefined,
    originalUrl: (row.original_url as string) ?? undefined,
    vtoTarget: (row.vto_target as string) ?? undefined,
    fit: (row.fit as Garment["fit"]) ?? undefined,
    sizeLabel: (row.size_label as string) ?? undefined,
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
    try_on_url: g.tryOnUrl ?? null,
    try_on_avatar_id: g.tryOnAvatarId ?? null,
    original_url: g.originalUrl ?? null,
    vto_target: g.vtoTarget ?? null,
    fit: g.fit ?? null,
    size_label: g.sizeLabel ?? null,
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

/**
 * Cheap probe used by the setup gate.
 *
 * Asks for every column the app actually writes, not just for the table —
 * because a half-migrated database is the failure people really hit, and it
 * is far more confusing than an empty one. The tables exist, sign-in works,
 * the wardrobe lists, and then saving anything dies on a column nobody
 * mentioned. PostgREST names the missing column in its error, so selecting
 * them all here turns that into a setup step with a file name on it.
 *
 * Keep this list in step with `fromGarment` and `updateUser`: a column added
 * to a write without being added here is a migration the gate can't see.
 */
const REQUIRED = {
  rangrez_users: "id, avatars, active_avatar_id, measurements, preferences",
  rangrez_garments:
    "id, image_url, try_on_url, try_on_avatar_id, original_url, vto_target, fit, size_label",
} as const;

export async function dbReady(): Promise<true | string> {
  try {
    for (const [table, columns] of Object.entries(REQUIRED)) {
      const { error } = await supabase().from(table).select(columns).limit(1);
      if (error) return error.message;
    }
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
    avatars: [],
    measurements: { unit: "cm" },
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
      avatars: user.avatars,
      active_avatar_id: user.activeAvatarId ?? null,
      avatar: user.avatar ?? null,
      measurements: user.measurements,
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

  // The patch may have added, removed or re-pointed a plate, so the active one
  // is resolved *after* it runs rather than trusting whatever `user.avatar`
  // now holds. An activeAvatarId naming a plate that no longer exists falls
  // back to the first, which is the only way this can't strand an account
  // with plates it can't use.
  const active =
    user.avatars.find((a) => a.id === user.activeAvatarId) ?? user.avatars[0];
  user.activeAvatarId = active?.id;
  user.avatar = active;

  // Tolerant of a database still on 003: adding a plate has nothing to do with
  // `measurements`, and dying on that column halfway through the avatar form
  // is a worse outcome than saving the plate and losing a number nobody has
  // typed yet. See `tolerant`.
  await tolerant(
    "updateUser",
    "rangrez_users",
    [
      {
        name: user.name,
        avatars: user.avatars,
        active_avatar_id: user.activeAvatarId ?? null,
        // Still written, so anything reading the pre-migration column — an old
        // deploy mid-rollout, a SQL console — sees the plate that is in use.
        avatar: active ?? null,
        measurements: user.measurements,
        preferences: user.preferences,
      },
    ],
    ([row]) => supabase().from("rangrez_users").update(row).eq("id", id),
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

/**
 * Columns migration 004 adds, per table.
 *
 * Every one of them is optional detail hung off a row that is perfectly valid
 * without it — which size you were looking at, the shop's own chart, the
 * gallery shot a cutout came from, the measurements the fit engine reads.
 */
const MIGRATION_004: Record<string, readonly string[]> = {
  rangrez_users: ["measurements"],
  rangrez_garments: ["original_url", "fit", "size_label"],
};

/**
 * A write that survives a database still on 003.
 *
 * PostgREST rejects the *whole* statement over a column it has never heard of,
 * so before this the piece someone had just clicked save on was simply lost,
 * and adding an avatar died on `measurements` with a schema-cache error in the
 * middle of the form. Neither is worth three optional columns: drop them,
 * complete the write, and leave the /setup gate saying the migration is
 * outstanding.
 *
 * Matched on both spellings, because the two layers word it differently —
 * PostgREST says «Could not find the 'fit' column of 'rangrez_garments' in the
 * schema cache», Postgres itself says «column rangrez_garments.fit does not
 * exist» — and against those shapes rather than as a bare substring, since
 * "fit" is three letters that turn up inside plenty of unrelated failures.
 */
async function tolerant(
  what: string,
  table: keyof typeof MIGRATION_004,
  rows: Row[],
  send: (rows: Row[]) => PromiseLike<{ error: unknown }>,
): Promise<void> {
  const { error } = await send(rows);
  if (!error) return;

  const message = String((error as { message?: unknown }).message ?? error);
  const columns = MIGRATION_004[table] ?? [];
  const missing = columns.find(
    (c) => message.includes(`'${c}' column`) || message.includes(`.${c} does not exist`),
  );
  if (!missing) fail(what, error);

  console.warn(
    `[db] ${table} has no "${missing}" column — writing without ${columns.join(", ")}. ` +
      `Run apps/web/supabase/004-fit-and-two-images.sql.`,
  );

  must(
    what,
    await send(
      rows.map((row) => {
        const copy = { ...row };
        for (const column of columns) delete copy[column];
        return copy;
      }),
    ),
  );
}

export async function insertGarments(items: Garment[]): Promise<Garment[]> {
  if (!items.length) return [];
  await tolerant("insertGarments", "rangrez_garments", items.map(fromGarment), (rows) =>
    supabase().from("rangrez_garments").insert(rows),
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
      | "name" | "zone" | "dye" | "season" | "material" | "wornCount"
      | "inPalette" | "status" | "tryOnUrl" | "tryOnAvatarId" | "taskId"
      | "imageUrl" | "originalUrl" | "fit" | "sizeLabel"
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
  if (fields.status !== undefined) row.status = fields.status;
  if (fields.taskId !== undefined) row.task_id = fields.taskId;
  if (fields.imageUrl !== undefined) row.image_url = fields.imageUrl;
  if (fields.originalUrl !== undefined) row.original_url = fields.originalUrl ?? null;
  if (fields.fit !== undefined) row.fit = fields.fit ?? null;
  if (fields.sizeLabel !== undefined) row.size_label = fields.sizeLabel ?? null;
  // Nullable on purpose: clearing a render is how a failed retry resets.
  if (fields.tryOnUrl !== undefined) row.try_on_url = fields.tryOnUrl ?? null;
  if (fields.tryOnAvatarId !== undefined) {
    row.try_on_avatar_id = fields.tryOnAvatarId ?? null;
  }
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
