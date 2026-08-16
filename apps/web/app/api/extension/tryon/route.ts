import { cors, preflight } from "@/lib/cors";
import { extractGarment } from "@/lib/cutout-server";
import { pickAvatar } from "@/lib/db";
import { userFromRequest } from "@/lib/ext-token";
import { fetchImage } from "@/lib/fetch-image";
import { storeBytes } from "@/lib/uploads";
import { isVtoTarget, tryOnGarment } from "@/lib/youcam";

export const OPTIONS = preflight;

/** VTO renders take real seconds; don't let the platform cut us off at 15. */
export const maxDuration = 120;

interface Body {
  /**
   * The prepared reference: the winning gallery image already cropped to the
   * garment and flattened onto white by the extension, base64-encoded. This is
   * the normal path — it saves a server-side fetch and gives VTO a far cleaner
   * input than the raw editorial shot.
   */
  imageData?: string;
  contentType?: string;
  /** Fallback when preparation failed: fetch it here instead. */
  imageUrl?: string;
  category?: string;
  /**
   * Which plate to dress. The panel only asks when the account holds more than
   * one; absent means "whichever is in use", which is what every single-plate
   * account sends and what an older extension build sends too.
   */
  avatarId?: string;
}

const MAX_INLINE_BYTES = 8 * 1024 * 1024;

/**
 * Puts the isolated garment on our own disk, and never fails the try-on over
 * it. A render that lands without its flat shot is a card with one picture
 * instead of two; a render that didn't happen because a disk write failed is
 * the feature not working.
 */
async function keep(bytes: Buffer, contentType: string): Promise<string | null> {
  try {
    return (await storeBytes(bytes, contentType)).url;
  } catch (err) {
    console.warn("[extension/tryon] couldn't keep the garment image:", err);
    return null;
  }
}

/** Base64 from the extension → bytes, with a size ceiling. */
function decodeInline(base64: string, contentType = "image/jpeg") {
  const bytes = Buffer.from(base64, "base64");
  if (!bytes.byteLength) throw new Error("That garment image was empty.");
  if (bytes.byteLength > MAX_INLINE_BYTES) {
    throw new Error("That garment image is too large.");
  }
  return { bytes, contentType };
}

/**
 * POST /api/extension/tryon — PRD Flow D.
 *
 * The extension has already done the hard part: found the product, classified
 * the garment, and scored every image in the gallery to pick the one that
 * isolates the piece best. This route just proves the user, fetches both
 * images and hands them to Apparel VTO against their saved avatar.
 */
export async function POST(req: Request) {
  const user = await userFromRequest(req);
  if (!user) {
    return cors({ error: "Not connected.", code: "no-token" }, { status: 401 });
  }
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return cors({ error: "Expected JSON." }, { status: 400 });
  }

  // An unknown or stale avatarId falls back to the active plate rather than
  // failing: a plate retired in another tab shouldn't turn a try-on into an
  // error the user can do nothing about from a shop page.
  const avatar = pickAvatar(user, body.avatarId);
  if (!avatar) {
    return cors(
      { error: "No avatar on file yet.", code: "no-avatar" },
      { status: 409 },
    );
  }

  const target = body.category;
  if (!isVtoTarget(target) || (!body.imageData && !body.imageUrl)) {
    return cors(
      { error: "Need a garment image and a supported try-on target." },
      { status: 400 },
    );
  }

  try {
    const [plate, garment] = await Promise.all([
      fetchImage(avatar.renderUrl),
      body.imageData
        ? decodeInline(body.imageData, body.contentType)
        : fetchImage(body.imageUrl!),
    ]);

    // Keep the garment on its own before rendering it onto anyone.
    //
    // The extension has already isolated the piece from the shop's gallery —
    // cropped, flattened, the best of six candidates — and until now that
    // picture was used once and thrown away. It is the only photograph of the
    // garment *alone* that will ever exist for a shop save, so a piece saved
    // off a product page used to hang in the wardrobe as a body shot with
    // nothing to crossfade from. Storing it here costs one disk write on a
    // request that is about to spend twenty seconds in a render queue.
    //
    // "The best of six candidates" is still, very often, a model wearing the
    // thing — most shops photograph clothes on people. So it is cut out before
    // it is stored: backdrop flooded away, head dropped, framed to the band
    // the piece is worn on. What goes to YouCam is deliberately *not* this.
    // The engine was tuned on whole reference photographs and does its own
    // segmentation; handing it a pre-cut torso would be solving its problem
    // for it, badly. The cutout is for the wardrobe card, and only that.
    const cut = await extractGarment(garment.bytes, target);
    const garmentUrl = cut
      ? await keep(cut.bytes, cut.contentType)
      : await keep(garment.bytes, garment.contentType);

    const result = await tryOnGarment(
      plate,
      garment,
      target,
      user.preferences.vtoGender ?? "male",
    );

    return cors({
      // In mock mode there is no generated render, so we hand back the avatar
      // plate itself — the panel still shows a real body, clearly labelled.
      renderUrl:
        result.renderUrl || new URL(avatar.renderUrl, req.url).toString(),
      /** The garment alone, cut out. Saved as the catalog's `imageUrl`. */
      garmentUrl,
      /**
       * Read off the cutout rather than off the whole photograph, so a piece
       * shot on a model is filed under its own colour and not under an average
       * of the shirt, the model's arms and whatever they were standing in
       * front of. The extension prefers this to its own measurement.
       */
      dominantColor: cut?.dominantColor,
      taskId: result.taskId,
      mocked: result.mocked,
      target,
      avatarId: avatar.id,
    });
  } catch (err) {
    console.error("[extension/tryon]", err);
    return cors(
      {
        error:
          err instanceof Error ? err.message : "The dye house couldn't render that.",
      },
      { status: 502 },
    );
  }
}
