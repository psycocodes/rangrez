import { NextResponse } from "next/server";

import { requireUser } from "@/lib/auth";
import { insertFit, listFits } from "@/lib/db";
import { getGarment } from "@/lib/db";
import { supabase } from "@/lib/supabase";
import type { ArtifactItem, Garment } from "@/lib/types";

export const maxDuration = 60;

/**
 * GET /api/artifacts — list minted artifacts for the active user.
 */
export async function GET() {
  const user = await requireUser();

  try {
    const fits = await listFits(user.id);
    const artifacts: ArtifactItem[] = [];

    for (const fit of fits) {
      // Decode note if it carries json metadata or standard fields
      let meta: Partial<ArtifactItem> = {};
      try {
        if (fit.note && fit.note.startsWith("{")) {
          meta = JSON.parse(fit.note);
        }
      } catch {
        // plain note string
      }

      // Populate garments
      const garments: Garment[] = [];
      for (const gId of fit.garmentIds) {
        const g = await getGarment(user.id, gId);
        if (g) garments.push(g);
      }

      const wishlistCount = garments.filter((g) => g.origin === "shop").length;
      const totalPrice =
        meta.totalPrice ??
        garments.reduce((sum, g) => {
          const zoneEstimates: Record<string, number> = {
            top: 2490,
            bottom: 3990,
            outerwear: 7490,
            shoes: 4990,
            accessory: 1890,
          };
          return sum + (zoneEstimates[g.zone] || 2500);
        }, 0);

      artifacts.push({
        id: fit.id,
        userId: fit.userId,
        name: fit.name || "Minted Fit",
        renderUrl: meta.renderUrl || garments[0]?.tryOnUrl || garments[0]?.imageUrl || "",
        avatarId: meta.avatarId || user.activeAvatarId || user.avatars[0]?.id || "",
        avatarLabel: meta.avatarLabel || user.avatar?.customization.label || "Default Avatar",
        garments,
        totalPrice,
        wishlistCount,
        createdAt: fit.savedAt,
        note: meta.note || fit.note,
      });
    }

    return NextResponse.json({ artifacts });
  } catch (err) {
    console.error("[api/artifacts GET]", err);
    return NextResponse.json(
      { error: "Could not load artifacts.", artifacts: [] },
      { status: 500 },
    );
  }
}

/**
 * POST /api/artifacts — save a new minted artifact.
 */
export async function POST(req: Request) {
  const user = await requireUser();

  let body: Partial<ArtifactItem>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Expected JSON." }, { status: 400 });
  }

  if (!body.renderUrl && (!body.garments || !body.garments.length)) {
    return NextResponse.json({ error: "Missing fit data." }, { status: 400 });
  }

  const id = body.id || crypto.randomUUID();
  const garments = body.garments || [];
  const garmentIds = garments.map((g) => g.id);
  const now = new Date().toISOString();

  const metadataJson = JSON.stringify({
    renderUrl: body.renderUrl,
    avatarId: body.avatarId || user.activeAvatarId,
    avatarLabel: body.avatarLabel || user.avatar?.customization.label,
    totalPrice: body.totalPrice,
    wishlistCount: body.wishlistCount,
    note: body.note,
  });

  try {
    const saved = await insertFit({
      id,
      userId: user.id,
      name: body.name || `Look #${id.slice(0, 4).toUpperCase()}`,
      garmentIds,
      note: metadataJson,
      savedAt: now,
    });

    const item: ArtifactItem = {
      id: saved.id,
      userId: user.id,
      name: saved.name,
      renderUrl: body.renderUrl || "",
      avatarId: body.avatarId || user.activeAvatarId || "",
      avatarLabel: body.avatarLabel || user.avatar?.customization.label || "Active Avatar",
      garments,
      totalPrice: body.totalPrice || 0,
      wishlistCount: body.wishlistCount || 0,
      createdAt: saved.savedAt,
      note: body.note,
    };

    return NextResponse.json({ artifact: item });
  } catch (err) {
    console.error("[api/artifacts POST]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to save artifact." },
      { status: 500 },
    );
  }
}

/**
 * DELETE /api/artifacts — remove an artifact.
 */
export async function DELETE(req: Request) {
  const user = await requireUser();

  try {
    const { id } = await req.json();
    if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

    const { error } = await supabase()
      .from("rangrez_fits")
      .delete()
      .eq("user_id", user.id)
      .eq("id", id);

    if (error) throw error;

    return NextResponse.json({ success: true, id });
  } catch (err) {
    console.error("[api/artifacts DELETE]", err);
    return NextResponse.json(
      { error: "Could not delete artifact." },
      { status: 500 },
    );
  }
}
