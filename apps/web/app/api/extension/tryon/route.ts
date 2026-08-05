import { cors, preflight } from "@/lib/cors";
import { userFromRequest } from "@/lib/ext-token";
import { fetchImage } from "@/lib/fetch-image";
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
}

const MAX_INLINE_BYTES = 8 * 1024 * 1024;

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
  if (!user.avatar) {
    return cors(
      { error: "No avatar on file yet.", code: "no-avatar" },
      { status: 409 },
    );
  }

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return cors({ error: "Expected JSON." }, { status: 400 });
  }

  const target = body.category;
  if (!isVtoTarget(target) || (!body.imageData && !body.imageUrl)) {
    return cors(
      { error: "Need a garment image and a supported try-on target." },
      { status: 400 },
    );
  }

  try {
    const [avatar, garment] = await Promise.all([
      fetchImage(user.avatar.renderUrl),
      body.imageData
        ? decodeInline(body.imageData, body.contentType)
        : fetchImage(body.imageUrl!),
    ]);

    const result = await tryOnGarment(
      avatar,
      garment,
      target,
      user.preferences.vtoGender ?? "male",
    );

    return cors({
      // In mock mode there is no generated render, so we hand back the avatar
      // plate itself — the panel still shows a real body, clearly labelled.
      renderUrl:
        result.renderUrl ||
        new URL(user.avatar.renderUrl, req.url).toString(),
      taskId: result.taskId,
      mocked: result.mocked,
      target,
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
