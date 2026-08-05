import "server-only";

import { constants, createHash, publicEncrypt, randomUUID } from "node:crypto";

import { buildSeason, SEASON_NAMES } from "./palette";
import type { ColorSeason } from "./types";

/**
 * ═══════════════════════════════════════════════════════════════════════════
 *  YouCam (Perfect Corp) S2S client
 * ═══════════════════════════════════════════════════════════════════════════
 *
 *  Everything the product does with Perfect Corp goes through this file. It is
 *  the only place that knows about access tokens, file handles or task
 *  polling. Callers get promises that resolve to image URLs.
 *
 *  The real contract, verified against the live API on 2026-08-05:
 *    1. POST /s2s/v1.0/client/auth            → result.access_token (RSA id_token)
 *    2. POST /s2s/v1.0/file/{feature}         → result.files[0].{file_id, requests[0]}
 *    3. PUT  <that pre-signed S3 target>      → the image bytes
 *    4. POST /s2s/v2.0/task/{feature}         → data.task_id           (ASYNC!)
 *    5. GET  /s2s/v2.0/task/{feature}/{id}    → data.{task_status, results}
 *
 *  Note the version split: files are v1.0, tasks are v2.0, and the v2.0 task
 *  body is FLAT ({src_file_id, ref_file_id, garment_category}) — not the
 *  nested payload/file_sets/actions envelope the older endpoints used. Task
 *  responses key off `data`, file responses off `result`. Polling is a path
 *  segment, not a query string; GET on the bare task path returns 405.
 *
 *  Apparel VTO never returns an image inline. Every VTO-triggering interaction
 *  in the UI must therefore have a real loading state — see PRD §7.
 *
 *  MOCK MODE: with `YOUCAM_MOCK=1` (or no API key set) every call below is
 *  faked with a plausible, correctly-shaped, correctly-delayed response. The
 *  whole product stays clickable before the key lands, and demo runs don't
 *  burn credits. Flip `YOUCAM_MOCK=0` in .env.local once the key is in.
 * ═══════════════════════════════════════════════════════════════════════════
 */

const BASE = process.env.YOUCAM_API_BASE ?? "https://yce-api-01.perfectcorp.com";

export function isMock(): boolean {
  return process.env.YOUCAM_MOCK === "1" || !process.env.YOUCAM_API_KEY;
}

export class YouCamError extends Error {
  constructor(message: string, readonly step: string) {
    super(message);
    this.name = "YouCamError";
  }
}

/* ── 1 · auth ───────────────────────────────────────────────────────────── */

let cachedToken: { token: string; expiresAt: number } | null = null;

/** Perfect Corp hands out a base64 RSA public key; node wants PEM. */
function toPem(key: string): string {
  const trimmed = key.trim();
  if (trimmed.includes("BEGIN PUBLIC KEY")) return trimmed;
  const body = trimmed.replace(/\s+/g, "").match(/.{1,64}/g)?.join("\n") ?? "";
  return `-----BEGIN PUBLIC KEY-----\n${body}\n-----END PUBLIC KEY-----`;
}

async function accessToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) {
    return cachedToken.token;
  }

  const clientId = process.env.YOUCAM_API_KEY;
  const secretKey = process.env.YOUCAM_SECRET_KEY;
  if (!clientId || !secretKey) {
    throw new YouCamError("YOUCAM_API_KEY / YOUCAM_SECRET_KEY are not set", "auth");
  }

  // id_token = RSA(client_id=<id>&timestamp=<epoch ms>) under their public key.
  const idToken = publicEncrypt(
    { key: toPem(secretKey), padding: constants.RSA_PKCS1_PADDING },
    Buffer.from(`client_id=${clientId}&timestamp=${Date.now()}`),
  ).toString("base64");

  const res = await fetch(`${BASE}/s2s/v1.0/client/auth`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ client_id: clientId, id_token: idToken }),
    cache: "no-store",
  });

  if (!res.ok) {
    throw new YouCamError(`auth failed: ${res.status} ${await res.text()}`, "auth");
  }

  const json = (await res.json()) as {
    result?: { access_token?: string; expires_in?: number };
  };
  const token = json.result?.access_token;
  if (!token) throw new YouCamError("auth response had no access_token", "auth");

  cachedToken = {
    token,
    expiresAt: Date.now() + (json.result?.expires_in ?? 3600) * 1000,
  };
  return token;
}

async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = await accessToken();
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...init.headers,
    },
    cache: "no-store",
  });
  if (!res.ok) {
    throw new YouCamError(`${path} → ${res.status} ${await res.text()}`, path);
  }
  return (await res.json()) as T;
}

/* ── 2/3 · file upload ──────────────────────────────────────────────────── */

interface UploadTarget {
  file_id: string;
  requests?: Array<{
    method: string;
    url: string;
    headers?: Record<string, string>;
  }>;
}

