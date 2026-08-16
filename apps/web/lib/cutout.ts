import { context2d, makeCanvas, toPngBlob } from "./canvas";
import { floodBackground, meanColor, softenMask, subjectBox } from "./matte";

/**
 * ═══════════════════════════════════════════════════════════════════════════
 *  Taking the background out
 * ═══════════════════════════════════════════════════════════════════════════
 *
 *  BROWSER ONLY. Runs on the user's machine before anything is uploaded, for
 *  the same reason the crop in lib/extract.ts does: the server never has to
 *  decode a 12MB photograph, and the result is on screen immediately.
 *
 *  Used for two things that look unrelated and are the same problem:
 *
 *    · the garment, so a card shows the piece and not the bedsheet behind it
 *    · the avatar, so the figure stands *in* the look creator's gradient
 *      rather than on a rectangle of someone's hallway
 *
 *  This file is the canvas half — sizing, cropping, compositing, encoding.
 *  Everything that *decides* what is background lives in lib/matte.ts, which
 *  has no imports at all and is therefore the half that can be tested.
 * ═══════════════════════════════════════════════════════════════════════════
 */

export interface CutoutOptions {
  /**
   * Longest edge of the output. The mask itself is always computed small; this
   * is the resolution the matte gets applied at.
   */
  maxSize?: number;
  /** Air around the subject, as a fraction of its longest side. */
  pad?: number;
  /** Force a square frame. Garments want one; a standing figure does not. */
  square?: boolean;
  /**
   * Paint the transparent area this colour instead of leaving it clear. Used
   * for the VTO reference, which wants a clean field rather than an alpha
   * channel the engine will composite against something unknown.
   */
  background?: string;
}

export interface CutoutResult {
  /** PNG, with an alpha channel unless `background` was given. */
  blob: Blob;
  /** Object URL for the blob. The caller owns revoking it. */
  previewUrl: string;
  /** Fraction of the original frame the subject occupied, 0–1. */
  coverage: number;
  /** Average colour of the subject pixels — becomes the piece's dye. */
  dominantColor: string;
  /**
   * Whether the matte is worth using.
   *
   * False means we produced *something* but shouldn't be trusted with it: a
   * busy backdrop where the fill ran everywhere, or a subject filling the
   * frame edge to edge with no background to find. Callers fall back to the
   * plain crop rather than shipping a hole where a sleeve was.
   */
  confident: boolean;
  /** Why not, when `confident` is false. For logging, not for users. */
  reason?: string;
}

/** The mask is computed at this longest edge regardless of the source size. */
const MASK_EDGE = 320;

/** Below this fraction of background found, there was nothing to remove. */
const MIN_REMOVED = 0.06;
/** Above this, the fill escaped into the subject and ate the picture. */
const MAX_REMOVED = 0.93;

