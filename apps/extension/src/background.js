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

  // ── 2b · is this a collage? ─────────────────────────────────────────
  // Shops love a "3 views in one image" tile. VTO transfers whatever it is
  // shown, so a collage produces a garment with three collars. Detect it by
  // looking for a full-height column of pure backdrop separating subject on
  // both sides — a seam no single-garment shot has.
  const columnIsBackdrop = [];
  for (let x = 0; x < W; x++) {
    let off = 0;
    for (let y = 0; y < H; y++) {
      const i = (y * W + x) * 4;
      const dist =
        Math.abs(data[i] - bg[0]) +
        Math.abs(data[i + 1] - bg[1]) +
        Math.abs(data[i + 2] - bg[2]);
      if (dist > 62) off++;
    }
    columnIsBackdrop.push(off / H < 0.02);
  }
  // Ignore the outer fifth — every product shot has clean margins.
  const inner = columnIsBackdrop.slice(Math.round(W * 0.2), Math.round(W * 0.8));
  let seam = false;
  let run = 0;
  for (const clean of inner) {
    run = clean ? run + 1 : 0;
    if (run >= Math.max(3, Math.round(W * 0.04))) seam = true;
  }
  const collage = seam && coverage > 0.12;

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

  // Product photography is portrait or square. A 3:1 image is a banner.
  const ratio = natural.w / natural.h;
  const shape = ratio > 1.9 || ratio < 0.45 ? 0.15 : 1;

  let score = clamp01(
    0.36 * backdrop + 0.26 * skinScore + 0.18 * framing + 0.12 * resolution + 0.08 * shape,
  );
  // Heavy, not fatal — if every image in the gallery is a collage we still
  // need to pick one.
  if (collage) score *= 0.45;

  return {
    url,
    score,
    dominantColor: dominant,
    metrics: {
      backdrop: +backdrop.toFixed(3),
      skinFraction: +skinFraction.toFixed(3),
      coverage: +coverage.toFixed(3),
      collage,
      ratio: +ratio.toFixed(2),
      natural,
    },
  };
}

/* ═══ PREPARING THE REFERENCE ══════════════════════════════════════════════
 *
 *  Apparel VTO takes no text prompt — the reference image *is* the prompt. So
 *  "prompting better" means handing it a cleaner picture: the garment, framed
 *  tightly, on a plain field, at a sane size.
 *
 *  A busy editorial shot (model in a forest, props, hard shadows) gives the
 *  engine too much to interpret and it invents detail. Cropping to the subject
 *  and padding onto white removes most of that ambiguity without touching the
 *  garment's own pixels — we never repaint the interior, because a white shirt
 *  and a white backdrop are the same colour and guessing there ruins the item.
 * ═══════════════════════════════════════════════════════════════════════════ */

async function prepareReference(url) {
  const res = await fetch(url, { credentials: "omit" });
  if (!res.ok) throw new Error(`reference fetch ${res.status}`);
  const bitmap = await createImageBitmap(await res.blob());

  // Work out the subject box on a small copy; apply it to the full-size one.
  const SW = 128;
  const SH = Math.max(1, Math.round((SW * bitmap.height) / bitmap.width));
  const probe = new OffscreenCanvas(SW, SH);
  const pctx = probe.getContext("2d", { willReadFrequently: true });
  pctx.drawImage(bitmap, 0, 0, SW, SH);
  const { data } = pctx.getImageData(0, 0, SW, SH);

  const corner = [0, 1, 2].map((c) => {
    const pick = (x, y) => data[(y * SW + x) * 4 + c];
    return (pick(0, 0) + pick(SW - 1, 0) + pick(0, SH - 1) + pick(SW - 1, SH - 1)) / 4;
  });

  let minX = SW, minY = SH, maxX = 0, maxY = 0, hits = 0;
  for (let y = 0; y < SH; y++) {
    for (let x = 0; x < SW; x++) {
      const i = (y * SW + x) * 4;
      const dist =
        Math.abs(data[i] - corner[0]) +
        Math.abs(data[i + 1] - corner[1]) +
        Math.abs(data[i + 2] - corner[2]);
      if (dist > 70) {
        hits++;
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }

  const scale = bitmap.width / SW;
  const found = hits > SW * SH * 0.02 && maxX > minX && maxY > minY;
  // A box covering nearly the whole frame means there was no backdrop to trim
  // — a scene, not a product shot. Cropping it would just zoom into noise.
  const trims = found && (maxX - minX) * (maxY - minY) < SW * SH * 0.92;

  const pad = 0.06;
  let sx = 0, sy = 0, sw = bitmap.width, sh = bitmap.height;
  if (trims) {
    const bw = (maxX - minX + 1) * scale;
    const bh = (maxY - minY + 1) * scale;
    sx = Math.max(0, minX * scale - bw * pad);
    sy = Math.max(0, minY * scale - bh * pad);
    sw = Math.min(bitmap.width - sx, bw * (1 + pad * 2));
    sh = Math.min(bitmap.height - sy, bh * (1 + pad * 2));
  }

  // Square it off on white: a consistent frame is one less thing for the
  // engine to reason about, and every shop's aspect ratio is different.
  const OUT = Math.min(1400, Math.max(768, Math.round(Math.max(sw, sh))));
  const canvas = new OffscreenCanvas(OUT, OUT);
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, OUT, OUT);

  const fit = Math.min((OUT * 0.92) / sw, (OUT * 0.92) / sh);
  const dw = sw * fit;
  const dh = sh * fit;
  ctx.drawImage(bitmap, sx, sy, sw, sh, (OUT - dw) / 2, (OUT - dh) / 2, dw, dh);
  bitmap.close();

  const blob = await canvas.convertToBlob({ type: "image/jpeg", quality: 0.92 });
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }

  return { base64: btoa(binary), cropped: trims };
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

  /**
   * Sends the *prepared* reference rather than a URL. Two wins: the server
   * doesn't re-fetch an image we already hold (one less round trip on a slow
   * shop CDN), and YouCam gets the cropped, flattened version instead of the
   * raw editorial shot. Falls back to the URL if preparation fails, so a
   * canvas hiccup can't take the feature down.
   */
  async TRYON({ imageUrl, category }) {
    let prepared = null;
    try {
      prepared = await prepareReference(imageUrl);
    } catch (err) {
      console.warn("[rangrez] couldn't prepare the reference, sending the URL", err);
    }

    return api("/api/extension/tryon", {
      method: "POST",
      body: JSON.stringify(
        prepared
          ? { imageData: prepared.base64, contentType: "image/jpeg", category }
          : { imageUrl, category },
      ),
    });
  },

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