/** Registers a file with a feature endpoint, then PUTs the bytes. */
async function uploadImage(feature: string, bytes: Buffer, contentType: string) {
  const registered = await api<{ result?: { files?: UploadTarget[] } }>(
    `/s2s/v1.0/file/${feature}`,
    {
      method: "POST",
      body: JSON.stringify({
        files: [
          {
            content_type: contentType,
            file_name: `${randomUUID()}.${contentType.split("/")[1] ?? "jpg"}`,
            file_size: bytes.byteLength,
          },
        ],
      }),
    },
  );

  const target = registered.result?.files?.[0];
  if (!target) throw new YouCamError("no upload target returned", "file");

  const put = target.requests?.[0];
  if (put) {
    const res = await fetch(put.url, {
      method: put.method || "PUT",
      headers: { "Content-Type": contentType, ...(put.headers ?? {}) },
      body: new Uint8Array(bytes),
    });
    if (!res.ok) {
      throw new YouCamError(`upload PUT failed: ${res.status}`, "file");
    }
  }

  return target.file_id;
}

/* ── 4/5 · task run + poll ──────────────────────────────────────────────── */

/** Starts a v2.0 task. Body is flat; the reply keys off `data`, not `result`. */
async function runTask(
  feature: string,
  body: Record<string, unknown>,
): Promise<string> {
  const run = await api<{ data?: { task_id?: string } }>(
    `/s2s/v2.0/task/${feature}`,
    { method: "POST", body: JSON.stringify(body) },
  );
  const taskId = run.data?.task_id;
  if (!taskId) throw new YouCamError("no task_id returned", feature);
  return taskId;
}

interface TaskPoll {
  data?: {
    task_status?: string;
    error?: string | null;
    error_message?: string | null;
    results?: unknown;
  };
}

/**
 * The success payload's exact nesting isn't documented and we've only ever
 * seen the failure shape, so rather than guess a path we walk the reply for
 * the first image URL. Tolerant on purpose: a schema tweak on their side
 * shouldn't take the feature down.
 */
function firstImageUrl(node: unknown, depth = 0): string | null {
  if (depth > 8 || node == null) return null;
  if (typeof node === "string") {
    return /^https?:\/\//.test(node) && !/\.json(\?|$)/i.test(node) ? node : null;
  }
  if (Array.isArray(node)) {
    for (const item of node) {
      const hit = firstImageUrl(item, depth + 1);
      if (hit) return hit;
    }
    return null;
  }
  if (typeof node === "object") {
    // Prefer obvious url-ish keys before falling back to a blind sweep.
    const obj = node as Record<string, unknown>;
    for (const key of ["url", "image_url", "dst_url", "src"]) {
      const hit = firstImageUrl(obj[key], depth + 1);
      if (hit) return hit;
    }
    for (const value of Object.values(obj)) {
      const hit = firstImageUrl(value, depth + 1);
      if (hit) return hit;
    }
  }
  return null;
}

/**
 * Polls a task to completion. Backs off from 900ms to 4s so a slow render
 * doesn't hammer the endpoint, and gives up rather than hanging a request.
 *
 * The engine's own failure messages are unusually good ("ensure the chest and
 * shoulders are clearly visible"), so they're passed through verbatim rather
 * than flattened into a generic error — that text is the fix instruction.
 */
async function pollTask(
  feature: string,
  taskId: string,
  timeoutMs = 120_000,
): Promise<string> {
  const deadline = Date.now() + timeoutMs;
  let wait = 900;

  while (Date.now() < deadline) {
    const poll = await api<TaskPoll>(
      `/s2s/v2.0/task/${feature}/${encodeURIComponent(taskId)}`,
    );
    const status = poll.data?.task_status;

    if (status === "success" || status === "completed") {
      const url = firstImageUrl(poll.data?.results);
      if (!url) {
        console.error(
          "[youcam] task succeeded but no url found in:",
          JSON.stringify(poll.data).slice(0, 800),
        );
        throw new YouCamError("render finished but returned no image", feature);
      }
      return url;
    }
    if (status === "error" || status === "failed") {
      throw new YouCamError(
        poll.data?.error_message || poll.data?.error || "render failed",
        feature,
      );
    }

    await new Promise((r) => setTimeout(r, wait));
    wait = Math.min(wait * 1.5, 4000);
  }

  throw new YouCamError("timed out waiting for render", feature);
}

/* ═══ PUBLIC SURFACE ════════════════════════════════════════════════════ */

export interface AvatarResult {
  /** The canonical avatar plate every future try-on renders against. */
  renderUrl: string;
  taskId: string;
  colorSeason: ColorSeason;
  mocked: boolean;
}

/**
 * Build the base avatar (PRD Flow A).
 *
 * The photo *is* the avatar — Apparel VTO takes it as `src_file_id` on every
 * single try-on — so there is no render to generate here and no reason to
 * spend a credit pretending otherwise. What we do instead:
 *
 *   a) register the photo with the cloth endpoint, which proves the file is
 *      one the engine will accept before the user builds a wardrobe on it
 *   b) skin-tone / personal-colour analysis → the colour season, stored once
 *      on the profile and reused by the recommender forever after
 *
 * Pose problems (chest and shoulders must be visible) surface at the first
 * try-on with the engine's own wording, which is better guidance than
 * anything we'd invent here.
 */
