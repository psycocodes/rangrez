import sharp from "sharp";

import {
  floodBackground,
  garmentWindow,
  meanColor,
  removeBareLimbs,
  skinProfile,
  softenMask,
  subjectBox,
  type GarmentBand,
} from "./matte.ts";
import type { VtoTarget } from "./youcam";

/**
 * ═══════════════════════════════════════════════════════════════════════════
 *  Taking the garment out of a shop's photograph
 * ═══════════════════════════════════════════════════════════════════════════
 *
 *  SERVER ONLY — reached through lib/cutout-server.ts, which is the same thing
 *  with the `server-only` guard on it. The guard is next door rather than here
 *  because scripts/seed-photos.mjs runs this pipeline under plain node, and
 *  `server-only` throws there by design.
 *
 *  The mirror of lib/cutout.ts, which does the same thing in the browser for
 *  an upload. Both call the same judgement code in lib/matte.ts — only the
 *  drawing differs, canvas there and sharp here.
 *
 *  It exists because of where the extension's picture comes from. An upload is
 *  chosen by the person uploading it and processed on their machine before it
 *  is sent; a shop's picture is chosen by the shop, arrives at the try-on
 *  route as bytes, and used to be stored exactly as found. Stored as found, a
 *  saved piece is a model in a field — or, when nothing was stored at all, the
 *  render, which is to say a photograph of you.
 *
 *  Neither is the garment. This is:
 *
 *    1. flood the backdrop away        (lib/matte.ts — connectivity, not colour)
 *    2. find the subject, and its head (skin per row)
 *    3. keep the band the piece is worn on
 *    4. write it out as a PNG with a real alpha channel
 *
 *  Step 4 is why the card can tint itself: a transparent garment sits *in* the
 *  card's dye instead of on a white rectangle in the middle of it.
 * ═══════════════════════════════════════════════════════════════════════════
 */

/**
 * What we asked YouCam for tells us where on a body the piece is worn, which
 * is the only thing the crop needs to know. It is already classified, already
 * validated, and already travelling with the request.
 */
const BAND: Record<VtoTarget, GarmentBand> = {
  upper_body: "upper",
  lower_body: "lower",
  full_body: "full",
  shoes: "feet",
  hat: "head",
  necklace: "head",
  earring: "head",
  // Held rather than worn, and photographed at every scale imaginable. Only
  // the head is dropped; guessing a band for a handbag would be inventing one.
  bag: "full",
  ring: "full",
  bracelet: "full",
  watch: "full",
};

export interface GarmentCutout {
  /** PNG, with an alpha channel. */
  bytes: Buffer;
  contentType: "image/png";
  /** Average colour of the kept band — the piece's dye. */
  dominantColor: string;
  /** Whether the frame was tightened, i.e. whether a head was found. */
  reframed: boolean;
}

/** The mask is computed at this longest edge regardless of the source size. */
const MASK_EDGE = 320;
/** Longest edge of what we store. A wardrobe card is never larger than this. */
const MAX_EDGE = 1000;
/** Air around the subject, as a fraction of its longest side. */
const PAD = 0.05;

/** Below this fraction of background found, there was nothing to remove. */
const MIN_REMOVED = 0.06;
/** Above this, the fill escaped into the subject and ate the picture. */
const MAX_REMOVED = 0.93;

/**
 * Bytes in, garment out — or null when this photograph isn't one we can cut.
 *
 * Null is a real answer and not an error: a scene with no backdrop, a subject
 * running edge to edge, an image sharp can't decode. The caller stores what it
 * already had, which is worse but is at least the thing the shop published.
 */
export async function extractGarment(
  bytes: Buffer,
  target: VtoTarget,
): Promise<GarmentCutout | null> {
  try {
    return await cut(bytes, BAND[target] ?? "full");
  } catch (err) {
    console.warn("[cutout-server] couldn't cut that one out:", err);
    return null;
  }
}

/**
 * Anything with an alpha channel, flattened onto white.
 *
 * Every image the product stores of a garment is now a cutout, and a cutout is
 * transparent. VTO has no idea what to do with that: an engine handed a PNG
 * with alpha either composites it against black — giving a shirt a black halo
 * it will faithfully transfer onto your body — or refuses the upload. White is
 * what a product shot's backdrop is, so white is what it gets.
 *
 * Cheap and safe to call on anything: a JPEG has no alpha and comes straight
 * back, and a failure returns the original rather than costing a render.
 */
export async function flattenForVto(image: {
  bytes: Buffer;
  contentType: string;
}): Promise<{ bytes: Buffer; contentType: string }> {
  try {
    const meta = await sharp(image.bytes, { failOn: "none" }).metadata();
    if (!meta.hasAlpha) return image;

    const bytes = await sharp(image.bytes, { failOn: "none" })
      .flatten({ background: "#ffffff" })
      .jpeg({ quality: 92 })
      .toBuffer();
    return { bytes, contentType: "image/jpeg" };
  } catch (err) {
    console.warn("[garment-cut] couldn't flatten that one:", err);
    return image;
  }
}

