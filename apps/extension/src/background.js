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

const DEFAULT_API = "http://localhost:3000";

/* ── config ─────────────────────────────────────────────────────────────── */

async function config() {
  const { token, apiBase } = await chrome.storage.local.get(["token", "apiBase"]);
  return { token: token || null, apiBase: apiBase || DEFAULT_API };
}

async function api(path, init = {}) {
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

const clamp01 = (n) => Math.max(0, Math.min(1, n));

/** Kovac's RGB rule. Cheap, and we only need "is there a person here". */
function isSkin(r, g, b) {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  return (
    r > 95 && g > 40 && b > 20 &&
    max - min > 15 &&
    Math.abs(r - g) > 15 &&
    r > g && r > b
  );
}

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

  const at = (x, y) => {
    const i = (y * W + x) * 4;
    return [data[i], data[i + 1], data[i + 2]];
  };

  // ── 1 · how uniform is the backdrop? ────────────────────────────────
  const band = 3;
  const edge = [];
  for (let x = 0; x < W; x++) {
    for (let d = 0; d < band; d++) {
      edge.push(at(x, d), at(x, H - 1 - d));
    }
  }
  for (let y = band; y < H - band; y++) {
    for (let d = 0; d < band; d++) {
      edge.push(at(d, y), at(W - 1 - d, y));
    }
  }

  const bg = [0, 1, 2].map(
    (c) => edge.reduce((s, p) => s + p[c], 0) / edge.length,
  );
  const bgLum = 0.299 * bg[0] + 0.587 * bg[1] + 0.114 * bg[2];
  const variance =
    edge.reduce((s, p) => {
      const lum = 0.299 * p[0] + 0.587 * p[1] + 0.114 * p[2];
      return s + (lum - bgLum) ** 2;
    }, 0) / edge.length;
  const sd = Math.sqrt(variance);

  // Seamless backdrop = low deviation. A light one is the studio convention,
  // so it earns a small bonus rather than being a requirement.
  const backdrop = clamp01(1 - sd / 58) * 0.85 + clamp01(bgLum / 255) * 0.15;

  // ── 2 · subject pixels, skin, and the garment's colour ──────────────
  let subject = 0;
  let skin = 0;
  const sum = [0, 0, 0];

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i], g = data[i + 1], b = data[i + 2];
    if (isSkin(r, g, b)) skin++;
    const dist = Math.abs(r - bg[0]) + Math.abs(g - bg[1]) + Math.abs(b - bg[2]);
    if (dist > 62) {
      subject++;
      sum[0] += r; sum[1] += g; sum[2] += b;
    }
  }

  const px = data.length / 4;
  const coverage = subject / px;
  const skinFraction = skin / px;

  const dominant =
    subject > 0
      ? "#" + sum.map((c) => Math.round(c / subject).toString(16).padStart(2, "0")).join("")
      : "#6d6555";

  // ── 3 · score ───────────────────────────────────────────────────────
  // A model shot is not useless, just worse — hence a graded penalty rather
  // than a disqualification. Some galleries are model shots all the way down.
  const skinScore = clamp01(1 - skinFraction / 0.11);
  // Too little subject is a swatch or a detail crop; too much is a scene.
  const framing = clamp01(1 - Math.abs(coverage - 0.42) / 0.42);
  const resolution = clamp01(Math.min(natural.w, natural.h) / 900);

  const score = clamp01(
    0.38 * backdrop + 0.28 * skinScore + 0.18 * framing + 0.16 * resolution,
  );

  return {
    url,
    score,
    dominantColor: dominant,
    metrics: {
      backdrop: +backdrop.toFixed(3),
      skinFraction: +skinFraction.toFixed(3),
      coverage: +coverage.toFixed(3),
      natural,
    },
  };
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
      return { ...(await api("/api/extension/session")), apiBase };
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

  TRYON: ({ imageUrl, category }) =>
    api("/api/extension/tryon", {
      method: "POST",
      body: JSON.stringify({ imageUrl, category }),
    }),

  SAVE: (msg) =>
    api("/api/extension/save", {
      method: "POST",
      body: JSON.stringify({
        name: msg.name,
        zone: msg.zone,
        dominantColor: msg.dominantColor,
        material: msg.material,
        renderUrl: msg.renderUrl,
        sourceUrl: msg.sourceUrl,
      }),
    }),

  async PAIR({ token, apiBase }) {
    if (!token) throw new Error("No token on the page.");
    await chrome.storage.local.set({ token, apiBase: apiBase || DEFAULT_API });
    return { paired: true };
  },

  async UNPAIR() {
    await chrome.storage.local.remove(["token"]);
    return { paired: false };
  },

  async OPEN({ url }) {
    await chrome.tabs.create({ url });
    return { opened: true };
  },

  async DISMISS({ host }) {
    const { dismissed = [] } = await chrome.storage.local.get("dismissed");
    if (!dismissed.includes(host)) {
      await chrome.storage.local.set({ dismissed: [...dismissed, host] });
    }
    return { dismissed: true };
  },

  async GET_DISMISSED({ host }) {
    const { dismissed = [] } = await chrome.storage.local.get("dismissed");
    return { dismissed: dismissed.includes(host) };
  },

  async CLEAR_DISMISSED() {
    await chrome.storage.local.set({ dismissed: [] });
    return { cleared: true };
  },
};

chrome.runtime.onMessage.addListener((msg, _sender, respond) => {
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

chrome.runtime.onInstalled.addListener(async ({ reason }) => {
  const { apiBase } = await chrome.storage.local.get("apiBase");
  if (!apiBase) await chrome.storage.local.set({ apiBase: DEFAULT_API });
  if (reason === "install") {
    await chrome.tabs.create({ url: `${apiBase || DEFAULT_API}/connect` });
  }
});
