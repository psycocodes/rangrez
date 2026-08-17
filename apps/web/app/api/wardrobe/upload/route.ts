import { NextResponse } from "next/server";

import { requireUser } from "@/lib/auth";
import { insertGarments, newId } from "@/lib/db";
import { CUTS, type Cut } from "@/lib/fit";
import { UPLOAD_KINDS } from "@/lib/garment-kind";
import { isInPalette } from "@/lib/palette";
import { nearestDye } from "@/lib/seed";
import { storeUpload } from "@/lib/uploads";
import type { Garment, SeasonTag } from "@/lib/types";

/**
 * POST /api/wardrobe/upload — a piece from the user's own camera roll.
 *
 * Deliberately does no YouCam work. The extraction already happened in the
 * browser and the render is a separate call, so this route is a disk write and
 * an insert: the piece is in the grid within a few hundred milliseconds of
 * being chosen, marked as still rendering, and the slow part catches up behind
 * it. Batching the render in here instead would mean staring at a spinner for
 * twenty seconds per garment with nothing to look at.
 */

const SEASON_BY_MONTH: SeasonTag[] = [
  "winter", "winter", "spring", "spring", "spring", "summer",
  "summer", "summer", "autumn", "autumn", "autumn", "winter",
];

export async function POST(req: Request) {
  const user = await requireUser();

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Expected a multipart upload." }, { status: 400 });
  }

  const photo = form.get("photo");
  if (!(photo instanceof File) || photo.size === 0) {
    return NextResponse.json({ error: "No image received." }, { status: 400 });
  }

  // The rail and the YouCam surface travel together — see UPLOAD_KINDS for why
  // five rails can't carry eleven surfaces on their own.
  const kind =
    UPLOAD_KINDS.find((k) => k.id === String(form.get("kind") ?? "")) ??
    UPLOAD_KINDS[0];

  let stored;
  try {
    stored = await storeUpload(photo);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Upload failed." },
      { status: 400 },
    );
  }

  const dye = nearestDye(String(form.get("dominantColor") ?? "") || "#6D6555");
  const name =
    String(form.get("name") ?? "").trim().slice(0, 90) || `${kind.label} · new`;

  // Read off the garment's own label in the dock. Both optional — an unsized
  // piece is a perfectly good wardrobe entry — but together they are what
  // calibrates every size recommendation the extension makes later.
  const sizeLabel = String(form.get("sizeLabel") ?? "").trim().slice(0, 12);
  const claimedCut = String(form.get("cut") ?? "");
  const cut: Cut = CUTS.includes(claimedCut as Cut) ? (claimedCut as Cut) : "regular";

  const garment: Garment = {
    id: newId(),
    userId: user.id,
    name,
    origin: "upload",
    zone: kind.zone,
    dye,
    season: SEASON_BY_MONTH[new Date().getMonth()],
    material: String(form.get("material") ?? "").trim().slice(0, 80) || kind.label,
    imageUrl: stored.url,
    vtoTarget: kind.vto ?? undefined,
    sizeLabel: sizeLabel || undefined,
    fit: { cut, sizeLabel: sizeLabel || undefined },
    seed: newId().slice(0, 8),
    // "queued" is the honest state: it is in the wardrobe, and the body shot is
    // still coming. A piece YouCam has no surface for (a belt, a scarf) is
    // simply done — it hangs as a flat photograph and never claims otherwise.
    status: kind.vto ? "queued" : "rendered",
    inPalette: isInPalette(dye, user.avatar?.colorSeason),
    wornCount: 0,
    addedAt: new Date().toISOString(),
  };

  await insertGarments([garment]);

  return NextResponse.json({ garment, rendersOn: Boolean(kind.vto) });
}
