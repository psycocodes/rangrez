/**
 * One-shot migration: the old `.data/db.json` store → Supabase.
 *
 *   node apps/web/scripts/migrate-json-to-supabase.mjs
 *
 * Idempotent — rows are upserted by primary key, so re-running is safe and
 * won't duplicate a wardrobe. Reads the same .env.local the app does.
 */

import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const web = join(dirname(fileURLToPath(import.meta.url)), "..");

const env = Object.fromEntries(
  readFileSync(join(web, ".env.local"), "utf8")
    .split("\n")
    .filter((l) => l && !l.trim().startsWith("#") && l.includes("="))
    .map((l) => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim()]),
);

const url = env.NEXT_PUBLIC_SUPABASE_URL;
const key =
  env.SUPABASE_SECRET_KEY ||
  env.SUPABASE_SERVICE_ROLE_KEY ||
  env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

if (!url || !key) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or a Supabase key in .env.local");
  process.exit(1);
}
if (!env.SUPABASE_SECRET_KEY && !env.SUPABASE_SERVICE_ROLE_KEY) {
  console.warn("⚠  No secret key — this will fail against a schema with RLS on.\n");
}

const file = join(web, ".data", "db.json");
if (!existsSync(file)) {
  console.log("No .data/db.json to migrate. Nothing to do.");
  process.exit(0);
}

const db = JSON.parse(readFileSync(file, "utf8"));
const sb = createClient(url, key, { auth: { persistSession: false } });

const users = (db.users ?? []).map((u) => ({
  id: u.id,
  email: u.email,
  name: u.name,
  password_hash: u.passwordHash,
  avatar: u.avatar ?? null,
  preferences: u.preferences ?? {},
  created_at: u.createdAt,
}));

const garments = (db.garments ?? []).map((g) => ({
  id: /^[0-9a-f-]{36}$/i.test(g.id) ? g.id : crypto.randomUUID(),
  user_id: g.userId,
  name: g.name,
  origin: g.origin,
  zone: g.zone,
  dye: g.dye,
  season: g.season,
  material: g.material ?? "",
  image_url: g.imageUrl,
  seed: g.seed ?? "",
  status: g.status ?? "rendered",
  task_id: g.taskId ?? null,
  in_palette: Boolean(g.inPalette),
  worn_count: g.wornCount ?? 0,
  source_url: g.sourceUrl ?? null,
  added_at: g.addedAt,
}));

const fits = (db.fits ?? []).map((f) => ({
  id: f.id,
  user_id: f.userId,
  name: f.name,
  garment_ids: f.garmentIds ?? [],
  note: f.note ?? null,
  saved_at: f.savedAt,
}));

async function push(table, rows) {
  if (!rows.length) return console.log(`  ${table}: nothing to move`);
  const { error } = await sb.from(table).upsert(rows, { onConflict: "id" });
  if (error) {
    console.error(`  ${table}: FAILED — ${error.message}`);
    process.exitCode = 1;
  } else {
    console.log(`  ${table}: ${rows.length} row(s)`);
  }
}

console.log(`Migrating ${file} → ${url}\n`);
// Users first: garments and fits carry a foreign key to them.
await push("rangrez_users", users);
await push("rangrez_garments", garments);
await push("rangrez_fits", fits);

console.log(
  process.exitCode
    ? "\nFinished with errors — check the schema is applied (supabase/schema.sql)."
    : "\nDone. Your wardrobe is in Supabase.",
);
