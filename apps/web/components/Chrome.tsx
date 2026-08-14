"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { signOut } from "@/app/actions/auth";
import { Knot, Rangrez } from "./Wordmark";

const NAV = [
  { href: "/wardrobe", label: "Wardrobe", index: "01" },
  { href: "/look", label: "Look creator", index: "02" },
  { href: "/atelier", label: "Studio", index: "03" },
  { href: "/profile", label: "Profile", index: "04" },
  { href: "/connect", label: "Extension", index: "05" },
] as const;

export function TopBar({
  name,
  season,
  hasAvatar,
}: {
  name: string;
  season?: string;
  hasAvatar: boolean;
}) {
  const path = usePathname();

  return (
    <header className="sticky top-0 z-50 h-shell-top border-b border-ink/15 bg-paper/85 backdrop-blur-md">
      <div className="flex h-full items-stretch">
        <Link
          href="/wardrobe"
          className="flex shrink-0 items-center gap-2.5 border-r border-ink/15 px-4 py-3.5 lg:px-6"
        >
          <Knot size={16} />
          <span className="spec !tracking-[0.34em]">RANGREZ</span>
        </Link>

        <nav className="flex flex-1 items-stretch overflow-x-auto no-scrollbar">
          {NAV.map((item) => {
            const on = path.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                data-on={on}
                className="group relative flex items-center gap-2 border-r border-ink/15 px-4 py-3.5 transition-colors duration-300 data-[on=false]:text-ink-3 data-[on=true]:text-ink lg:px-6"
              >
                <span className="spec-sm opacity-45">{item.index}</span>
                <span className="spec">{item.label}</span>
                {on && (
                  <span className="absolute inset-x-0 bottom-0 h-[2px] bg-madder" />
                )}
              </Link>
            );
          })}
        </nav>

        <div className="hidden shrink-0 items-center gap-3 border-l border-ink/15 px-4 lg:flex lg:px-6">
          <span className="text-right leading-tight">
            <span className="tight block text-[0.8rem]">{name}</span>
            <span className="spec-sm block text-ink-3">
              {hasAvatar ? (season ?? "ANALYSING") : "NO AVATAR"}
            </span>
          </span>
          <form action={signOut}>
            <button
              type="submit"
              className="spec-sm border border-ink/25 px-2.5 py-2 text-ink-3 transition-colors duration-300 hover:border-ink hover:bg-ink hover:text-paper"
            >
              EXIT
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}

/**
 * The spine: rotated running text down the left edge, the way a book's
 * spine carries its title. Purely typographic furniture — hidden on anything
 * that isn't wide enough to spare the 2.25rem.
 */
export function Spine({ note }: { note: string }) {
  return (
    <aside className="sticky top-0 hidden h-dvh w-9 shrink-0 border-r border-ink/15 xl:block">
      <div className="flex h-full flex-col items-center justify-between py-6">
        {/* One vertical flow, the way a book spine carries its title: both the
            mono and the Devanagari turn together and read top to bottom. The
            spine is 2.25rem wide, so setting the word upright isn't an option
            — रंगरेज़ is wider than the rail it would sit in. */}
        <span className="spine spec-sm flex items-center gap-3 text-ink-3">
          RANGREZ
          {/* No colour of its own: it is the same word as the mono above it,
              so it takes the same ink-3.

              Sized off the glyphs' real ink, not their layout box. AMS Kartik
              is calligraphic and its swashes paint well outside the advance
              width — at 1.7rem getBoundingClientRect reports 27.2px while the
              actual ink measures 44.3px, which is how this overflowed a 36px
              rail while measuring as if it fitted. Canvas actualBoundingBox
              is the honest number: 0.95rem inks 24.4px across, leaving ~6px
              either side. */}
          <Rangrez className="text-[0.95rem]" />
        </span>
        <span aria-hidden className="h-16 w-px bg-ink/20" />
        <span className="spine spec-sm rotate-180 text-ink-3">{note}</span>
      </div>
    </aside>
  );
}

/**
 * The colophon, under every page but one.
 *
 * The look creator is a room that owns exactly one viewport and must have
 * nothing below it to scroll to. Which page is showing is a routing question a
 * server layout can't answer, so this reads the path itself and steps aside.
 */
export function Colophon() {
  const path = usePathname();
  if (path.startsWith("/look")) return null;

  return (
    <footer className="mt-24 border-t border-ink/15">
      <div className="grid gap-8 px-5 py-10 sm:grid-cols-2 lg:grid-cols-4 lg:px-8">
        <div>
          <p className="spec-sm mb-3 text-ink-3">COLOPHON</p>
          <p className="aside text-[1.35rem] leading-tight">
            Rangrez, the dyer of cloth.
          </p>
        </div>
        <p className="max-w-[34ch] text-[0.8rem] leading-relaxed text-ink-3">
          Virtual try-on rendered through YouCam (Perfect Corp) Apparel VTO.
          Cataloguing, colour-season ranking and combination caching are ours.
        </p>
        <p className="max-w-[34ch] text-[0.8rem] leading-relaxed text-ink-3">
          Placeholder photography stands in for garment renders until the
          segmentation pipeline is live. Each image is dipped in its own
          catalogued dye.
        </p>
        <div className="spec-sm space-y-2 text-ink-3">
          <p>V 0.1 · HACKATHON</p>
          <p>SET IN INSTRUMENT SERIF,</p>
          <p>INTER TIGHT & JETBRAINS MONO</p>
        </div>
      </div>
    </footer>
  );
}

/** Ticker. Reads as a mill noticeboard; also carries live counts. */
export function Marquee({ items }: { items: string[] }) {
  const track = [...items, ...items];
  return (
    <div className="overflow-hidden border-b border-ink/15 bg-ink py-2 text-paper">
      <div className="marquee-track flex w-max items-center gap-8 pr-8">
        {track.map((item, i) => (
          <span key={i} className="flex shrink-0 items-center gap-8">
            <span className="spec-sm whitespace-nowrap text-paper/75">{item}</span>
            <span aria-hidden className="text-turmeric">✦</span>
          </span>
        ))}
      </div>
    </div>
  );
}
