import Link from "next/link";

import { AvatarMissing } from "@/components/AvatarPlate";
import { LookCreator } from "@/components/LookCreator";
import { requireUser } from "@/lib/auth";
import { listGarments } from "@/lib/db";
import { slotFor } from "@/lib/look";

export const metadata = { title: "Look creator — Rangrez" };

export default async function LookPage() {
  const user = await requireUser();
  const garments = await listGarments(user.id);

  // Anything that belongs on a body. The starter wardrobe is included on
  // purpose — those are real rows with real images, so a fresh account has
  // something to deal into both hands and the page can be driven end to end
  // before you own a single thing. The cards label them STARTER.
  const wearable = garments.filter((g) => slotFor(g) !== null);

  if (!user.avatar) {
    return (
      <section className="px-4 lg:px-6">
        <div className="grid items-center gap-10 py-16 lg:grid-cols-[1fr_22rem] lg:py-24">
          <div>
            <p className="spec mb-6 text-madder">Nothing to dress</p>
            <h1 className="display display-lg">
              Build a fit
              <br />
              <span className="aside">on a body.</span>
            </h1>
            <p className="mt-7 max-w-[46ch] text-[0.98rem] leading-relaxed text-ink-2">
              The look creator hangs a whole outfit — top, bottom, shoes and a
              layer over the lot — on one avatar, one garment at a time. It needs
              that avatar first.
            </p>
            <Link href="/atelier" className="btn mt-8">
              <span className="spec">Create your avatar</span>
              <span aria-hidden className="spec">→</span>
            </Link>
          </div>
          <AvatarMissing />
        </div>
      </section>
    );
  }

  return (
    <LookCreator
      avatars={user.avatars}
      activeAvatarId={user.activeAvatarId}
      garments={wearable}
    />
  );
}