export async function cutout(
  source: Blob | ImageBitmap,
  options: CutoutOptions = {},
): Promise<CutoutResult> {
  const {
    maxSize = 1280,
    pad = 0.06,
    square = true,
    background,
  } = options;

  const bitmap =
    source instanceof ImageBitmap ? source : await createImageBitmap(source);
  const owned = !(source instanceof ImageBitmap);

  try {
    /* ── 1 · the mask, at postage-stamp size ──────────────────────────────
       A 320px mask is enough to trace a garment's outline, and it means the
       flood fill visits ~100k pixels instead of ~12 million. The softness
       that comes from scaling it back up is not a compromise — it is the
       feathering we would otherwise have to add by hand. */
    const scale = MASK_EDGE / Math.max(bitmap.width, bitmap.height);
    const mw = Math.max(2, Math.round(bitmap.width * scale));
    const mh = Math.max(2, Math.round(bitmap.height * scale));

    const probe = makeCanvas(mw, mh);
    const pctx = context2d(probe, { willReadFrequently: true });
    pctx.drawImage(bitmap, 0, 0, mw, mh);
    const { data } = pctx.getImageData(0, 0, mw, mh);

    const mask = floodBackground(data, mw, mh);

    /* ── 2 · did it work? ─────────────────────────────────────────────── */
    let removed = 0;
    for (let i = 0; i < mask.length; i++) if (mask[i]) removed++;
    const removedFraction = removed / mask.length;

    let confident = true;
    let reason: string | undefined;
    if (removedFraction < MIN_REMOVED) {
      confident = false;
      reason = "nothing that looked like a background to remove";
    } else if (removedFraction > MAX_REMOVED) {
      confident = false;
      reason = "the fill escaped into the subject";
    }

    /* ── 3 · the subject box, and its colour ──────────────────────────── */
    const { minX, minY, maxX, maxY, hits } = subjectBox(mask, mw, mh);
    if (!hits) {
      // Everything was background. Nothing to cut out; hand back the frame.
      confident = false;
      reason = "no subject found";
    }

    const dominantColor = meanColor(data, mask, mw, mh, minY, maxY);

    /* ── 4 · soften the edge ──────────────────────────────────────────── */
    // A hard 0/255 matte scaled up gives a stair-stepped outline. One box blur
    // pass over the alpha, then a contrast curve to keep the middle of the
    // garment fully opaque, and the edge reads as cut rather than cropped.
    const alpha = softenMask(mask, mw, mh);

    /* ── 5 · compose ──────────────────────────────────────────────────── */
    const sx = minX / mw * bitmap.width;
    const sy = minY / mh * bitmap.height;
    const sw = (maxX - minX + 1) / mw * bitmap.width;
    const sh = (maxY - minY + 1) / mh * bitmap.height;

    const padX = sw * pad;
    const padY = sh * pad;
    const cropX = Math.max(0, sx - padX);
    const cropY = Math.max(0, sy - padY);
    const cropW = Math.min(bitmap.width - cropX, sw + padX * 2);
    const cropH = Math.min(bitmap.height - cropY, sh + padY * 2);

    const longest = Math.max(cropW, cropH);
    const fit = Math.min(1, maxSize / longest);
    const outW = Math.max(1, Math.round((square ? longest : cropW) * fit));
    const outH = Math.max(1, Math.round((square ? longest : cropH) * fit));

    const canvas = makeCanvas(outW, outH);
    const ctx = context2d(canvas);

    // The matte, blown up to output size. `drawImage` interpolates it, which
    // is exactly the soft edge we want and costs nothing.
    const matte = makeCanvas(mw, mh);
    const mctx = context2d(matte);
    const matteData = mctx.createImageData(mw, mh);
    for (let i = 0; i < alpha.length; i++) {
      matteData.data[i * 4 + 3] = alpha[i];
    }
    mctx.putImageData(matteData, 0, 0);

    const dw = Math.round(cropW * fit);
    const dh = Math.round(cropH * fit);
    const dx = Math.round((outW - dw) / 2);
    const dy = Math.round((outH - dh) / 2);

    // Draw the matte first, then the photograph through it. `source-in` keeps
    // only where both are opaque, which is the cutout.
    ctx.drawImage(
      matte as CanvasImageSource,
      (cropX / bitmap.width) * mw,
      (cropY / bitmap.height) * mh,
      (cropW / bitmap.width) * mw,
      (cropH / bitmap.height) * mh,
      dx, dy, dw, dh,
    );
    ctx.globalCompositeOperation = "source-in";
    ctx.drawImage(bitmap, cropX, cropY, cropW, cropH, dx, dy, dw, dh);

    // A flat field behind it, when the caller wanted one rather than alpha.
    if (background) {
      ctx.globalCompositeOperation = "destination-over";
      ctx.fillStyle = background;
      ctx.fillRect(0, 0, outW, outH);
    }
    ctx.globalCompositeOperation = "source-over";

    const blob = await toPngBlob(canvas);

    return {
      blob,
      previewUrl: URL.createObjectURL(blob),
      coverage: hits / mask.length,
      dominantColor,
      confident,
      reason,
    };
  } finally {
    if (owned) bitmap.close();
  }
}
