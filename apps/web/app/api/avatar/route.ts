import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth";
import { usableBaseModel } from "@/lib/base-models-server";
import { newId, recomputePalette, updateUser } from "@/lib/db";
import { fetchImage } from "@/lib/fetch-image";
import { storeUpload } from "@/lib/uploads";
import { createAvatar } from "@/lib/youcam";
import { FRAMING, MAX_AVATARS, type Avatar, type AvatarFraming } from "@/lib/types";

const isFraming = (v: string): v is AvatarFraming => v in FRAMING;

/**
 * POST /api/avatar — the avatar pipeline (PRD Flow A).
 *
 * multipart/form-data:
 *   photo      the base photograph (required, unless `baseModel` is given)
 *   cutout     the same body with its background matted away (optional)
 *   baseModel  adopt a stock body instead of uploading one (optional)
 *   label      what to call this plate (optional)
 *   replace    an existing plate's id, to re-shoot it in place (optional)
 *
 * Without `replace` this adds a plate, up to MAX_AVATARS. The new one becomes
 * active, because someone who just shot a plate means to use it.
 *
 * The cutout is presentation only and is never sent to YouCam — the engine
 * gets the photograph with its background intact, because a matte that clipped
 * a shoulder is a matte it would then fit a jacket to. See Avatar.cutoutUrl.
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

  // Two ways in: a photograph of you, or a stock body to borrow. A base model
  // is resolved against the disk rather than trusted from the request, so an
  // id naming a body with no photograph behind it can't create a plate that
  // fails at its first render.
  const modelId = String(form.get("baseModel") ?? "").trim();
  const model = modelId ? await usableBaseModel(modelId) : undefined;
  if (modelId && !model) {
    return NextResponse.json(
      {
        error: "That base model has no photograph yet.",
        code: "model-unavailable",
      },
      { status: 409 },
    );
  }

  const photo = form.get("photo");
  if (!model && (!(photo instanceof File) || photo.size === 0)) {
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

  // A base model's plate already lives in public/; a photograph has to land
  // there first. Either way the rest of this route works from one url and one
  // set of bytes, which is why adopting a body needed no new pipeline.
  let plateUrl: string;
  let bytes: Buffer;
  let contentType: string;
  try {
    if (model) {
      const image = await fetchImage(model.plateUrl!);
      plateUrl = model.plateUrl!;
      bytes = image.bytes;
      contentType = image.contentType;
    } else {
      const stored = await storeUpload(photo as File);
      plateUrl = stored.url;
      bytes = stored.bytes;
      contentType = stored.contentType;
    }
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Upload failed." },
      { status: 400 },
    );
  }

  // The matte, cut in the browser. Optional in every sense: a photograph too
  // busy to matte cleanly doesn't send one, and every surface falls back to
  // the plate. Failing to store it must not fail the plate.
  let cutoutUrl: string | undefined;
  const cutout = form.get("cutout");
  if (cutout instanceof File && cutout.size > 0) {
    try {
      cutoutUrl = (await storeUpload(cutout)).url;
    } catch (err) {
      console.warn("[avatar] couldn't store the cutout:", err);
    }
  }

  const requested = String(form.get("label") ?? "").trim().slice(0, 40);

  // Confirmed by the user in the studio, not trusted from a guess. Anything
  // unrecognised falls back to "full", which restricts nothing. A base model
  // states its own framing, and it is right about it.
  const claimed = String(form.get("framing") ?? "");
  const framing: AvatarFraming = model
    ? model.framing
    : isFraming(claimed)
      ? claimed
      : "full";

  try {
    const result = await createAvatar(bytes, contentType);

    const avatar: Avatar = {
      id: replacing?.id ?? newId(),
      sourceUrl: plateUrl,
      // In mock mode there is no generated plate, so the source photo *is* the
      // avatar. That is also the graceful degradation path in production: a
      // failed calibration render should not block the wardrobe.
      renderUrl: result.renderUrl || plateUrl,
      cutoutUrl,
      baseModelId: model?.id,
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
          model?.label ||
          defaultLabel(user.name, user.avatars.length),
      },
    };

    const updated = await updateUser(user.id, (u) => {
      const at = u.avatars.findIndex((a) => a.id === avatar.id);
      if (at >= 0) u.avatars[at] = avatar;
      else u.avatars.push(avatar);
      u.activeAvatarId = avatar.id;
    });

    // A borrowed body carries its own fit model for the shoe/bag/hat surfaces,
    // which is a genuine API parameter and not a guess we should make on
    // someone's behalf — the base model states it, so we use it.
    if (model) {
      await updateUser(user.id, (u) => {
        u.preferences.vtoGender = model.vtoGender;
      });
    }

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
