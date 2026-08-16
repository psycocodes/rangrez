import { ClosetRoom } from "@/components/ClosetRoom";
import { requireUser } from "@/lib/auth";
import { listGarments } from "@/lib/db";

export const metadata = { title: "Wardrobe — Rangrez" };

/**
 * The wardrobe is a cupboard, not a page.
 *
 * Everything that used to live here — the marquee, the masthead statistics,
 * the filter bar, the editorial grid — is gone on purpose. A closet does not
 * have a dashboard on top of it. What is left is the rail and the clothes,
 * which is what someone opening a wardrobe came for.
 */
export default async function WardrobePage() {
  const user = await requireUser();
  const garments = await listGarments(user.id);

  return (
    <ClosetRoom
      garments={garments}
      name={user.name}
      avatars={user.avatars}
      activeAvatarId={user.activeAvatarId}
    />
  );
}
