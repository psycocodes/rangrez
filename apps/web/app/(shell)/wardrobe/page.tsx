import { headers } from "next/headers";
import { ClosetRoom } from "@/components/ClosetRoom";
import { requireUser } from "@/lib/auth";
import { listBaseModels } from "@/lib/base-models-server";
import { mintExtensionToken } from "@/lib/ext-token";
import { seedCatalog } from "@/lib/seed";

export const metadata = { title: "Wardrobe — Rangrez" };

export default async function WardrobePage() {
  const [user, baseModels] = await Promise.all([
    requireUser(),
    listBaseModels(),
  ]);

  const garments = seedCatalog(user.id);
  const token = mintExtensionToken(user);
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const apiBase = `${proto}://${host}`;

  return (
    <ClosetRoom
      garments={garments}
      user={user}
      baseModels={baseModels}
      token={token}
      apiBase={apiBase}
    />
  );
}
