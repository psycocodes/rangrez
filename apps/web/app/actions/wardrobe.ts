"use server";

import { revalidatePath } from "next/cache";

import { requireUser } from "@/lib/auth";
import { deleteGarment, getGarment, patchGarment } from "@/lib/db";
import { isInPalette } from "@/lib/palette";
import { DYES } from "@/lib/seed";
import { ZONES, type Dye, type Garment, type SeasonTag, type Zone } from "@/lib/types";

const SEASONS: SeasonTag[] = ["spring", "summer", "autumn", "winter", "yearround"];

export interface WardrobeState {
  error?: string;
  ok?: boolean;
}

function refresh() {
  revalidatePath("/wardrobe");
  revalidatePath("/profile");
}

/**
 * Edit a piece. Everything the card shows is editable — the auto-tagging from
 * upload and from the extension is a first guess, and a wardrobe you can't
 * correct is a wardrobe you stop trusting.
 */
export async function saveGarment(
  _prev: WardrobeState,
  form: FormData,
): Promise<WardrobeState> {
  const user = await requireUser();
  const id = String(form.get("id") ?? "");
  if (!id) return { error: "Nothing to save." };

  const name = String(form.get("name") ?? "").trim();
  if (!name) return { error: "It needs a name." };

  const zone = String(form.get("zone") ?? "") as Zone;
  const season = String(form.get("season") ?? "") as SeasonTag;
  const dyeName = String(form.get("dye") ?? "");
  const dye = (Object.values(DYES) as Dye[]).find((d) => d.name === dyeName);

  const worn = Number(form.get("wornCount"));

  const fields: Parameters<typeof patchGarment>[2] = {
    name: name.slice(0, 90),
    material: String(form.get("material") ?? "").trim().slice(0, 80),
  };
  if (ZONES.includes(zone)) fields.zone = zone;
  if (SEASONS.includes(season)) fields.season = season;
  if (Number.isFinite(worn) && worn >= 0) fields.wornCount = Math.min(worn, 9999);

  // Changing the dye changes whether the piece flatters the user, so the
  // palette flag is recomputed here rather than drifting until the next
  // full re-rank.
  if (dye) {
    fields.dye = dye;
    fields.inPalette = isInPalette(dye, user.avatar?.colorSeason);
  }

  const updated = await patchGarment(user.id, id, fields);
  if (!updated) return { error: "That piece is no longer in your wardrobe." };

  refresh();
  return { ok: true };
}

/** Move a piece to another rail without opening the editor. */
export async function moveGarment(id: string, zone: Zone): Promise<void> {
  const user = await requireUser();
  if (!ZONES.includes(zone)) return;
  await patchGarment(user.id, id, { zone });
  refresh();
}

/** The outfit history log in miniature (PRD §4.5). */
export async function wearGarment(id: string): Promise<void> {
  const user = await requireUser();
  const garment = await getGarment(user.id, id);
  if (!garment) return;
  await patchGarment(user.id, id, { wornCount: garment.wornCount + 1 });
  refresh();
}

export async function removeGarment(id: string): Promise<void> {
  const user = await requireUser();
  await deleteGarment(user.id, id);
  refresh();
}

/** Used by the editor to offer the same dye card the rest of the app uses. */
export async function listDyes(): Promise<Dye[]> {
  return Object.values(DYES) as Dye[];
}

export type { Garment };
