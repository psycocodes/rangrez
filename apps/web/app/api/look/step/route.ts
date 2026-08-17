import { NextResponse } from "next/server";

import { requireUser } from "@/lib/auth";
import { getGarment, pickAvatar } from "@/lib/db";
import { fetchImage } from "@/lib/fetch-image";
import { outfitReference, type OutfitSlot } from "@/lib/cutout-server";
import { SLOT_BY_ID } from "@/lib/look";
import { storeBytes } from "@/lib/uploads";
import { FRAMING, type SlotId } from "@/lib/types";
import { isVtoTarget, tryOnGarment } from "@/lib/youcam";

/** One garment onto one body. Comfortably inside any platform timeout. */
export const maxDuration = 120;

/**
 * POST /api/look/step — dress the body.
 *
 *   { pieces: [{ slot, garmentId }, …], target: "full_body", avatarId }
 *
 * One request, one render, however many pieces. This used to be a chain — a
 * call per layer, each render becoming the next render's body — and the chain
 * was the bug. Every call regenerates the whole photograph, so four layers
 * meant four chances for the face to drift, and `upper_body` replaces the
 * upper body rather than adding to it, so a jacket erased the tee under it and
 * the engine painted in a white shirt.
 *
 * Now the pieces are drawn onto one reference sheet (outfitReference in
 * lib/garment-cut.ts) and worn in a single `full_body` call. Nothing renders
 * twice, so nothing drifts — and a four-piece fit takes one render's time
 * rather than four.
 *
 * `baseUrl` survives for the case where a look is added to rather than rebuilt.
 * Every result is mirrored onto our own origin before being returned, which is
 * what makes accepting it back safe: the only value the client can usefully
 * send is one we minted, and anything that isn't an /uploads/ path is refused
 * rather than fetched.
 */

interface Body {
  /**
   * Everything being worn, in body order. Usually the whole outfit: they are
   * drawn onto one reference sheet and go on in a single render, because
   * rendering them one after another drifts the face and lets each layer
   * paint over the one before it. See outfitReference in lib/garment-cut.ts.
   */
  pieces?: Array<{ slot?: SlotId; garmentId?: string }>;
  /** Which category to ask for. Only `full_body` makes sense for a full sheet. */
  target?: string;
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

  const requested = (body.pieces ?? []).filter(
    (p): p is { slot: SlotId; garmentId: string } =>
      Boolean(p?.garmentId) && Boolean(p?.slot && SLOT_BY_ID[p.slot]),
  );
  if (!requested.length) {
    return NextResponse.json({ error: "Need something to put on." }, { status: 400 });
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
  const unwearable = requested.find((p) => !allowed.includes(p.slot));
  if (unwearable) {
    const slot = SLOT_BY_ID[unwearable.slot];
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

  const garments = await Promise.all(
    requested.map((p) => getGarment(user.id, p.garmentId)),
  );
  if (garments.some((g) => !g)) {
    return NextResponse.json({ error: "One of those pieces is gone." }, { status: 404 });
  }

  // A lone piece keeps its own surface — the garment's stored one wins, since a
  // bag and a watch both live on the accessory rail and are different
  // endpoints. A whole outfit is always full_body: it is one sheet of clothes.
  const single = garments.length === 1 ? garments[0] : undefined;
  const target =
    single?.vtoTarget && isVtoTarget(single.vtoTarget)
      ? single.vtoTarget
      : isVtoTarget(body.target)
        ? body.target
        : SLOT_BY_ID[requested[0].slot].target;

  // Only ever a path we minted from a previous step.
  if (body.baseUrl && !body.baseUrl.startsWith("/uploads/")) {
    return NextResponse.json(
      { error: "That isn't a body this app produced." },
      { status: 400 },
    );
  }
  const baseUrl = body.baseUrl || avatar.renderUrl;

  try {
    const [base, ...images] = await Promise.all([
      fetchImage(baseUrl),
      ...garments.map((g) => fetchImage(g!.imageUrl)),
    ]);

    // One garment goes as itself; several are laid out as an outfit sheet.
    const piece =
      images.length === 1
        ? images[0]
        : await outfitReference(
            images.map((image, i) => ({
              slot: requested[i].slot as OutfitSlot,
              bytes: image.bytes,
            })),
          );

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
        slots: requested.map((p) => p.slot),
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
      slots: requested.map((p) => p.slot),
    });
  } catch (err) {
    console.error("[look/step]", err);
    return NextResponse.json(
      {
        error:
          err instanceof Error
            ? err.message
            : "The dye house couldn't render that layer.",
        slots: requested.map((p) => p.slot),
      },
      { status: 502 },
    );
  }
}
