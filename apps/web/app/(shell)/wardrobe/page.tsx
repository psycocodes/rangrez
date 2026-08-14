import Link from "next/link";

import { AddClothesButton, AddClothesProvider } from "@/components/AddClothes";
import { AvatarMissing, AvatarPlate } from "@/components/AvatarPlate";
import { Marquee } from "@/components/Chrome";
import { PaletteStrip } from "@/components/PaletteStrip";
import { PlateSwitcher } from "@/components/PlateSwitcher";
import { WardrobeGrid } from "@/components/WardrobeGrid";
import { requireUser } from "@/lib/auth";
import { listFits, listGarments } from "@/lib/db";
import { MAX_AVATARS, ZONE_LABEL, type Garment } from "@/lib/types";

export const metadata = { title: "Wardrobe — Rangrez" };

export default async function WardrobePage() {
  const user = await requireUser();
  const [garments, fits] = await Promise.all([
    listGarments(user.id),
    listFits(user.id),
  ]);

  const dyes = new Set(garments.map((g) => g.dye.name));
  const inPalette = garments.filter((g) => g.inPalette).length;
  const mostWorn = [...garments].sort((a, b) => b.wornCount - a.wornCount)[0];
  const season = user.avatar?.colorSeason;

  const uploaded = garments.filter((g) => g.origin === "upload").length;

  const ticker = [
    `${garments.length} PIECES CATALOGUED`,
    `${dyes.size} DYES ON THE CARD`,
    season ? `SEASON — ${season.name.toUpperCase()}` : "AVATAR NOT YET ANALYSED",
    `${inPalette} PIECES INSIDE YOUR PALETTE`,
    uploaded
      ? `${uploaded} SHOT BY YOU`
      : "UPLOAD YOUR OWN CLOTHES FROM THE GRID",
    user.avatars.length > 1
      ? `${user.avatars.length} PLATES ON THE SHELF`
      : `${fits.length} SAVED FITS`,
    mostWorn ? `MOST WORN — ${mostWorn.name.toUpperCase()}` : "NOTHING WORN YET",
    "HOVER ANY PIECE TO SEE IT WORN",
  ];

  return (
    <>
      <Marquee items={ticker} />
      {/* The provider wraps both because the masthead and the grid each offer
          to open the dock, and only one of them may exist on screen at a time. */}
      <AddClothesProvider
        avatars={user.avatars}
        activeAvatarId={user.activeAvatarId}
      >
        <Masthead
          name={user.name}
          garments={garments}
          dyeCount={dyes.size}
          inPalette={inPalette}
          user={user}
        />
        <WardrobeGrid garments={garments} hasAvatar={Boolean(user.avatar)} />
      </AddClothesProvider>
    </>
  );
}