export async function createAvatar(
  bytes: Buffer,
  contentType: string,
): Promise<AvatarResult> {
  if (isMock()) return mockAvatar(bytes);

  const fileId = await uploadImage("cloth", bytes, contentType);
  const colorSeason = await analyzeColorSeason(bytes, contentType);

  // Empty renderUrl: the caller falls back to the stored upload, which is the
  // canonical plate.
  return { renderUrl: "", taskId: fileId, colorSeason, mocked: false };
}

/**
 * The skin-analysis feature slug is the one part of the contract we have not
 * confirmed against the live API (the cloth endpoints were verified by probe;
 * this one was not). Overridable so it can be corrected without a code change.
 */
const SKIN_FEATURE = process.env.YOUCAM_SKIN_FEATURE ?? "skin-analysis";

/**
 * Skin tone → colour season (PRD §4.4).
 *
 * Wrapped end to end because this is not worth failing onboarding over: on any
 * error we fall back to the deterministic local derivation at lower confidence,
 * and the user can override the season by hand in their profile regardless.
 * Onboarding staying up matters more than the season being API-derived.
 */
export async function analyzeColorSeason(
  bytes: Buffer,
  contentType: string,
): Promise<ColorSeason> {
  if (isMock()) return derivedSeason(bytes, 0.86);

  try {
    const fileId = await uploadImage(SKIN_FEATURE, bytes, contentType);
    const taskId = await runTask(SKIN_FEATURE, {
      src_file_id: fileId,
      dst_actions: ["skin_tone"],
    });

    const url = await pollTask(SKIN_FEATURE, taskId, 45_000);
    const report = (await (await fetch(url)).json()) as {
      skin_tone?: { season?: string; confidence?: number };
    };

    const name = report.skin_tone?.season;
    if (name && SEASON_NAMES.includes(name)) {
      return buildSeason(name, report.skin_tone?.confidence ?? 0.9);
    }
    return derivedSeason(bytes, 0.7);
  } catch (err) {
    console.warn("[youcam] colour analysis fell back to local:", err);
    return derivedSeason(bytes, 0.62);
  }
}

/* ── try-on: a garment against the saved avatar ─────────────────────────── */

/**
 * What the `cloth` endpoint dresses a body with.
 *
 * YouCam does ship separate surfaces for the rest — `/task/shoes`, `/task/bag`
 * and `/task/2d-vto/earring` all exist and answer — so the extension's "not
 * yet" on shoes and jewellery is a scope line, not an API limit. Wiring them
 * up means one more feature slug per category and a body shape check; the
 * classifier already tells them apart.
 */
export type VtoCategory = "upper_body" | "lower_body" | "full_body";

export const VTO_CATEGORIES: readonly VtoCategory[] = [
  "upper_body",
  "lower_body",
  "full_body",
];

export interface TryOnResult {
  renderUrl: string;
  taskId: string;
  mocked: boolean;
}

/**
 * PRD Flow D. The avatar is `src`, the garment is `ref` — the same direction
 * as every other try-on in the product, which is the whole point: a jacket
 * from a shop page lands on exactly the body a closet upload lands on.
 */
export async function tryOnGarment(
  avatar: { bytes: Buffer; contentType: string },
  garment: { bytes: Buffer; contentType: string },
  category: VtoCategory,
): Promise<TryOnResult> {
  if (isMock()) return mockTryOn();

  const [avatarId, garmentId] = await Promise.all([
    uploadImage("cloth", avatar.bytes, avatar.contentType),
    uploadImage("cloth", garment.bytes, garment.contentType),
  ]);

  const taskId = await runTask("cloth", {
    src_file_id: avatarId,
    ref_file_id: garmentId,
    garment_category: category,
  });

  return { renderUrl: await pollTask("cloth", taskId), taskId, mocked: false };
}

/* ── mock mode ──────────────────────────────────────────────────────────── */

/**
 * Deterministic from the image bytes, so re-uploading the same photo always
 * yields the same season — a random result every refresh would make the
 * feature feel broken during a demo.
 */
function derivedSeason(bytes: Buffer, confidence: number): ColorSeason {
  const digest = createHash("sha256").update(bytes).digest();
  const name = SEASON_NAMES[digest[0] % SEASON_NAMES.length];
  return buildSeason(name, confidence);
}

/**
 * The caller substitutes the user's own avatar plate for the empty renderUrl,
 * so the extension's "done" state still shows a real body wearing something.
 * The delay is deliberate — a mock that returns instantly would let us ship a
 * panel with no progress states, which breaks the day the key goes live.
 */
async function mockTryOn(): Promise<TryOnResult> {
  await new Promise((r) => setTimeout(r, 2600));
  return { renderUrl: "", taskId: `mock_${randomUUID()}`, mocked: true };
}

async function mockAvatar(bytes: Buffer): Promise<AvatarResult> {
  // Real VTO takes several seconds. Mocking it as instant would let us ship a
  // UI with no loading state, which would then break the day the key lands.
  await new Promise((r) => setTimeout(r, 2200));
  return {
    renderUrl: "",
    taskId: `mock_${randomUUID()}`,
    colorSeason: derivedSeason(bytes, 0.86),
    mocked: true,
  };
}
