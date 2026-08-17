"use server";

import { revalidatePath } from "next/cache";

import { requireUser } from "@/lib/auth";
import { recomputePalette, updateUser } from "@/lib/db";

/**
 * Managing the shelf of plates.
 *
 * Shooting one is a POST to /api/avatar — it uploads a file and spends real
 * time in YouCam, so it wants a progress UI. Everything here is instant and
 * belongs to a form.
 */

function refresh() {
  revalidatePath("/profile");
  revalidatePath("/wardrobe");
  revalidatePath("/trialroom");
  revalidatePath("/avatar");
  revalidatePath("/avatars");
  revalidatePath("/atelier");
}

/**
 * Switch which plate is "your avatar".
 *
 * Each plate carries its own colour season — different light, different
 * reading — so the wardrobe is re-ranked against the one now in use. That is
 * our own maths, not YouCam's, so switching is free.
 */
export async function setActiveAvatar(formData: FormData): Promise<void> {
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const user = await requireUser();
  if (!user.avatars.some((a) => a.id === id)) return;

  const updated = await updateUser(user.id, (u) => {
    u.activeAvatarId = id;
  });

  await recomputePalette(user.id, updated?.avatar?.colorSeason);
  refresh();
}

/**
 * Retire a plate.
 *
 * Garments rendered against it keep their `tryOnUrl` — the render is still a
 * photograph of the user wearing the thing, and deleting a plate should not
 * quietly empty the wardrobe. The card knows the plate is gone via
 * `tryOnAvatarId` and offers a re-render.
 */
export async function deleteAvatar(formData: FormData): Promise<void> {
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const user = await requireUser();
  if (!user.avatars.some((a) => a.id === id)) return;

  const updated = await updateUser(user.id, (u) => {
    u.avatars = u.avatars.filter((a) => a.id !== id);
    // updateUser re-resolves the active plate, so dropping the active one
    // promotes the first survivor rather than leaving the account bodyless.
    if (u.activeAvatarId === id) u.activeAvatarId = u.avatars[0]?.id;
  });

  await recomputePalette(user.id, updated?.avatar?.colorSeason);
  refresh();
}

/** Rename a plate. This is the name the extension's picker shows. */
export async function renameAvatar(formData: FormData): Promise<void> {
  const id = String(formData.get("id") ?? "");
  const label = String(formData.get("label") ?? "").trim().slice(0, 40);
  if (!id || !label) return;

  const user = await requireUser();
  await updateUser(user.id, (u) => {
    const plate = u.avatars.find((a) => a.id === id);
    if (plate) plate.customization.label = label;
  });

  refresh();
}

/** Update body measurements for a specific avatar plate */
export async function updateAvatarMeasurements(formData: FormData): Promise<void> {
  const id = String(formData.get("id") ?? "");
  const heightCm = Number(formData.get("heightCm") ?? 0) || undefined;
  const chestCm = Number(formData.get("chestCm") ?? 0) || undefined;
  const waistCm = Number(formData.get("waistCm") ?? 0) || undefined;
  const hipCm = Number(formData.get("hipCm") ?? 0) || undefined;

  if (!id) return;
  const user = await requireUser();
  await updateUser(user.id, (u) => {
    const plate = u.avatars.find((a) => a.id === id);
    if (plate) {
      plate.measurements = {
        unit: "cm",
        heightCm,
        chestCm,
        waistCm,
        hipCm,
      };
      plate.useGlobalMeasurements = false;
    }
  });

  refresh();
}
