import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth";
import { newId, recomputePalette, updateUser } from "@/lib/db";
import { storeUpload } from "@/lib/uploads";
import { createAvatar } from "@/lib/youcam";
import { FRAMING, MAX_AVATARS, type Avatar, type AvatarFraming } from "@/lib/types";

const isFraming = (v: string): v is AvatarFraming => v in FRAMING;

/**
 * POST /api/avatar — the avatar pipeline (PRD Flow A).
 *
 * multipart/form-data:
 *   photo    the base photograph (required)
 *   label    what to call this plate (optional)
 *   replace  an existing plate's id, to re-shoot it in place (optional)
 *
 * Without `replace` this adds a plate, up to MAX_AVATARS. The new one becomes
 * active, because someone who just shot a plate means to use it.
 *
 * Runs synchronously and returns the finished record; the client shows a real
 * progress state throughout because this takes seconds, not milliseconds.
 */
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Expected a multipart upload." }, { status: 400 });
  }

  const photo = form.get("photo");
  if (!(photo instanceof File) || photo.size === 0) {
    return NextResponse.json({ error: "No photo received." }, { status: 400 });
  }

  const replaceId = String(form.get("replace") ?? "").trim() || null;
  const replacing = replaceId
    ? user.avatars.find((a) => a.id === replaceId)
    : undefined;

  if (replaceId && !replacing) {
    return NextResponse.json({ error: "That plate is gone." }, { status: 404 });
  }

  // Refused before the upload and before any YouCam spend — failing after a
  // 20-second render would be an unusually rude way to say "you have three".
  if (!replacing && user.avatars.length >= MAX_AVATARS) {
    return NextResponse.json(
      {
        error: `You can keep ${MAX_AVATARS} plates. Delete one to shoot another.`,
        code: "avatar-limit",
      },
      { status: 409 },
    );
  }

  let stored;
  try {
    stored = await storeUpload(photo);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Upload failed." },
      { status: 400 },
    );
  }

  const requested = String(form.get("label") ?? "").trim().slice(0, 40);

  // Confirmed by the user in the studio, not trusted from a guess. Anything
  // unrecognised falls back to "full", which restricts nothing.
  const claimed = String(form.get("framing") ?? "");
  const framing: AvatarFraming = isFraming(claimed) ? claimed : "full";

  try {
    const result = await createAvatar(stored.bytes, stored.contentType);

    const avatar: Avatar = {
      id: replacing?.id ?? newId(),
      sourceUrl: stored.url,
      // In mock mode there is no generated plate, so the source photo *is* the
      // avatar. That is also the graceful degradation path in production: a
      // failed calibration render should not block the wardrobe.
      renderUrl: result.renderUrl || stored.url,
      status: "rendered",
      taskId: result.taskId,
      colorSeason: result.colorSeason,
      framing,
      createdAt: replacing?.createdAt ?? new Date().toISOString(),
      customization: {
        // A re-shoot keeps everything the user tuned — they shouldn't lose
        // their crop and grade for taking a better photograph.
        ...(replacing?.customization ?? {
          backdrop: "paper",
          crop: "three-quarter",
          grade: 0,
          guides: true,
          label: "",
        }),
        label:
          requested ||
          replacing?.customization.label ||
          defaultLabel(user.name, user.avatars.length),
      },
    };

    const updated = await updateUser(user.id, (u) => {
      const at = u.avatars.findIndex((a) => a.id === avatar.id);
      if (at >= 0) u.avatars[at] = avatar;
      else u.avatars.push(avatar);
      u.activeAvatarId = avatar.id;
    });

    // Our own ranking pass against the now-active plate's season, no API spend.
    await recomputePalette(user.id, result.colorSeason);

    return NextResponse.json({
      avatar,
      avatars: updated?.avatars ?? [avatar],
      mocked: result.mocked,
    });
  } catch (err) {
    console.error("[avatar] pipeline failed:", err);
    return NextResponse.json(
      {
        error:
          err instanceof Error
            ? err.message
            : "The dye house couldn't process that photo.",
      },
      { status: 502 },
    );
  }
}

/**
 * The first plate is just you. Later ones need telling apart at a glance in the
 * profile shelf and in the extension's picker, and "Plate 02" is at least
 * honest about being unnamed — the user renames it in the profile.
 */
function defaultLabel(name: string, existing: number): string {
  return existing === 0 ? name : `Plate ${String(existing + 1).padStart(2, "0")}`;
}
