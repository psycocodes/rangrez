import { NextResponse } from "next/server";

import { requireUser } from "@/lib/auth";
import { getGarment, insertGarments, patchGarment, pickAvatar } from "@/lib/db";
import { fetchImage } from "@/lib/fetch-image";
import { storeBytes } from "@/lib/uploads";
import { isVtoTarget, tryOnGarment } from "@/lib/youcam";
import { findSeedPhoto } from "@/lib/seed-photos";
import { seedCatalog } from "@/lib/seed";
import type { Garment, Zone } from "@/lib/types";

/** A render is real seconds of YouCam; don't let the platform cut it off. */
export const maxDuration = 120;

/**
 * POST /api/wardrobe/render — put a piece on a body.
 */

/** The fallback when a piece predates `vtoTarget` — the four unambiguous rails. */
const BY_ZONE: Partial<Record<Zone, string>> = {
  top: "upper_body",
  bottom: "lower_body",
  outerwear: "upper_body",
  shoes: "shoes",
};

interface Body {
  id?: string;
  name?: string;
  zone?: Zone;
  imageUrl?: string;
  /** Which plate to render against. Defaults to whichever is in use. */
  avatarId?: string;
}

export async function POST(req: Request) {
  const user = await requireUser();

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Expected JSON." }, { status: 400 });
  }

  if (!body.id && !body.name) {
    return NextResponse.json({ error: "Which piece?" }, { status: 400 });
  }

  const avatar = pickAvatar(user, body.avatarId);
  if (!avatar) {
    return NextResponse.json(
      { error: "No avatar on file yet.", code: "no-avatar" },
      { status: 409 },
    );
  }

  let garment: Garment | undefined;
  if (body.id) {
    garment = await getGarment(user.id, body.id);
  }

  // If not found by id in DB (e.g. starter piece generated in-memory), match against seed catalog
  if (!garment) {
    const seeds = seedCatalog(user.id);
    const searchId = (body.id ?? "").toLowerCase();
    const searchName = (body.name ?? "").toLowerCase();

    garment = seeds.find(
      (s) =>
        (searchId && (s.id === body.id || s.seed === searchId || s.name.toLowerCase() === searchId)) ||
        (searchName && s.name.toLowerCase() === searchName),
    );

    if (garment) {
      // Persist it into the user's database catalog so subsequent calls find it by id
      await insertGarments([garment]).catch(() => {});
    }
  }

  if (!garment) {
    return NextResponse.json({ error: "That piece is gone." }, { status: 404 });
  }

  const target = garment.vtoTarget ?? BY_ZONE[garment.zone];
  if (!isVtoTarget(target)) {
    return NextResponse.json(
      {
        error: "There's no try-on surface for that kind of piece.",
        code: "no-surface",
      },
      { status: 422 },
    );
  }

  await patchGarment(user.id, garment.id, { status: "processing" });

  try {
    let garmentImageUrl = garment.imageUrl;
    const photo = findSeedPhoto(garment.name);
    if (photo && (!garmentImageUrl || garmentImageUrl.startsWith("data:"))) {
      garmentImageUrl = photo.file;
    }

    const avatarUrl = avatar.renderUrl || avatar.sourceUrl;
    const [plate, piece] = await Promise.all([
      fetchImage(avatarUrl),
      fetchImage(garmentImageUrl),
    ]);

    const result = await tryOnGarment(
      plate,
      piece,
      target,
      user.preferences.vtoGender ?? "male",
    );

    // Mock mode produces no render; the plate itself stands in so the flow is
    // still walkable end to end without a key.
    const tryOnUrl = result.renderUrl
      ? await mirror(result.renderUrl)
      : avatarUrl;

    const updated = await patchGarment(user.id, garment.id, {
      status: "rendered",
      tryOnUrl,
      tryOnAvatarId: avatar.id,
      taskId: result.taskId,
    });

    return NextResponse.json({
      garment: updated,
      tryOnUrl,
      mocked: result.mocked,
    });
  } catch (err) {
    console.error("[wardrobe/render]", err);
    await patchGarment(user.id, garment.id, { status: "failed" });
    return NextResponse.json(
      {
        error:
          err instanceof Error
            ? err.message
            : "The dye house couldn't render that.",
      },
      { status: 502 },
    );
  }
}

/**
 * Copy a YouCam render onto our own origin.
 *
 * If this fails we keep the signed URL rather than losing the render outright
 * — a picture that works for two hours beats no picture at all, and the card
 * offers a re-render either way.
 */
async function mirror(url: string): Promise<string> {
  try {
    const { bytes, contentType } = await fetchImage(url);
    return (await storeBytes(bytes, contentType)).url;
  } catch (err) {
    console.warn("[wardrobe/render] couldn't mirror the render:", err);
    return url;
  }
}
