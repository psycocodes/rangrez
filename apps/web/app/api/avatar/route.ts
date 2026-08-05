import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth";
import { newId, recomputePalette, updateUser } from "@/lib/db";
import { storeUpload } from "@/lib/uploads";
import { createAvatar } from "@/lib/youcam";
import type { Avatar } from "@/lib/types";

/**
 * POST /api/avatar — the one-time onboarding call (PRD Flow A).
 *
 * multipart/form-data with a single `photo` field. Runs the whole avatar
 * pipeline synchronously and returns the finished record; the client shows a
 * real progress state throughout because Apparel VTO is task-based and this
 * takes seconds, not milliseconds.
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

  let stored;
  try {
    stored = await storeUpload(photo);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Upload failed." },
      { status: 400 },
    );
  }

  try {
    const result = await createAvatar(stored.bytes, stored.contentType);

    const avatar: Avatar = {
      id: newId(),
      sourceUrl: stored.url,
      // In mock mode there is no generated plate, so the source photo *is* the
      // avatar. That is also the graceful degradation path in production: a
      // failed calibration render should not block the wardrobe.
      renderUrl: result.renderUrl || stored.url,
      status: "rendered",
      taskId: result.taskId,
      colorSeason: result.colorSeason,
      createdAt: new Date().toISOString(),
      customization: {
        backdrop: "paper",
        crop: "three-quarter",
        grade: 0,
        guides: true,
        label: user.name,
      },
    };

    await updateUser(user.id, (u) => {
      // Keep the existing presentation settings across a re-shoot — the user
      // tuned those, they shouldn't lose them for taking a better photo.
      if (u.avatar) avatar.customization = u.avatar.customization;
      u.avatar = avatar;
    });

    // Our own ranking pass, no extra API spend.
    await recomputePalette(user.id, result.colorSeason);

    return NextResponse.json({ avatar, mocked: result.mocked });
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