export type OutfitSlot = "torso" | "layer" | "bottom" | "shoes" | "accessory";

export interface OutfitPiece {
  slot: OutfitSlot;
  bytes: Buffer;
}

/**
 * A whole outfit as one photograph — the flat-lay a catalogue shoots when it
 * wants to sell the look rather than the shirt.
 *
 * ── why the app builds one of these instead of rendering four times ───────
 *
 * The cloth model takes one reference garment and one category, so an outfit
 * used to be a chain: the avatar got the tee, the result got the jeans, that
 * result got the shoes, and so on. Two things are wrong with that, and both
 * were reported from the product:
 *
 *   · every call regenerates the *entire* photograph, face included. Four
 *     calls are four chances for the person to drift into somebody else, and
 *     they did.
 *   · `upper_body` means *replace what is on the upper body*. Ask for a tee
 *     and then a jacket over it and the tee is gone — the engine paints in
 *     whatever it thinks belongs under a jacket, reliably a white shirt.
 *     There is no `outerwear` category on v2.0 to say "over, not instead of",
 *     and `ref_file_ids` is rejected, so it cannot be said in the request.
 *
 * So it is said in the picture instead. Everything the person chose is drawn
 * into one sheet — jacket lying on the tee with its collar and sleeves
 * showing, trousers beneath, shoes at the foot — and goes on in a single
 * `full_body` call. Verified against the live API on 2026-08-17: one render,
 * thirty seconds, every piece correct, and the face and the background are
 * the ones we started with because nothing rendered twice.
 *
 * The layering geometry is the only subtle part: the under layer is drawn
 * larger and higher than the piece over it, so its collar and hem clear the
 * jacket's edges. Sized identically it would be hidden completely, and this
 * would be an expensive way to send a jacket.
 */
export async function outfitReference(
  pieces: OutfitPiece[],
): Promise<{ bytes: Buffer; contentType: string }> {
  const W = 900;
  const H = 1400;

  const PLACE: Record<
    OutfitSlot,
    { w: number; h: number; top: number; left?: number }
  > = {
    torso: { w: 0.66, h: 0.36, top: 0.01, left: -0.09 },
    layer: { w: 0.6, h: 0.3, top: 0.09, left: 0.09 },
    bottom: { w: 0.52, h: 0.44, top: 0.46 },
    shoes: { w: 0.4, h: 0.15, top: 0.85 },
    accessory: { w: 0.3, h: 0.22, top: 0.28, left: 0.34 },
  };
  // Drawing order, not body order: the layer and accessory go on last
  const ORDER: OutfitSlot[] = ["torso", "bottom", "shoes", "layer", "accessory"];

  const laid = await Promise.all(
    ORDER.filter((slot) => pieces.some((p) => p.slot === slot)).map(async (slot) => {
      const piece = pieces.find((p) => p.slot === slot) as OutfitPiece;
      const at = PLACE[slot];

      // Trimmed *before* it is sized, and this is load-bearing. The geometry
      // above says "the shirt is wider than the jacket", which is only true if
      // both fill their frames. A drawn starter piece is a small garment in
      // the middle of a lot of empty paper, and sized by its frame it comes
      // out smaller than the jacket and disappears completely underneath it —
      // which is exactly what "the blue tee still isn't there" looked like.
      const { data, info } = await sharp(piece.bytes, { failOn: "none" })
        .rotate()
        .trim({ threshold: 12 })
        .resize(Math.round(W * at.w), Math.round(H * at.h), { fit: "inside" })
        .toBuffer({ resolveWithObject: true })
        // A picture with no border to trim throws rather than returning
        // itself, and losing the garment over that would be absurd.
        .catch(() =>
          sharp(piece.bytes, { failOn: "none" })
            .rotate()
            .resize(Math.round(W * at.w), Math.round(H * at.h), { fit: "inside" })
            .toBuffer({ resolveWithObject: true }),
        );

      return {
        input: data,
        left: Math.max(
          0,
          Math.min(
            W - info.width,
            Math.round((W - info.width) / 2 + W * (at.left ?? 0)),
          ),
        ),
        top: Math.round(H * at.top),
      };
    }),
  );

  const bytes = await sharp({
    create: { width: W, height: H, channels: 3, background: "#ffffff" },
  })
    .composite(laid)
    .jpeg({ quality: 92 })
    .toBuffer();

  return { bytes, contentType: "image/jpeg" };
}

