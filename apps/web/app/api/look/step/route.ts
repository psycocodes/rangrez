import { NextResponse } from "next/server";

import { requireUser } from "@/lib/auth";
import { getGarment, pickAvatar } from "@/lib/db";
import { fetchImage } from "@/lib/fetch-image";
import { SLOT_BY_ID } from "@/lib/look";
import { storeBytes } from "@/lib/uploads";
import { FRAMING, type SlotId } from "@/lib/types";
import { isVtoTarget, tryOnGarment } from "@/lib/youcam";

/** One garment onto one body. Comfortably inside any platform timeout. */
export const maxDuration = 120;

/**
 * POST /api/look/step — put the next layer on.
 *
 * A whole outfit is several of these in sequence, driven from the client:
 * the first call dresses the avatar, and every call after it dresses the
 * previous call's result. The client orchestrates rather than the server
 * looping, for two reasons — the user watches each layer land instead of
 * staring at one ninety-second spinner, and no single request has to survive
 * four YouCam renders back to back.
 *
 *   1st   { garmentId, slot }                    → renders onto the avatar
 *   next  { garmentId, slot, baseUrl: "/uploads/…" }
 *
 * Every result is mirrored onto our own origin before being returned, which is
 * what makes it safe to accept `baseUrl` back: the only value the client can
 * usefully send is one we minted, and anything that isn't an /uploads/ path is
 * refused outright rather than fetched.
 */

interface Body {
  garmentId?: string;
  slot?: SlotId;
  avatarId?: string;
  baseUrl?: string;
}

export async function POST(req: Request) {
  const user = await requireUser();

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Expected JSON." }, { status: 400 });
  }

  const slot = body.slot && SLOT_BY_ID[body.slot];
  if (!slot || !body.garmentId) {
    return NextResponse.json(
      { error: "Need a garment and a slot." },
      { status: 400 },
    );
  }

  const avatar = pickAvatar(user, body.avatarId);
  if (!avatar) {
    return NextResponse.json(
      { error: "No avatar on file yet.", code: "no-avatar" },
      { status: 409 },
    );
  }

  // The body cannot wear what the camera never saw. Checked here and not only
  // in the UI — a disabled button is a courtesy, not a control.
  const allowed = FRAMING[avatar.framing ?? "full"].slots;
  if (!allowed.includes(slot.id)) {
    return NextResponse.json(
      {
        error: `"${avatar.customization.label}" is framed ${FRAMING[
          avatar.framing ?? "full"
        ].label.toLowerCase()}, so there's nowhere to put ${slot.label.toLowerCase()}.`,
        code: "framing",
      },
      { status: 422 },
    );
  }

  const garment = await getGarment(user.id, body.garmentId);
  if (!garment) {
    return NextResponse.json({ error: "That piece is gone." }, { status: 404 });
  }

  // The garment's own stored surface wins — a bag and a watch both live on the
  // accessory rail but are different endpoints. The slot is the fallback.
  const target =
    garment.vtoTarget && isVtoTarget(garment.vtoTarget)
      ? garment.vtoTarget
      : slot.target;

  // Only ever a path we minted from a previous step.
  if (body.baseUrl && !body.baseUrl.startsWith("/uploads/")) {
    return NextResponse.json(
      { error: "That isn't a body this app produced." },
      { status: 400 },
    );
  }
  const baseUrl = body.baseUrl || avatar.renderUrl;

  try {
    const [base, piece] = await Promise.all([
      fetchImage(baseUrl),
      fetchImage(garment.imageUrl),
    ]);

    const result = await tryOnGarment(
      base,
      piece,
      target,
      user.preferences.vtoGender ?? "male",
    );

    // Mock mode produces no render; the body passes through unchanged so the
    // whole chain still walks end to end without a key.
    if (!result.renderUrl) {
      return NextResponse.json({
        renderUrl: baseUrl,
        mocked: true,
        slot: slot.id,
      });
    }

    // Mirrored, always: YouCam's URLs are signed and expire in a couple of
    // hours, and this one is about to be fed back in as the next step's body.
    const { bytes, contentType } = await fetchImage(result.renderUrl);
    const stored = await storeBytes(bytes, contentType);

    return NextResponse.json({
      renderUrl: stored.url,
      taskId: result.taskId,
      mocked: result.mocked,
      slot: slot.id,
    });
  } catch (err) {
    console.error("[look/step]", err);
    return NextResponse.json(
      {
        error:
          err instanceof Error
            ? err.message
            : "The dye house couldn't render that layer.",
        slot: slot.id,
      },
      { status: 502 },
    );
  }
}
