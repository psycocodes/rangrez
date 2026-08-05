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
 *  The real contract, for reference:
 *    1. POST /s2s/v1.0/client/auth        → access_token (RSA-signed id_token)
 *    2. POST /s2s/v1.0/file/{feature}     → file_id + a pre-signed PUT target
 *    3. PUT  <that target>                → the image bytes
 *    4. POST /s2s/v1.1/task/{feature}     → task_id                (ASYNC!)
 *    5. GET  /s2s/v1.1/task/{feature}?... → poll until success → result URL
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

interface TaskPoll {
  result?: {
    status?: string;
    error?: string;
    results?: Array<{ data?: Array<{ url?: string }> }>;
  };
}

/**
 * Polls a task to completion. Backs off from 900ms to 4s so a slow render
 * doesn't hammer the endpoint, and gives up rather than hanging a request.
 */
async function pollTask(
  feature: string,
  taskId: string,
  timeoutMs = 90_000,
): Promise<string> {
  const deadline = Date.now() + timeoutMs;
  let wait = 900;

  while (Date.now() < deadline) {
    const poll = await api<TaskPoll>(
      `/s2s/v1.1/task/${feature}?task_id=${encodeURIComponent(taskId)}`,
    );
    const status = poll.result?.status;

    if (status === "success") {
      const url = poll.result?.results?.[0]?.data?.[0]?.url;
      if (!url) throw new YouCamError("task succeeded with no result url", feature);
      return url;
    }
    if (status === "error" || status === "failed") {
      throw new YouCamError(poll.result?.error ?? "task failed", feature);
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
 * Two passes over the same photo:
 *   a) an Apparel VTO calibration render — this both normalises framing and,
 *      more importantly, *proves the photo actually works with VTO* before the
 *      user builds an entire wardrobe on top of it. A photo that fails here
 *      would have failed on every garment later.
 *   b) skin-tone / personal-colour analysis → the user's colour season, stored
 *      once on the profile and reused by the recommender forever after.
 */
export async function createAvatar(
  bytes: Buffer,
  contentType: string,
): Promise<AvatarResult> {
  if (isMock()) return mockAvatar(bytes);

  const fileId = await uploadImage("apparel-transfer", bytes, contentType);

  const run = await api<{ result?: { task_id?: string } }>(
    `/s2s/v1.1/task/apparel-transfer`,
    {
      method: "POST",
      body: JSON.stringify({
        request_id: Date.now(),
        payload: {
          file_sets: { src_ids: [fileId] },
          actions: [
            {
              id: 0,
              params: {
                // Neutral calibration garment: we want the body, not the look.
                style_id: process.env.YOUCAM_CALIBRATION_STYLE_ID ?? undefined,
              },
            },
          ],
        },
      }),
    },
  );

  const taskId = run.result?.task_id;
  if (!taskId) throw new YouCamError("no task_id returned", "apparel-transfer");

  const renderUrl = await pollTask("apparel-transfer", taskId);
  const colorSeason = await analyzeColorSeason(bytes, contentType);

  return { renderUrl, taskId, colorSeason, mocked: false };
}

/**
 * Skin tone → colour season (PRD §4.4).
 *
 * The analysis endpoint is the least stable part of the S2S surface, and it is
 * not worth failing the whole onboarding over: if it errors we fall back to
 * the deterministic local derivation and mark lower confidence. The user can
 * override the season by hand in their profile either way.
 */
export async function analyzeColorSeason(
  bytes: Buffer,
  contentType: string,
): Promise<ColorSeason> {
  if (isMock()) return derivedSeason(bytes, 0.86);

  try {
    const fileId = await uploadImage("skin-analysis", bytes, contentType);
    const run = await api<{ result?: { task_id?: string } }>(
      `/s2s/v1.1/task/skin-analysis`,
      {
        method: "POST",
        body: JSON.stringify({
          request_id: Date.now(),
          payload: {
            file_sets: { src_ids: [fileId] },
            actions: [{ id: 0, params: { dst_actions: ["skin_tone"] } }],
          },
        }),
      },
    );
    const taskId = run.result?.task_id;
    if (!taskId) throw new YouCamError("no task_id", "skin-analysis");

    const url = await pollTask("skin-analysis", taskId, 45_000);
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
