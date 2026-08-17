"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { signOut } from "@/app/actions/auth";
import { Knot } from "./Wordmark";
import { INK, phool } from "@/lib/ornament";

const NAV = [
  { href: "/wardrobe", label: "Dashboard", mark: "०१" },
  { href: "/avatar", label: "Avatars", mark: "०२" },
  { href: "/profile", label: "Profile", mark: "०३" },
  { href: "/connect", label: "Extension", mark: "०४" },
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
        href="/wardrobe"
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
