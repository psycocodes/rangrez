/**
 * ═══════════════════════════════════════════════════════════════════════════
 *  Candidate scoring — pure, so it can be tested without a browser
 * ═══════════════════════════════════════════════════════════════════════════
 *
 *  Given the pixels of a 96px thumbnail, decide how well this photograph shows
 *  the garment on its own. The service worker does the fetching and drawing;
 *  everything that decides a winner lives here.
 * ═══════════════════════════════════════════════════════════════════════════
 */

export const clamp01 = (n) => Math.max(0, Math.min(1, n));

/** Kovac's RGB rule. Cheap, and we only need "is there a person here". */
export function isSkin(r, g, b) {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  return (
    r > 95 && g > 40 && b > 20 &&
    max - min > 15 &&
    Math.abs(r - g) > 15 &&
    r > g && r > b
  );
}


/**
 * @param {Uint8ClampedArray} data RGBA pixels of the thumbnail
 * @param {number} W thumbnail width
 * @param {number} H thumbnail height
 * @param {{w:number,h:number}} natural the source image's real dimensions
 */
export function scorePixels(data, W, H, natural) {
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

  // ── 2a · is there a garment-shaped thing here at all? ───────────────
  // A macro of the fabric is the trap: the whole frame is one colour, so the
  // border deviates by nothing (perfect "backdrop") and there's no skin
  // (perfect "not a model shot"). It used to win outright.
  //
  // What separates a garment from a swatch is structure at human scale — a
  // collar, a sleeve, a silhouette. Block-average down to 32px and micro
  // texture disappears while real edges survive, so mean gradient at that
  // scale is close to zero for fabric and substantial for a garment.
  const B = 32;
  const bw = Math.max(1, Math.floor(W / B));
  const bh = Math.max(1, Math.floor(H / B));
  const cols = Math.max(2, Math.floor(W / bw));
  const rows = Math.max(2, Math.floor(H / bh));
  const small = new Float32Array(cols * rows);

  for (let by = 0; by < rows; by++) {
    for (let bx = 0; bx < cols; bx++) {
      let sum2 = 0;
      let n = 0;
      for (let y = by * bh; y < Math.min((by + 1) * bh, H); y++) {
        for (let x = bx * bw; x < Math.min((bx + 1) * bw, W); x++) {
          const i = (y * W + x) * 4;
          sum2 += 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
          n++;
        }
      }
      small[by * cols + bx] = n ? sum2 / n : 0;
    }
  }

  let gradient = 0;
  let gradN = 0;
  for (let y = 0; y < rows - 1; y++) {
    for (let x = 0; x < cols - 1; x++) {
      const v = small[y * cols + x];
      gradient +=
        Math.abs(v - small[y * cols + x + 1]) +
        Math.abs(v - small[(y + 1) * cols + x]);
      gradN += 2;
    }
  }
  // ~0 for flat fabric, 12–40 for a garment with a silhouette.
  const structure = clamp01(gradN ? gradient / gradN / 14 : 0);

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
  // A model shot is perfectly usable — the engine handles it — so absence of
  // skin is a mild preference for a flat lay, not the near-veto it used to be.
  // Weighted too hard, it hands the win to any photograph with no person in
  // it, which is exactly how a fabric macro got picked.
  const skinScore = clamp01(1 - skinFraction / 0.28) * 0.6 + 0.4;
  // Too little subject is a swatch or a detail crop; too much is a scene.
  const framing = clamp01(1 - Math.abs(coverage - 0.45) / 0.45);
  const resolution = clamp01(Math.min(natural.w, natural.h) / 900);

  // Product photography is portrait or square. A 3:1 image is a banner.
  const ratio = natural.w / natural.h;
  const shape = ratio > 1.9 || ratio < 0.45 ? 0.15 : 1;

  // No silhouette and nothing standing out from the background: a texture
  // crop, a colour swatch, or a blank tile. There is no garment to transfer,
  // so it must never win — but it stays scoreable in case a gallery is
  // nothing but close-ups and we still have to choose.
  const swatch = structure < 0.18 || coverage < 0.08;

  let score = clamp01(
    0.24 * backdrop +
      0.26 * structure +
      0.22 * framing +
      0.14 * skinScore +
      0.10 * resolution +
      0.04 * shape,
  );
  if (swatch) score *= 0.12;
  // Heavy, not fatal — if every image in the gallery is a collage we still
  // need to pick one.
  if (collage) score *= 0.45;

  return {
    score,
    dominantColor: dominant,
    metrics: {
      backdrop: +backdrop.toFixed(3),
      structure: +structure.toFixed(3),
      skinFraction: +skinFraction.toFixed(3),
      coverage: +coverage.toFixed(3),
      swatch,
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
