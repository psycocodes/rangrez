import { context2d, makeCanvas, toJpegBlob } from "./canvas";
import { cutout } from "./cutout";
import { classify, kindIdFor } from "./garment-kind";

/**
 * ═══════════════════════════════════════════════════════════════════════════
 *  Pulling the garment out of a photograph — in the browser
 * ═══════════════════════════════════════════════════════════════════════════
 *
 *  BROWSER ONLY. No `server-only` import because there is deliberately no
 *  server counterpart: this runs on the user's own machine, before anything is
 *  uploaded, and that is the single biggest reason the upload flow feels fast.
 *
 *  What it buys:
 *    · the server never receives a 12MB phone photo, only a ~200KB square
 *    · no server-side image decoding, so no sharp/canvas dependency at all
 *    · a preview exists the instant a file is chosen, not a round trip later
 *
 *  What it actually does — the same treatment the extension gives a shop's
 *  gallery image, because Apparel VTO takes no text prompt and the reference
 *  image *is* the prompt.
 *
 *  Two passes, best first:
 *
 *    1. a real cutout (lib/matte.ts): flood the backdrop in from the frame's
 *       edge, matte the garment out of it, drop it on a clean white square
 *    2. failing that — a busy room, a garment filling the frame — the older
 *       crop: find the subject box, trim to it, centre it on white
 *
 *  Neither ever repaints the interior of the garment. A white shirt on a white
 *  sheet is the same colour as its background, and anything that guesses there
 *  destroys the piece; the fill gets around that with connectivity rather than
 *  with a better guess, and the fallback simply doesn't try.
 *
 *  ── why the result lands on white, and not on transparency ───────────────
 *
 *  The matte can give us an alpha channel and a garment floating on nothing
 *  looks better in the grid. But this same image is what gets handed to
 *  Apparel VTO as the reference, and what the engine composites transparency
 *  against is undefined — a garment whose background is "whatever YouCam
 *  decides" is a garment we cannot predict the render of. Flattening onto
 *  white here keeps one image doing both jobs, which is also what keeps a
 *  wardrobe entry at two pictures rather than three.
 * ═══════════════════════════════════════════════════════════════════════════
 */

export interface Extracted {
  /** The garment, matted or cropped, centred on white. What we store. */
  blob: Blob;
  /** Object URL for the blob. The caller owns revoking it. */
  previewUrl: string;
  /** Average colour of the subject pixels — becomes the piece's dye. */
  dominantColor: string;
  /** Was there a background to trim, or is this already a flat product shot. */
  cropped: boolean;
  /**
   * True when the background was genuinely matted away rather than merely
   * cropped around. Shown in the dock so the user knows which they got.
   */
  matted: boolean;
  /** Guessed from the filename. */
  suggestedName: string;
  suggestedKindId: string;
}

/** Longest edge of the square we produce. Comfortably above VTO's needs. */
const OUT_MAX = 1280;
const OUT_MIN = 768;

/** How different from the corner colour a pixel must be to count as subject. */
const SUBJECT_THRESHOLD = 70;

