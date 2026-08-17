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
      note={user.avatar?.colorSeason?.name.toUpperCase() ?? "YEAR ROUND"}
      avatars={user.avatars}
      activeAvatarId={user.activeAvatarId}
    />
  );
}
