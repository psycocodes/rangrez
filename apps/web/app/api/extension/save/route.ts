import { cors, preflight } from "@/lib/cors";
import { insertGarments, newId } from "@/lib/db";
import { userFromRequest } from "@/lib/ext-token";
import { isInPalette } from "@/lib/palette";
import { nearestDye } from "@/lib/seed";
import { ZONES, type Garment, type SeasonTag, type Zone } from "@/lib/types";

export const OPTIONS = preflight;

interface Body {
  name?: string;
  zone?: string;
  /** Average colour the extension measured off the garment image. */
  dominantColor?: string;
  material?: string;
  /** The VTO render — this is what hangs in the wardrobe grid. */
  renderUrl?: string;
  /** Where it was found, kept for the outfit history log. */
  sourceUrl?: string;
}

const SEASON_BY_MONTH: SeasonTag[] = [
  "winter", "winter", "spring", "spring", "spring", "summer",
  "summer", "summer", "autumn", "autumn", "autumn", "winter",
];

/**
 * The extension needs absolute URLs to show a render on a shop's origin, but
 * the catalog must store our own files as paths. `next/image` refuses an
 * absolute `localhost` src, and a hard-coded host would rot the moment the app
 * moves — so anything pointing back at us gets collapsed to its pathname.
 */
function relativizeOwn(url: string, req: Request): string {
  try {
    const parsed = new URL(url, req.url);
    return parsed.origin === new URL(req.url).origin ? parsed.pathname : parsed.toString();
  } catch {
    return url;
  }
}

/**
 * POST /api/extension/save
 *
 * "Save to Wardrobe" from the try-on popup. The render becomes a catalog item
 * exactly like a closet upload does — same avatar, same grid, same palette
 * ranking — which is the entire reason the extension is worth having.
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

  if (!body.renderUrl || !body.name) {
    return cors({ error: "Need a render and a name." }, { status: 400 });
  }

  const zone: Zone = ZONES.includes(body.zone as Zone) ? (body.zone as Zone) : "top";
  const dye = nearestDye(body.dominantColor || "#6D6555");

  const garment: Garment = {
    id: newId(),
    userId: user.id,
    name: body.name.slice(0, 90).trim(),
    origin: "shop",
    zone,
    dye,
    season: SEASON_BY_MONTH[new Date().getMonth()],
    material: body.material?.slice(0, 80).trim() || "From a shop page",
    imageUrl: relativizeOwn(body.renderUrl, req),
    seed: newId().slice(0, 8),
    status: "rendered",
    inPalette: isInPalette(dye, user.avatar?.colorSeason),
    wornCount: 0,
    addedAt: new Date().toISOString(),
  };

  await insertGarments([garment]);

  return cors({ saved: true, garment: { id: garment.id, dye: garment.dye } });
}
