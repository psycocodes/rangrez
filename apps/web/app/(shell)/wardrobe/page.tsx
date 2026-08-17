import { ClosetRoom } from "@/components/ClosetRoom";
import { requireUser } from "@/lib/auth";
import { listGarments } from "@/lib/db";
import { seedCatalog } from "@/lib/seed";

export const metadata = { title: "Wardrobe — Rangrez" };

export default async function WardrobePage() {
  const user = await requireUser();
  const garments = seedCatalog(user.id);

  return (
    <ClosetRoom
      garments={garments}
      name={user.name}
      avatars={user.avatars}
      activeAvatarId={user.activeAvatarId}
    />
  );
}
