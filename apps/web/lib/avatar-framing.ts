import { context2d, makeCanvas } from "./canvas";
import type { AvatarFraming } from "./types";

/**
 * ═══════════════════════════════════════════════════════════════════════════
 *  Guessing how much of a body a photograph shows
 * ═══════════════════════════════════════════════════════════════════════════
 *
 *  BROWSER ONLY, and a *suggestion* rather than an answer. The user confirms
 *  it in the studio, because this decides which slots the look creator will
 *  let them fill and a wrong guess that silently disables a control is worse
 *  than no guess at all.
 *
 *  The measure is the oldest rule in portrait photography: how big is the head
 *  relative to the frame. A head-and-shoulders shot gives the face roughly a
 *  quarter of the frame height; a full-length shot gives it a fifteenth. That
 *  ratio holds across lenses, distances and aspect ratios in a way that
 *  "how tall is the subject" does not, because a subject cropped at the waist
 *  and a subject standing far away both fill the frame top to bottom.
 *
 *  Finding the head: skin pixels, take the topmost cluster. Hands and forearms
 *  are skin too, but they are almost never above the face.
 * ═══════════════════════════════════════════════════════════════════════════
 */

/** Kovac's RGB rule — the same one the extension scores gallery shots with. */
function isSkin(r: number, g: number, b: number): boolean {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  return (
    r > 95 && g > 40 && b > 20 &&
    max - min > 15 &&
    Math.abs(r - g) > 15 &&
    r > g && r > b
  );
}

export interface FramingGuess {
  framing: AvatarFraming;
  /** 0–1. Low means the caller should lean on the user, not on us. */
  confidence: number;
  /** Face height as a fraction of frame height, for the explanation line. */
  headFraction: number;
}

export async function guessFraming(file: File): Promise<FramingGuess> {
  const bitmap = await createImageBitmap(file);

  try {
    const W = 128;
    const H = Math.max(1, Math.round((W * bitmap.height) / bitmap.width));
    const ctx = context2d(makeCanvas(W, H), { willReadFrequently: true });
    ctx.drawImage(bitmap, 0, 0, W, H);
    const { data } = ctx.getImageData(0, 0, W, H);

    // Rows carrying a meaningful run of skin. A row with two or three stray
    // warm pixels is a wooden floor, not a face.
    const MIN_RUN = Math.max(2, Math.round(W * 0.03));
    const skinRows: number[] = [];
    for (let y = 0; y < H; y++) {
      let count = 0;
      for (let x = 0; x < W; x++) {
        const i = (y * W + x) * 4;
        if (isSkin(data[i], data[i + 1], data[i + 2])) count++;
      }
      if (count >= MIN_RUN) skinRows.push(y);
    }

    if (!skinRows.length) {
      // No face found: could be a back view, heavy shadow, or a photograph of
      // clothes on a hanger. Default to the least restrictive answer and say
      // we are unsure — the user picks.
      return { framing: "full", confidence: 0, headFraction: 0 };
    }

    // The topmost contiguous cluster is the head. Break the run wherever there
    // is a vertical gap — that gap is the neck, or the space above the hands.
    const top = skinRows[0];
    let head = top;
    const GAP = Math.max(2, Math.round(H * 0.02));
    for (let i = 1; i < skinRows.length; i++) {
      if (skinRows[i] - skinRows[i - 1] > GAP) break;
      head = skinRows[i];
    }

    const headFraction = (head - top + 1) / H;

    // Thresholds from the rule above, widened a little at the joins because a
    // fringe or a beard moves the measured face by a few percent.
    let framing: AvatarFraming;
    if (headFraction > 0.17) framing = "bust";
    else if (headFraction > 0.085) framing = "knee";
    else framing = "full";

    // Confidence falls off near a boundary, where a small measurement error
    // would have produced a different answer.
    const distance = Math.min(
      Math.abs(headFraction - 0.17),
      Math.abs(headFraction - 0.085),
    );
    const confidence = Math.max(0, Math.min(1, distance / 0.05));

    return { framing, confidence, headFraction };
  } finally {
    bitmap.close();
  }
}
