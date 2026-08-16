"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { signOut } from "@/app/actions/auth";
import { Knot } from "./Wordmark";
import { INK, phool } from "@/lib/ornament";

/**
 * The masthead.
 *
 * Every page hangs off this, so it has one job above all others: say where you
 * are and let you leave, in as little height as that can be done in. It is
 * 3rem tall, which `--spacing-shell-top` also feeds to `.page` — one number,
 * two consumers, so the header and the viewport arithmetic can never disagree.
 *
 * ── the matchbox rules, applied to a nav bar ─────────────────────────────
 *
 *   · the field is never empty — a buti repeat runs behind it, faint enough
 *     to be texture rather than pattern at this height
 *   · everything is framed — a heavy abyss rule under it, a brass hairline
 *     above that, which is the double rule a label closes with
 *   · few colours, fully saturated — the live tab is brass, and it is the
 *     only saturated thing in the bar, so it cannot be missed
 *
 * Devanagari numerals on the tabs rather than 01–05: this is a Hindi word for
 * a Hindi trade, and the numbers are the one place that can be said without
 * making anyone read a language they may not have.
 */
const NAV = [
  { href: "/look", label: "Dashboard", mark: "०१" },
  { href: "/wardrobe", label: "Wardrobe", mark: "०२" },
  { href: "/avatars", label: "Avatars", mark: "०३" },
  { href: "/profile", label: "Profile", mark: "०४" },
  { href: "/connect", label: "Extension", mark: "०५" },
] as const;

export function Masthead({ name, note }: { name: string; note?: string }) {
  const path = usePathname();

  return (
    <header
      className="relative z-40 flex h-shell-top shrink-0 items-stretch border-b-2 border-abyss bg-leaf"
      style={{ backgroundImage: `url("${phool(INK.peacock, 0.06, 104)}")` }}
    >
      {/* The brass hairline that makes the bottom rule a double rule. */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 h-[3px] translate-y-full bg-brass/70"
      />

      <Link
        href="/look"
        className="group flex shrink-0 items-center gap-2.5 border-r-2 border-abyss px-3.5 lg:px-5"
        aria-label="Rangrez — dashboard"
      >
        <Knot size={15} />
        <span className="spec mis !tracking-[0.3em] text-abyss">RANGREZ</span>
      </Link>

      <nav className="no-scrollbar flex flex-1 items-stretch overflow-x-auto" aria-label="Rangrez">
        {NAV.map((item) => {
          const on = path.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={on ? "page" : undefined}
              className={`group relative flex shrink-0 items-center gap-2 border-r border-abyss/25 px-3.5 transition-colors duration-300 lg:px-5 ${
                on ? "bg-brass text-abyss" : "text-abyss/60 hover:bg-abyss/6 hover:text-abyss"
              }`}
            >
              <span className={`spec-sm ${on ? "opacity-70" : "opacity-45"}`}>
                {item.mark}
              </span>
              <span className="spec">{item.label}</span>
              {on && (
                <span
                  aria-hidden
                  className="absolute inset-x-0 bottom-0 h-[3px] bg-madder"
                />
              )}
            </Link>
          );
        })}
      </nav>

      <div className="hidden shrink-0 items-center gap-3 border-l-2 border-abyss px-3.5 lg:flex lg:px-5">
        <span className="text-right leading-tight">
          <span className="tight block text-[0.8rem] text-abyss">{name}</span>
          {note && <span className="spec-sm block text-abyss/50">{note}</span>}
        </span>
        <form action={signOut}>
          <button
            type="submit"
            className="spec-sm border border-abyss/35 px-2 py-1.5 text-abyss/60 transition-colors duration-300 hover:border-madder hover:bg-madder hover:text-leaf"
          >
            EXIT
          </button>
        </form>
      </div>
    </header>
  );
}
