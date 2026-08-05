"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { signOut } from "@/app/actions/auth";
import { Knot } from "./Wordmark";

const NAV = [
  { href: "/wardrobe", label: "Wardrobe", index: "01" },
  { href: "/atelier", label: "Studio", index: "02" },
  { href: "/profile", label: "Profile", index: "03" },
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
    <header className="sticky top-0 z-50 border-b border-ink/15 bg-paper/85 backdrop-blur-md">
      <div className="flex items-stretch">
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
        <span className="spine spec-sm text-ink-3">RANGREZ / رنگریز</span>
        <span aria-hidden className="h-16 w-px bg-ink/20" />
        <span className="spine spec-sm rotate-180 text-ink-3">{note}</span>
      </div>
    </aside>
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
