"use server";

import { revalidatePath } from "next/cache";

import { requireUser } from "@/lib/auth";
import { deleteSeedGarments, recomputePalette, updateUser } from "@/lib/db";
import { buildSeason, SEASON_NAMES } from "@/lib/palette";
import type { AvatarCustomization } from "@/lib/types";

function refresh() {
  revalidatePath("/profile");
  revalidatePath("/wardrobe");
}

/**
 * Presentation of one avatar plate — applies everywhere that plate appears.
 *
 * Takes an explicit `id` rather than assuming the active plate: the profile
 * shelf can hold three, and editing the crop of the one you are looking at
 * should not depend on it also being the one currently in use.
 */
export async function saveCustomization(form: FormData): Promise<void> {
  const user = await requireUser();

  const id = String(form.get("id") ?? "") || user.activeAvatarId;
  const target = user.avatars.find((a) => a.id === id);
  if (!target) return;

  const backdrop = String(form.get("backdrop") ?? "paper") as AvatarCustomization["backdrop"];
  const crop = String(form.get("crop") ?? "three-quarter") as AvatarCustomization["crop"];
  const grade = Number(form.get("grade") ?? 0);
  const label = String(form.get("label") ?? user.name).trim() || user.name;

  await updateUser(user.id, (u) => {
    const plate = u.avatars.find((a) => a.id === target.id);
    if (!plate) return;
    plate.customization = {
      backdrop: (["paper", "vat", "madder", "studio"] as const).includes(backdrop)
        ? backdrop
        : "paper",
      crop: (["full", "three-quarter", "bust"] as const).includes(crop)
        ? crop
        : "three-quarter",
      grade: Number.isFinite(grade) ? Math.max(-100, Math.min(100, grade)) : 0,
      guides: form.get("guides") === "on",
      label,
    };
  });

  refresh();
}

/**
 * Manual colour-season override. The analysis is a starting point, not a
 * verdict — people know their own colouring, and a wrong season would quietly
 * poison every recommendation downstream.
 */
export async function setColorSeason(form: FormData): Promise<void> {
  const user = await requireUser();
  const name = String(form.get("season") ?? "");
  if (!SEASON_NAMES.includes(name) || !user.avatar) return;

  const season = buildSeason(name, 1);
  await updateUser(user.id, (u) => {
    if (u.avatar) u.avatar.colorSeason = season;
  });
  await recomputePalette(user.id, season);

  refresh();
}

export async function savePreferences(form: FormData): Promise<void> {
  const user = await requireUser();

  const fit = String(form.get("fitPreference") ?? "regular");
  const height = Number(form.get("heightCm"));

  await updateUser(user.id, (u) => {
    u.name = String(form.get("name") ?? u.name).trim() || u.name;
    u.preferences.fitPreference = (["relaxed", "regular", "tailored"] as const).includes(
      fit as "relaxed" | "regular" | "tailored",
    )
      ? (fit as "relaxed" | "regular" | "tailored")
      : "regular";
    u.preferences.heightCm =
      Number.isFinite(height) && height > 0 ? Math.round(height) : undefined;
    u.preferences.paletteFirst = form.get("paletteFirst") === "on";

    const g = String(form.get("vtoGender") ?? "");
    if (g === "male" || g === "female") u.preferences.vtoGender = g;
  });

  refresh();
}

/** Clear the demo starter wardrobe once real uploads exist. */
export async function clearStarterWardrobe(): Promise<void> {
  const user = await requireUser();
  await deleteSeedGarments(user.id);
  refresh();
}