export async function extractGarment(file: File): Promise<Extracted> {
  if (!file.type.startsWith("image/")) {
    throw new Error(`${file.name} isn't an image.`);
  }

  const bitmap = await createImageBitmap(file);

  try {
    // ── 0 · try to cut it out properly first ──────────────────────────────
    // The bitmap is passed rather than the file so the decode is not paid for
    // twice; `cutout` leaves a bitmap it did not create open.
    const matte = await cutout(bitmap, {
      square: true,
      background: "#ffffff",
      maxSize: OUT_MAX,
      pad: 0.07,
    });

    if (matte.confident) {
      return {
        blob: matte.blob,
        previewUrl: matte.previewUrl,
        dominantColor: matte.dominantColor,
        cropped: true,
        matted: true,
        suggestedName: titleFromFilename(file.name),
        suggestedKindId: kindIdFor(classify(stripExtension(file.name))),
      };
    }

    // Nothing here to keep — the crop below produces its own.
    URL.revokeObjectURL(matte.previewUrl);

    // ── 1 · find the subject, on a small copy ─────────────────────────────
    // 128px is enough to locate a garment and cheap enough that a dozen files
    // analyse in the time it takes to notice they were dropped.
    const SW = 128;
    const SH = Math.max(1, Math.round((SW * bitmap.height) / bitmap.width));
    const probe = makeCanvas(SW, SH);
    const pctx = context2d(probe, { willReadFrequently: true });
    pctx.drawImage(bitmap, 0, 0, SW, SH);
    const { data } = pctx.getImageData(0, 0, SW, SH);

    // The four corners, averaged. On a product shot that is the backdrop; on a
    // scene it is whatever is furthest from the subject, which still works.
    const corner = [0, 1, 2].map((c) => {
      const at = (x: number, y: number) => data[(y * SW + x) * 4 + c];
      return (at(0, 0) + at(SW - 1, 0) + at(0, SH - 1) + at(SW - 1, SH - 1)) / 4;
    });

    let minX = SW, minY = SH, maxX = 0, maxY = 0, hits = 0;
    const sum = [0, 0, 0];

    for (let y = 0; y < SH; y++) {
      for (let x = 0; x < SW; x++) {
        const i = (y * SW + x) * 4;
        const dist =
          Math.abs(data[i] - corner[0]) +
          Math.abs(data[i + 1] - corner[1]) +
          Math.abs(data[i + 2] - corner[2]);
        if (dist > SUBJECT_THRESHOLD) {
          hits++;
          sum[0] += data[i];
          sum[1] += data[i + 1];
          sum[2] += data[i + 2];
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }

    const dominantColor =
      hits > 0
        ? "#" +
          sum
            .map((c) => Math.round(c / hits).toString(16).padStart(2, "0"))
            .join("")
        : "#6d6555";

    // ── 2 · decide whether to crop ────────────────────────────────────────
    const found = hits > SW * SH * 0.02 && maxX > minX && maxY > minY;
    // A box covering nearly the whole frame means there was no backdrop to
    // trim — a scene, not a product shot. Cropping it would zoom into noise.
    const cropped = found && (maxX - minX) * (maxY - minY) < SW * SH * 0.92;

    const scale = bitmap.width / SW;
    const pad = 0.06;
    let sx = 0, sy = 0, sw = bitmap.width, sh = bitmap.height;

    if (cropped) {
      const bw = (maxX - minX + 1) * scale;
      const bh = (maxY - minY + 1) * scale;
      sx = Math.max(0, minX * scale - bw * pad);
      sy = Math.max(0, minY * scale - bh * pad);
      sw = Math.min(bitmap.width - sx, bw * (1 + pad * 2));
      sh = Math.min(bitmap.height - sy, bh * (1 + pad * 2));
    }

    // ── 3 · centre it on a white square ───────────────────────────────────
    // A consistent frame is one less thing for the engine to reason about, and
    // it makes the wardrobe grid read as one catalogue rather than a camera roll.
    const out = Math.min(OUT_MAX, Math.max(OUT_MIN, Math.round(Math.max(sw, sh))));
    const canvas = makeCanvas(out, out);
    const ctx = context2d(canvas);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, out, out);

    const fit = Math.min((out * 0.92) / sw, (out * 0.92) / sh);
    const dw = sw * fit;
    const dh = sh * fit;
    ctx.drawImage(bitmap, sx, sy, sw, sh, (out - dw) / 2, (out - dh) / 2, dw, dh);

    const blob = await toJpegBlob(canvas);
    const kind = classify(stripExtension(file.name));

    return {
      blob,
      previewUrl: URL.createObjectURL(blob),
      dominantColor,
      cropped,
      matted: false,
      suggestedName: titleFromFilename(file.name),
      suggestedKindId: kindIdFor(kind),
    };
  } finally {
    bitmap.close();
  }
}

/* ── naming ──────────────────────────────────────────────────────────────── */

const stripExtension = (name: string) => name.replace(/\.[a-z0-9]+$/i, "");

/**
 * "black_denim-jacket_2.JPG" → "Black denim jacket".
 *
 * Camera filenames (IMG_4821, DSC00123, PXL_20260814…) carry nothing, so they
 * become an empty string and the dock falls back to a generic name rather than
 * filling the wardrobe with pieces called "IMG 4821".
 */
function titleFromFilename(filename: string): string {
  const base = stripExtension(filename);
  if (/^(img|dsc|dscf|pxl|photo|image|screenshot|whatsapp)[\s_-]*\d/i.test(base)) {
    return "";
  }
  const words = base
    .replace(/[_\-.]+/g, " ")
    .replace(/\s+/g, " ")
    .replace(/\s*\(\d+\)$/, "")
    .replace(/\s+\d{1,2}$/, "")
    .trim();
  if (!words || /^\d+$/.test(words)) return "";
  return words.charAt(0).toUpperCase() + words.slice(1).toLowerCase();
}
