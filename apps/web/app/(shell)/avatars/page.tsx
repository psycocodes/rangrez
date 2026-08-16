import Link from "next/link";

import { AvatarShelf } from "@/components/AvatarShelf";
import { BaseModelPicker } from "@/components/BaseModelPicker";
import { Ground } from "@/components/Ornament";
import { requireUser } from "@/lib/auth";
import { INK } from "@/lib/ornament";
import { listBaseModels } from "@/lib/base-models-server";
import { listGarments } from "@/lib/db";
import { FRAMING, MAX_AVATARS } from "@/lib/types";

export const metadata = { title: "Avatars — Rangrez" };

/**
 * Everything about bodies, in one place.
 *
 * This used to be a block inside the profile, which was wrong the moment
 * there could be three of them and a stock catalog to choose from as well.
 * The plate is not a setting — it is the thing every render in the product
 * happens on top of, and it deserves its own room.
 *
 * Two ways to get one, in the order most people will want them: shoot
 * yourself, or borrow a body. Both produce the same kind of plate and nothing
 * downstream can tell the difference.
 */
export default async function AvatarsPage() {
  const user = await requireUser();
  const [models, garments] = await Promise.all([
    listBaseModels(),
    listGarments(user.id),
  ]);

  const rendered = garments.filter((g) => g.tryOnUrl).length;
  const active = user.avatar;

  return (
    <Ground kind="ajrakh" tone={INK.peacock} accent={INK.brass} opacity={0.11} className="page">
      <section className="min-h-0 flex-1 overflow-y-auto px-4 lg:px-6">
      <div className="flex items-baseline justify-between gap-4 border-b border-ink/15 py-3">
        <span className="spec text-ink-3">03 — Bodies</span>
        <span className="spec-sm text-ink-3">
          {user.avatars.length} OF {MAX_AVATARS} PLATES
        </span>
      </div>

      <header className="grid gap-8 py-10 lg:grid-cols-[1.6fr_1fr] lg:py-14">
        <div>
          <p className="spec mb-6 text-madder">One body, every garment</p>
          <h1 className="display display-lg">
            The shoulders
            <br />
            <span className="aside">everything</span>
            <br />
            hangs on.
          </h1>
        </div>
        <p className="max-w-[44ch] self-end text-[0.95rem] leading-relaxed text-ink-2">
          Every piece you catalogue and every try-on you run is composited onto
          the plate in use — which is why the shirt from your closet and the
          coat from a shop page end up on the same shoulders, in the same light.
          Keep up to {MAX_AVATARS} and switch between them.
        </p>
      </header>

      {/* ── 3.1 · your plates ──────────────────────────────────────────── */}
      <Block
        index="3.1"
        title="Your plates"
        aside={
          user.avatars.length
            ? `${rendered} garment${rendered === 1 ? "" : "s"} rendered so far`
            : "nothing on file yet"
        }
      >
        {user.avatars.length ? (
          <AvatarShelf avatars={user.avatars} activeId={user.activeAvatarId} />
        ) : (
          <div className="border border-dashed border-ink/30 bg-paper-2 px-5 py-10 text-center">
            <p className="display display-md mb-3">
              No <span className="aside">body</span> yet.
            </p>
            <p className="mx-auto mb-7 max-w-[46ch] text-[0.9rem] leading-relaxed text-ink-3">
              Shoot one photograph and never think about it again — or borrow a
              body below and start dressing it in the next ten seconds.
            </p>
            <Link href="/atelier" className="btn inline-flex">
              <span className="spec">Shoot your plate</span>
              <span aria-hidden className="spec">→</span>
            </Link>
          </div>
        )}
      </Block>

      {/* ── 3.2 · borrow one ───────────────────────────────────────────── */}
      <Block index="3.2" title="Base models" aside="a body to borrow">
        <BaseModelPicker
          models={models}
          full={user.avatars.length >= MAX_AVATARS}
        />
      </Block>

      {/* ── 3.3 · what the plate in use can carry ──────────────────────── */}
      {active && (
        <Block
          index="3.3"
          title="What this body can wear"
          aside="read off the photograph"
        >
          <div className="grid gap-8 lg:grid-cols-[1fr_1.1fr] lg:gap-14">
            <div>
              <p className="display display-md mb-4">
                {active.customization.label} is framed{" "}
                <span className="aside">
                  {FRAMING[active.framing ?? "full"].label.toLowerCase()}.
                </span>
              </p>
              <p className="max-w-[46ch] text-[0.9rem] leading-relaxed text-ink-2">
                {FRAMING[active.framing ?? "full"].note}
              </p>
              <p className="rule mt-6 pt-3 text-[0.8rem] leading-relaxed text-ink-3">
                The look creator greys out every slot this body can&apos;t
                carry, rather than letting you spend a render finding out. Change
                it by re-shooting the plate.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-px self-start border border-ink/15 bg-ink/15 sm:grid-cols-4">
              {(["torso", "layer", "bottom", "shoes"] as const).map((slot) => {
                const can = FRAMING[active.framing ?? "full"].slots.includes(slot);
                return (
                  <div
                    key={slot}
                    className={`px-3 py-4 ${can ? "bg-paper" : "bg-paper-3"}`}
                  >
                    <span
                      aria-hidden
                      className={`mb-2.5 block h-1.5 w-1.5 rounded-full ${
                        can ? "bg-turmeric" : "bg-ink/20"
                      }`}
                    />
                    <p className={`spec ${can ? "text-ink" : "text-ink-3"}`}>
                      {slot}
                    </p>
                    <p className="spec-sm mt-1.5 text-ink-3">
                      {can ? "IN FRAME" : "NOT IN SHOT"}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </Block>
      )}
      </section>
    </Ground>
  );
}

function Block({
  index,
  title,
  aside,
  children,
}: {
  index: string;
  title: string;
  aside: string;
  children: React.ReactNode;
}) {
  return (
    <section className="border-t-2 border-ink py-8 lg:py-12">
      <div className="mb-8 flex flex-wrap items-baseline gap-x-4 gap-y-1.5">
        <span className="spec text-madder">{index}</span>
        <h2 className="display text-[1.9rem] leading-none">{title}</h2>
        <span className="aside text-[1.05rem] text-ink-3">— {aside}</span>
      </div>
      {children}
    </section>
  );
}
