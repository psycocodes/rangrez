import { headers } from "next/headers";

import { ArtifactsView } from "@/components/ArtifactsView";
import { requireUser } from "@/lib/auth";
import { getGarment, listFits } from "@/lib/db";
import { mintExtensionToken } from "@/lib/ext-token";
import type { ArtifactItem, Garment } from "@/lib/types";

export const metadata = { title: "Artifacts — Rangrez" };

export default async function ArtifactsPage() {
  const user = await requireUser();
  const token = mintExtensionToken(user);
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const apiBase = `${proto}://${host}`;

  const fits = await listFits(user.id);
  const initialArtifacts: ArtifactItem[] = [];

  for (const fit of fits) {
    let meta: Partial<ArtifactItem> = {};
    try {
      if (fit.note && fit.note.startsWith("{")) {
        meta = JSON.parse(fit.note);
      }
    } catch {
      // fallback
    }

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

    initialArtifacts.push({
      id: fit.id,
      userId: fit.userId,
      name: fit.name || "Minted Fit",
      renderUrl: meta.renderUrl || garments[0]?.tryOnUrl || garments[0]?.imageUrl || "",
      avatarId: meta.avatarId || user.activeAvatarId || user.avatars[0]?.id || "",
      avatarLabel: meta.avatarLabel || user.avatar?.customization.label || "Active Avatar",
      garments,
      totalPrice,
      wishlistCount,
      createdAt: fit.savedAt,
      note: meta.note || fit.note,
    });
  }

  return (
    <ArtifactsView
      user={user}
      initialArtifacts={initialArtifacts}
      token={token}
      apiBase={apiBase}
    />
  );
}
