"use server";

import { revalidatePath } from "next/cache";

import { requireUser } from "@/lib/auth";
import { deleteSeedGarments, recomputePalette, updateUser } from "@/lib/db";
import {
  MEASUREMENT_FIELDS,
  readMeasurement,
  type MeasureUnit,
  type Measurements,
} from "@/lib/fit";
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

  await updateUser(user.id, (u) => {
    u.name = String(form.get("name") ?? u.name).trim() || u.name;
    u.preferences.fitPreference = (["relaxed", "regular", "tailored"] as const).includes(
      fit as "relaxed" | "regular" | "tailored",
    )
      ? (fit as "relaxed" | "regular" | "tailored")
      : "regular";
    u.preferences.paletteFirst = form.get("paletteFirst") === "on";

    const g = String(form.get("vtoGender") ?? "");
    if (g === "male" || g === "female") u.preferences.vtoGender = g;
  });

  refresh();
}

/**
 * The body, entered once.
 *
 * Every field is optional and every field is independently discarded if it
 * doesn't parse or lands outside the range a human occupies — a mistyped
 * "1740" for a height must not be able to poison a size recommendation, and
 * it must not take the other eight numbers down with it either.
 *
 * Blank means "I don't know this one", so a field cleared on purpose clears
 * in storage. That is why this walks the whole field list rather than only
 * the keys that came back with something in them.
 */
export async function saveMeasurements(form: FormData): Promise<void> {
  const user = await requireUser();

  const claimed = String(form.get("unit") ?? "cm");
  const unit: MeasureUnit = claimed === "in" ? "in" : "cm";

  await updateUser(user.id, (u) => {
    const next: Measurements = { unit, updatedAt: new Date().toISOString() };
    for (const field of MEASUREMENT_FIELDS) {
      const value = readMeasurement(field.key, form.get(field.key), unit);
      if (value !== undefined) {
        (next[field.key] as number) = value;
      }
    }
    u.measurements = next;
  });

  revalidatePath("/profile");
  revalidatePath("/wardrobe");
}

/** Clear the demo starter wardrobe once real uploads exist. */
export async function clearStarterWardrobe(): Promise<void> {
  const user = await requireUser();
  await deleteSeedGarments(user.id);
  refresh();
}

/** Update profile photo preference or URL */
export async function updateProfilePhoto(form: FormData): Promise<void> {
  const user = await requireUser();
  const photoUrl = String(form.get("photoUrl") ?? "").trim();
  const useGoogle = form.get("useGoogle") === "on";

  await updateUser(user.id, (u) => {
    u.profilePhotoUrl = photoUrl || u.profilePhotoUrl;
    u.useGooglePhoto = useGoogle;
  });

  refresh();
}
