import { cors, preflight } from "@/lib/cors";
import { extractGarment } from "@/lib/cutout-server";
import { insertGarments, newId } from "@/lib/db";
import { userFromRequest } from "@/lib/ext-token";
import { fetchImage } from "@/lib/fetch-image";
import { isInPalette } from "@/lib/palette";
import { nearestDye } from "@/lib/seed";
import { storeBytes } from "@/lib/uploads";
import { CUTS, type Cut, type GarmentFit, type SizeRow } from "@/lib/fit";
import { isVtoTarget, type VtoTarget } from "@/lib/youcam";
import { ZONES, type Garment, type SeasonTag, type Zone } from "@/lib/types";

export const OPTIONS = preflight;

interface Body {
  name?: string;
  zone?: string;
  /** The YouCam surface it was rendered through, so it can be re-rendered. */
  vtoTarget?: string;
  /** Which plate it was hung on — the panel asks when there's more than one. */
  avatarId?: string;
  /** Average colour the extension measured off the garment image. */
  dominantColor?: string;
  material?: string;
  /** The VTO render — the piece on your body. */
  renderUrl?: string;
  /**
   * The piece on its own, as the try-on route stored it. Absent on older
   * extension builds and when the disk write failed, in which case the card
   * falls back to showing the render in both places.
   */
  garmentUrl?: string;
  /** The shop's own gallery image, so the cutout can be redone later. */
  originalUrl?: string;
  /** Where it was found, kept for the outfit history log. */
  sourceUrl?: string;
  /** The size the user was looking at, and what the page said about fitting. */
  sizeLabel?: string;
  fit?: GarmentFit;
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
 * The garment picture, when the try-on didn't leave one behind.
 *
 * The try-on route cuts the piece out and keeps it, and that is the path
 * essentially every save takes. This is the other three: a disk write that
 * failed, an extension built before the try-on route kept anything, and a
 * save retried after the render had already been thrown away. It costs one
 * fetch and one cutout, on a click that is already talking to the network.
 *
 * Whatever happens here, it must not end up being the render. That is a
 * photograph of the person, and a wardrobe full of those is a wardrobe with
 * no clothes in it.
 */
async function garmentFrom(
  originalUrl: string | undefined,
  target: VtoTarget | undefined,
): Promise<string | null> {
  if (!originalUrl || !target) return null;
  try {
    const { bytes } = await fetchImage(originalUrl);
    const cut = await extractGarment(bytes, target);
    return (await storeBytes(cut?.bytes ?? bytes, cut?.contentType ?? "image/jpeg")).url;
  } catch (err) {
    console.warn("[extension/save] couldn't recover a garment image:", err);
    return null;
  }
}

/**
 * The size chart arrives having been scraped off a page we don't control, so
 * it is bounded before it is stored: a fixed number of rows and columns, only
 * the dimensions we know about, and every measurement inside the range a
 * garment can physically occupy. Nothing here trusts the extension — the
 * extension is only trusted to hold a token.
 */
const MAX_CHART_ROWS = 24;
const PLAUSIBLE_CM: [number, number] = [20, 200];

function sanitiseFit(fit: GarmentFit | undefined): GarmentFit | undefined {
  if (!fit || typeof fit !== "object") return undefined;

  const out: GarmentFit = {};
  if (typeof fit.sizeLabel === "string") {
    out.sizeLabel = fit.sizeLabel.slice(0, 12).trim() || undefined;
  }
  if (CUTS.includes(fit.cut as Cut)) out.cut = fit.cut;
  if (["none", "some", "high"].includes(String(fit.stretch))) out.stretch = fit.stretch;

  const chart = fit.chart;
  if (chart && Array.isArray(chart.rows) && chart.rows.length) {
    const dims = [
      "chestCm", "waistCm", "hipCm", "shoulderCm",
      "inseamCm", "sleeveCm", "lengthCm", "footEu",
    ] as const;

    const rows: SizeRow[] = [];
    for (const row of chart.rows.slice(0, MAX_CHART_ROWS)) {
      const size = String(row?.size ?? "").slice(0, 14).trim();
      if (!size) continue;

      const kept: SizeRow = { size };
      let measured = 0;
      for (const dim of dims) {
        const v = Number(row?.[dim]);
        if (!Number.isFinite(v)) continue;
        const ok = dim === "footEu"
          ? v >= 15 && v <= 60
          : v >= PLAUSIBLE_CM[0] && v <= PLAUSIBLE_CM[1];
        if (!ok) continue;
        kept[dim] = Math.round(v * 10) / 10;
        measured++;
      }
      if (measured) rows.push(kept);
    }

    if (rows.length >= 2) {
      const source = typeof chart.source === "string" ? chart.source.slice(0, 60) : undefined;
      out.chart = {
        basis: chart.basis === "garment" ? "garment" : "body",
        basisStated: chart.basisStated === true,
        rows,
        source,
      };
    }
  }

  return Object.keys(out).length ? out : undefined;
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
  const vtoTarget = isVtoTarget(body.vtoTarget) ? body.vtoTarget : undefined;

  // Two images, the same two an upload carries: the garment, and the garment
  // worn. In that order of preference — the piece the try-on cut out, then one
  // recovered from the shop's own photograph, and only if both are gone, the
  // render. That last case used to be the *first* fallback, which is how a
  // saved piece could arrive in the wardrobe as a picture of its owner.
  const garmentUrl =
    body.garmentUrl ?? (await garmentFrom(body.originalUrl, vtoTarget));

  const garment: Garment = {
    id: newId(),
    userId: user.id,
    name: body.name.slice(0, 90).trim(),
    origin: "shop",
    zone,
    dye,
    season: SEASON_BY_MONTH[new Date().getMonth()],
    material: body.material?.slice(0, 80).trim() || "From a shop page",
    imageUrl: relativizeOwn(garmentUrl || body.renderUrl, req),
    tryOnUrl: relativizeOwn(body.renderUrl, req),
    originalUrl: body.originalUrl?.slice(0, 900),
    vtoTarget,
    sizeLabel: body.sizeLabel?.slice(0, 12).trim() || undefined,
    fit: sanitiseFit(body.fit),
    // The render already is this plate wearing the piece, so the card knows
    // whose body it is looking at even after the active plate changes.
    tryOnAvatarId:
      body.avatarId && user.avatars.some((a) => a.id === body.avatarId)
        ? body.avatarId
        : user.activeAvatarId,
    sourceUrl: body.sourceUrl?.slice(0, 500),
    seed: newId().slice(0, 8),
    status: "rendered",
    inPalette: isInPalette(dye, user.avatar?.colorSeason),
    wornCount: 0,
    addedAt: new Date().toISOString(),
  };

  await insertGarments([garment]);

  return cors({ saved: true, garment: { id: garment.id, dye: garment.dye } });
}
