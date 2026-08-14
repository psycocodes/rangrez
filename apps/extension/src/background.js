/**
 * ═══════════════════════════════════════════════════════════════════════════
 *  Service worker
 * ═══════════════════════════════════════════════════════════════════════════
 *
 *  Holds three things the content script must not:
 *    · the bearer token
 *    · host permissions, so a shop's CDN can be fetched without CORS
 *    · an OffscreenCanvas, for reading pixels off those images
 *
 *  Everything the page-side code needs arrives as a message and leaves as a
 *  plain object.
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { api } from "./lib/api.js";
import { prepareReference, scorePixels } from "./lib/score.js";

const DEFAULT_API = "http://localhost:3000";

/* ── config ─────────────────────────────────────────────────────────────── */

async function config() {
  const { token, apiBase } = await api.storage.local.get(["token", "apiBase"]);
  return { token: token || null, apiBase: apiBase || DEFAULT_API };
}

async function callRangrez(path, init = {}) {
  const { token, apiBase } = await config();
  if (!token) throw new Error("not-paired");

  const res = await fetch(`${apiBase}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(init.headers || {}),
    },
  });

  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(body.error || `Request failed (${res.status}).`);
    err.code = body.code;
    throw err;
  }
  return body;
}

/* ═══ ISOLATION PASS ═══════════════════════════════════════════════════════
 *
 *  Given every photograph in a product gallery, work out which one shows the
 *  garment most cleanly on its own. Apparel VTO wants a garment, not a scene:
 *  a flat product shot on seamless white transfers far more faithfully than
 *  the hero shot of a model wearing it in a field.
 *
 *  Four measurements per image, on a 96px thumbnail — enough signal, and fast
 *  enough to run the whole gallery in parallel while the panel animates.
 * ═════════════════════════════════════════════════════════════════════════ */


async function measure(url) {
  const res = await fetch(url, { credentials: "omit", cache: "force-cache" });
  if (!res.ok) throw new Error(`fetch ${res.status}`);

  const blob = await res.blob();
  if (!blob.type.startsWith("image/")) throw new Error("not an image");

  const bitmap = await createImageBitmap(blob);
  const W = 96;
  const H = Math.max(1, Math.round((W * bitmap.height) / bitmap.width));
  const canvas = new OffscreenCanvas(W, H);
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  ctx.drawImage(bitmap, 0, 0, W, H);
  const { data } = ctx.getImageData(0, 0, W, H);
  const natural = { w: bitmap.width, h: bitmap.height };
  bitmap.close();

  return { url, ...scorePixels(data, W, H, natural) };
}

async function analyse(candidates) {
  const list = candidates.slice(0, 6);
  const settled = await Promise.allSettled(list.map((c) => measure(c.url)));

  // Order is preserved on purpose: the panel paints these back onto the
  // thumbnail strip by index.
  const scored = settled.map((r, i) =>
    r.status === "fulfilled"
      ? r.value
      : { url: list[i].url, score: 0, dominantColor: "#6d6555", failed: true },
  );

  const winner = scored
    .filter((s) => !s.failed)
    .sort((a, b) => b.score - a.score)[0];

  return { scored, winner: winner || null };
}

/* ── messages ───────────────────────────────────────────────────────────── */

const HANDLERS = {
  async SESSION() {
    const { token, apiBase } = await config();
    if (!token) return { connected: false, apiBase };
    try {
      return { ...(await callRangrez("/api/extension/session")), apiBase };
    } catch (err) {
      if (err.message === "not-paired" || err.code === "no-token") {
        return { connected: false, apiBase };
      }
      // The app being down shouldn't read as "you never paired".
      return { connected: false, apiBase, unreachable: true, error: err.message };
    }
  },

  ANALYSE: ({ candidates }) => analyse(candidates || []),

  /**
   * Fallback path for the finished render.
   *
   * The result lives on YouCam's S3 bucket, and a shop page's CSP may refuse
   * to load an image from a host it doesn't know — which would mean the whole
   * flow works and then shows nothing. The service worker isn't bound by the
   * page's CSP, so it re-fetches, downscales to panel width, and hands back an
   * inline data URL.
   */
  async RENDER_IMAGE({ url }) {
    const res = await fetch(url, { credentials: "omit" });
    if (!res.ok) throw new Error(`render fetch ${res.status}`);

    const bitmap = await createImageBitmap(await res.blob());
    const W = Math.min(800, bitmap.width);
    const H = Math.round((W * bitmap.height) / bitmap.width);
    const canvas = new OffscreenCanvas(W, H);
    canvas.getContext("2d").drawImage(bitmap, 0, 0, W, H);
    bitmap.close();

    const blob = await canvas.convertToBlob({ type: "image/jpeg", quality: 0.9 });
    const bytes = new Uint8Array(await blob.arrayBuffer());

    let binary = "";
    for (let i = 0; i < bytes.length; i += 0x8000) {
      binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    }
    return { dataUrl: `data:image/jpeg;base64,${btoa(binary)}` };
  },

  /**
   * Sends the *prepared* reference rather than a URL. Two wins: the server
   * doesn't re-fetch an image we already hold (one less round trip on a slow
   * shop CDN), and YouCam gets the cropped, flattened version instead of the
   * raw editorial shot. Falls back to the URL if preparation fails, so a
   * canvas hiccup can't take the feature down.
   */
  async TRYON({ imageUrl, category, avatarId }) {
    let prepared = null;
    try {
      prepared = await prepareReference(imageUrl);
    } catch (err) {
      console.warn("[rangrez] couldn't prepare the reference, sending the URL", err);
    }

    return callRangrez("/api/extension/tryon", {
      method: "POST",
      body: JSON.stringify({
        category,
        // Omitted entirely when there was no choice to make, so the server
        // falls back to whichever plate is in use.
        ...(avatarId ? { avatarId } : {}),
        ...(prepared
          ? { imageData: prepared.base64, contentType: "image/jpeg" }
          : { imageUrl }),
      }),
    });
  },

  SAVE: (msg) =>
    callRangrez("/api/extension/save", {
      method: "POST",
      body: JSON.stringify({
        name: msg.name,
        zone: msg.zone,
        vtoTarget: msg.vtoTarget,
        avatarId: msg.avatarId,
        dominantColor: msg.dominantColor,
        material: msg.material,
        renderUrl: msg.renderUrl,
        sourceUrl: msg.sourceUrl,
      }),
    }),

  async PAIR({ token, apiBase }) {
    if (!token) throw new Error("No token on the page.");
    await api.storage.local.set({ token, apiBase: apiBase || DEFAULT_API });
    return { paired: true };
  },

  async UNPAIR() {
    await api.storage.local.remove(["token"]);
    return { paired: false };
  },

  async OPEN({ url }) {
    await api.tabs.create({ url });
    return { opened: true };
  },

  async DISMISS({ host }) {
    const { dismissed = [] } = await api.storage.local.get("dismissed");
    if (!dismissed.includes(host)) {
      await api.storage.local.set({ dismissed: [...dismissed, host] });
    }
    return { dismissed: true };
  },

  async GET_DISMISSED({ host }) {
    const { dismissed = [] } = await api.storage.local.get("dismissed");
    return { dismissed: dismissed.includes(host) };
  },

  async CLEAR_DISMISSED() {
    await api.storage.local.set({ dismissed: [] });
    return { cleared: true };
  },
};

api.runtime.onMessage.addListener((msg, _sender, respond) => {
  const handler = HANDLERS[msg?.type];
  if (!handler) {
    respond({ error: `Unknown message: ${msg?.type}` });
    return false;
  }
  Promise.resolve(handler(msg))
    .then(respond)
    .catch((err) => respond({ error: err?.message || String(err) }));
  return true; // keep the channel open for the async reply
});

api.runtime.onInstalled.addListener(async ({ reason }) => {
  const { apiBase } = await api.storage.local.get("apiBase");
  if (!apiBase) await api.storage.local.set({ apiBase: DEFAULT_API });
  if (reason === "install") {
    await api.tabs.create({ url: `${apiBase || DEFAULT_API}/connect` });
  }
});