function Masthead({
  name,
  garments,
  dyeCount,
  inPalette,
  user,
}: {
  name: string;
  garments: Garment[];
  dyeCount: number;
  inPalette: number;
  user: Awaited<ReturnType<typeof requireUser>>;
}) {
  const zones = new Set(garments.map((g) => g.zone));
  const stamped = new Date().toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

  return (
    <section className="px-4 lg:px-6">
      <div className="flex items-baseline justify-between gap-4 border-b border-ink/15 py-3">
        <span className="spec text-ink-3">01 — The wardrobe</span>
        <span className="spec-sm text-ink-3">{stamped.toUpperCase()}</span>
      </div>

      <div className="grid gap-8 py-10 lg:grid-cols-[1.65fr_1fr] lg:gap-14 lg:py-14">
        {/* ── left: the masthead proper ─────────────────────────────────── */}
        <div className="rise flex flex-col justify-between">
          <div>
            <p className="spec mb-6 text-madder">
              {name.split(" ")[0]}&apos;s closet, digitised
            </p>
            <h1 className="display display-xl">
              The wardrobe,
              <br />
              <span className="aside">as it hangs.</span>
            </h1>
            <p className="mt-7 max-w-[52ch] text-[0.98rem] leading-relaxed text-ink-2">
              Everything below has already been rendered onto your avatar — same
              body, same light, same room. Which means you are not looking at
              photographs of clothes. You are looking at{" "}
              <em className="aside">yourself</em>, wearing them.
            </p>
          </div>

          {/* Spec table. Data as decoration, decoration as data. */}
          <dl className="mt-10 grid grid-cols-2 gap-px border border-ink/15 bg-ink/15 sm:grid-cols-4">
            <Stat k="Pieces" v={String(garments.length).padStart(2, "0")} />
            <Stat k="Zones" v={`${zones.size} / 5`} />
            <Stat k="Dyes" v={String(dyeCount).padStart(2, "0")} />
            <Stat
              k="In palette"
              v={
                garments.length
                  ? `${Math.round((inPalette / garments.length) * 100)}%`
                  : "—"
              }
              accent
            />
          </dl>

          {/* Adding clothes is the point of the page, so it leads — and it is
              a plain link to ?add=1 rather than an island, because the grid
              below owns the dock and a URL crosses that boundary for free. */}
          <div className="mt-6 flex flex-wrap gap-2.5">
            <AddClothesButton />
            <Link href="/atelier" className="btn btn-ghost">
              <span className="spec">
                {user.avatar
                  ? user.avatars.length < MAX_AVATARS
                    ? "Shoot another plate"
                    : "Re-shoot a plate"
                  : "Create your avatar"}
              </span>
              <span aria-hidden className="spec">→</span>
            </Link>
            <Link href="/profile" className="btn btn-ghost">
              <span className="spec">Customise the plate</span>
              <span aria-hidden className="spec">◐</span>
            </Link>
          </div>
        </div>

        {/* ── right: the constant ───────────────────────────────────────── */}
        <aside className="rise lg:sticky lg:top-28 lg:self-start" style={{ animationDelay: "120ms" }}>
          <div className="mb-3 flex items-baseline justify-between">
            <span className="spec-sm text-ink-3">THE CONSTANT</span>
            <span className="spec-sm text-ink-3">PLATE 01</span>
          </div>

          {user.avatar ? (
            <>
              <AvatarPlate avatar={user.avatar} />
              <PlateSwitcher
                avatars={user.avatars}
                activeId={user.activeAvatarId}
              />
              {user.avatar.colorSeason && (
                <div className="mt-6">
                  <PaletteStrip season={user.avatar.colorSeason} />
                </div>
              )}
              <p className="rule mt-6 pt-3 text-[0.8rem] leading-relaxed text-ink-3">
                Every garment on this page was composited against this plate.
                Keep up to {MAX_AVATARS} in{" "}
                <Link href="/profile" className="text-ink underline decoration-madder underline-offset-4">your profile</Link>{" "}
                and switch whenever the light changes.
              </p>
            </>
          ) : (
            <AvatarMissing />
          )}

          <ZoneLedger garments={garments} />
        </aside>
      </div>
    </section>
  );
}

function Stat({ k, v, accent }: { k: string; v: string; accent?: boolean }) {
  return (
    <div className={`px-3.5 py-4 ${accent ? "bg-turmeric" : "bg-paper"}`}>
      <dt className="spec-sm mb-2.5 text-ink-3">{k}</dt>
      <dd className="display text-[2.1rem] leading-none">{v}</dd>
    </div>
  );
}

/** Zone breakdown as a set of hairline meters — a rail, seen end-on. */
function ZoneLedger({ garments }: { garments: Garment[] }) {
  const max = Math.max(
    1,
    ...Object.keys(ZONE_LABEL).map(
      (z) => garments.filter((g) => g.zone === z).length,
    ),
  );

  return (
    <div className="rule mt-6 pt-4">
      <p className="spec-sm mb-3.5 text-ink-3">ON THE RAIL</p>
      <ul className="space-y-2.5">
        {(Object.keys(ZONE_LABEL) as Array<keyof typeof ZONE_LABEL>).map((z) => {
          const n = garments.filter((g) => g.zone === z).length;
          return (
            <li key={z} className="flex items-center gap-3">
              <span className="spec-sm w-24 shrink-0 text-ink-2">
                {ZONE_LABEL[z]}
              </span>
              <span className="relative h-[3px] flex-1 bg-ink/12">
                <span
                  className="absolute inset-y-0 left-0 bg-indigo"
                  style={{ width: `${(n / max) * 100}%` }}
                />
              </span>
              <span className="spec-sm w-6 text-right text-ink-3">
                {String(n).padStart(2, "0")}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