async function cut(input: Buffer, band: GarmentBand): Promise<GarmentCutout | null> {
  // One decode, at working size, with EXIF orientation applied. Everything
  // downstream is raw pixels over this buffer, so a 4000px phone photograph
  // costs the same as a 900px product shot from here on.
  const { data: work, info } = await sharp(input, { failOn: "none" })
    .rotate()
    .resize({
      width: MAX_EDGE,
      height: MAX_EDGE,
      fit: "inside",
      withoutEnlargement: true,
    })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const W = info.width;
  const H = info.height;
  if (W < 8 || H < 8) return null;

  /* ── 1 · the mask, at postage-stamp size ────────────────────────────── */
  const scale = MASK_EDGE / Math.max(W, H);
  const mw = Math.max(2, Math.round(W * scale));
  const mh = Math.max(2, Math.round(H * scale));

  const probe = await sharp(work, { raw: { width: W, height: H, channels: 3 } })
    .resize(mw, mh, { fit: "fill" })
    .ensureAlpha()
    .raw()
    .toBuffer();
  const px = new Uint8ClampedArray(probe.buffer, probe.byteOffset, probe.length);

  const mask = floodBackground(px, mw, mh);

  /* ── 2 · did it work? ───────────────────────────────────────────────── */
  let removed = 0;
  for (let i = 0; i < mask.length; i++) if (mask[i]) removed++;
  const removedFraction = removed / mask.length;

  // Unlike the browser path there is no preview to fall back to and no human
  // watching, so a doubtful matte is refused outright rather than shipped with
  // a flag. A shop photograph we can't cut cleanly is stored as the shop's.
  if (removedFraction < MIN_REMOVED || removedFraction > MAX_REMOVED) return null;

  const box = subjectBox(mask, mw, mh);
  if (!box.hits) return null;

  /* ── 3 · which band of the subject is the piece ─────────────────────── */
  const profile = skinProfile(px, mask, mw, mh);
  const window = garmentWindow(profile, box, band);
  const reframed = window.top !== box.minY || window.bottom !== box.maxY;

  // Only on a photograph we already know has a person in it — `reframed` is
  // true precisely when a face was found — and only when skin is a clear
  // minority of the subject. A camel coat trips the skin rule on every pixel
  // it has, and that is the one case where this would eat the garment rather
  // than the arms holding it.
  if (reframed && profile.share < 0.45) {
    // Over the *padded* band, not the band. The crop below adds air around the
    // window, and air added above a cut through the neck is more neck — a pink
    // sliver along the top edge of the card, which is the one part of a person
    // we just went to some trouble to remove.
    const air = Math.round((window.bottom - window.top + 1) * PAD);
    removeBareLimbs(px, mask, mw, mh, window.top - air, window.bottom + air);
  }

  // Measured last, so the dye is the cloth: after the head has been cropped
  // off and after the arms have been taken out from between the sleeves.
  const dominantColor = meanColor(px, mask, mw, mh, window.top, window.bottom);

  /* ── 4 · the crop, in working pixels ────────────────────────────────── */
  const sx = (box.minX / mw) * W;
  const sw = ((box.maxX - box.minX + 1) / mw) * W;
  const sy = (window.top / mh) * H;
  const sh = ((window.bottom - window.top + 1) / mh) * H;

  const padX = sw * PAD;
  const padY = sh * PAD;
  const left = Math.max(0, Math.round(sx - padX));
  const top = Math.max(0, Math.round(sy - padY));
  const width = Math.max(1, Math.min(W - left, Math.round(sw + padX * 2)));
  const height = Math.max(1, Math.min(H - top, Math.round(sh + padY * 2)));
  const rect = { left, top, width, height };

  /* ── 5 · compose ────────────────────────────────────────────────────── */
  // The matte is blown up to the working size *before* the crop, not after,
  // so the alpha and the photograph are cut with one identical rectangle.
  // Cropping each at its own resolution and resizing to meet leaves the two a
  // pixel or two out of step, which shows up as a rind of backdrop along one
  // edge — the exact artefact a cutout is supposed to remove.
  const alpha = softenMask(mask, mw, mh);

  const [rgbCrop, alphaCrop] = await Promise.all([
    sharp(work, { raw: { width: W, height: H, channels: 3 } })
      .extract(rect)
      .raw()
      .toBuffer(),
    // `.resize()` before `.extract()` is what makes the extract happen after
    // the scale-up rather than before it — sharp reads the order of the calls,
    // not the order of the arguments.
    //
    // The `b-w` at the end is not decoration. Every operation here promotes a
    // one-channel raw buffer to three on the way out, so without it the
    // alpha comes back triple length, gets read as if it were single, and the
    // matte lands on the photograph as a barcode.
    sharp(Buffer.from(alpha), { raw: { width: mw, height: mh, channels: 1 } })
      .resize(W, H, { fit: "fill" })
      .extract(rect)
      .toColourspace("b-w")
      .raw()
      .toBuffer(),
  ]);

  if (alphaCrop.length !== width * height) {
    throw new Error(
      `matte came back ${alphaCrop.length} bytes for a ${width}×${height} crop`,
    );
  }

  const bytes = await sharp(rgbCrop, {
    raw: { width, height, channels: 3 },
  })
    .joinChannel(alphaCrop, { raw: { width, height, channels: 1 } })
    .png({ compressionLevel: 9 })
    .toBuffer();

  return { bytes, contentType: "image/png", dominantColor, reframed };
}
