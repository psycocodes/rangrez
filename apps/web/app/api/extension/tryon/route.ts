import { cors, preflight } from "@/lib/cors";
import { userFromRequest } from "@/lib/ext-token";
import { fetchImage } from "@/lib/fetch-image";
import { tryOnGarment, VTO_CATEGORIES, type VtoCategory } from "@/lib/youcam";

export const OPTIONS = preflight;

/** VTO renders take real seconds; don't let the platform cut us off at 15. */
export const maxDuration = 120;

interface Body {
  /** The garment image the extension picked as the cleanest of the gallery. */
  imageUrl?: string;
  category?: string;
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

  const category = body.category as VtoCategory;
  if (!body.imageUrl || !VTO_CATEGORIES.includes(category)) {
    return cors(
      { error: "Need an image URL and a supported garment category." },
      { status: 400 },
    );
  }

  try {
    const [avatar, garment] = await Promise.all([
      fetchImage(user.avatar.renderUrl),
      fetchImage(body.imageUrl),
    ]);

    const result = await tryOnGarment(avatar, garment, category);

    return cors({
      // In mock mode there is no generated render, so we hand back the avatar
      // plate itself — the panel still shows a real body, clearly labelled.
      renderUrl:
        result.renderUrl ||
        new URL(user.avatar.renderUrl, req.url).toString(),
      taskId: result.taskId,
      mocked: result.mocked,
      category,
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
