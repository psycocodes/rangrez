import "server-only";

import { promises as fs } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";

import type { ColorSeason, Garment, SavedFit, User } from "./types";
import { seedCatalog } from "./seed";
import { isInPalette } from "./palette";

/**
 * Hackathon persistence: a single JSON file under `.data/`.
 *
 * Every caller goes through the exported functions below, never through `fs`.
 * Swapping this for Postgres (per the PRD tech stack) means reimplementing
 * these ~10 functions and nothing else.
 */

const DB_DIR = path.join(process.cwd(), ".data");
const DB_FILE = path.join(DB_DIR, "db.json");

interface Schema {
  users: User[];
  garments: Garment[];
  fits: SavedFit[];
}

const EMPTY: Schema = { users: [], garments: [], fits: [] };

/** Serialise writes so two concurrent requests can't clobber the file. */
let queue: Promise<unknown> = Promise.resolve();

function serialize<T>(job: () => Promise<T>): Promise<T> {
  const run = queue.then(job, job);
  queue = run.catch(() => {});
  return run;
}

async function read(): Promise<Schema> {
  try {
    const raw = await fs.readFile(DB_FILE, "utf8");
    return { ...EMPTY, ...(JSON.parse(raw) as Partial<Schema>) };
  } catch {
    return structuredClone(EMPTY);
  }
}

async function write(db: Schema): Promise<void> {
  await fs.mkdir(DB_DIR, { recursive: true });
  await fs.writeFile(DB_FILE, JSON.stringify(db, null, 2), "utf8");
}

/** Read → mutate → write, under the write lock. */
function mutate<T>(fn: (db: Schema) => T | Promise<T>): Promise<T> {
  return serialize(async () => {
    const db = await read();
    const out = await fn(db);
    await write(db);
    return out;
  });
}

export const newId = () => randomUUID();

/* ── users ──────────────────────────────────────────────────────────────── */

export async function findUserByEmail(email: string): Promise<User | undefined> {
  const db = await read();
  const needle = email.trim().toLowerCase();
  return db.users.find((u) => u.email === needle);
}

export async function findUserById(id: string): Promise<User | undefined> {
  const db = await read();
  return db.users.find((u) => u.id === id);
}

export async function insertUser(user: User): Promise<User> {
  return mutate((db) => {
    db.users.push(user);
    // A brand-new closet is a bad demo. Seed a starter wardrobe so the grid has
    // something to say on first load; every piece is flagged origin:"seed" and
    // can be cleared from the profile.
    db.garments.push(...seedCatalog(user.id));
    return user;
  });
}

export async function updateUser(
  id: string,
  patch: (user: User) => void,
): Promise<User | undefined> {
  return mutate((db) => {
    const user = db.users.find((u) => u.id === id);
    if (user) patch(user);
    return user;
  });
}

/* ── garments ───────────────────────────────────────────────────────────── */

export async function listGarments(userId: string): Promise<Garment[]> {
  const db = await read();
  return db.garments
    .filter((g) => g.userId === userId)
    .sort((a, b) => b.addedAt.localeCompare(a.addedAt));
}

export async function insertGarments(items: Garment[]): Promise<Garment[]> {
  return mutate((db) => {
    db.garments.push(...items);
    return items;
  });
}

export async function updateGarment(
  id: string,
  patch: (g: Garment) => void,
): Promise<Garment | undefined> {
  return mutate((db) => {
    const g = db.garments.find((x) => x.id === id);
    if (g) patch(g);
    return g;
  });
}

/**
 * Re-rank the whole catalog against a colour season. Called once whenever the
 * avatar's skin-tone analysis lands or the user overrides their season by hand
 * — the ranking is ours, not YouCam's, so it costs nothing to redo (PRD §8).
 */
export async function recomputePalette(
  userId: string,
  season: ColorSeason | undefined,
): Promise<number> {
  return mutate((db) => {
    let touched = 0;
    for (const g of db.garments) {
      if (g.userId !== userId) continue;
      const next = isInPalette(g.dye, season);
      if (next !== g.inPalette) touched++;
      g.inPalette = next;
    }
    return touched;
  });
}

export async function deleteSeedGarments(userId: string): Promise<number> {
  return mutate((db) => {
    const before = db.garments.length;
    db.garments = db.garments.filter(
      (g) => !(g.userId === userId && g.origin === "seed"),
    );
    return before - db.garments.length;
  });
}

/* ── saved fits ─────────────────────────────────────────────────────────── */

export async function listFits(userId: string): Promise<SavedFit[]> {
  const db = await read();
  return db.fits
    .filter((f) => f.userId === userId)
    .sort((a, b) => b.savedAt.localeCompare(a.savedAt));
}

export async function insertFit(fit: SavedFit): Promise<SavedFit> {
  return mutate((db) => {
    db.fits.push(fit);
    return fit;
  });
}
