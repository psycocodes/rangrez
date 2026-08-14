"use client";

import Image from "next/image";
import { useTransition } from "react";

import { setActiveAvatar } from "@/app/actions/avatars";
import type { Avatar } from "@/lib/types";

/**
 * Switching bodies without leaving the wardrobe.
 *
 * Deliberately not a dropdown: with at most three plates, showing all of them
 * as thumbnails costs one row and removes a click. Nothing here is a
 * destructive action, so nothing here asks for confirmation — but it does
 * re-rank the wardrobe against the new plate's colour season, which is why it
 * runs through a transition and says so while it works.
 */
export function PlateSwitcher({
  avatars,
  activeId,
}: {
  avatars: Avatar[];
  activeId?: string;
}) {
  const [pending, start] = useTransition();

  if (avatars.length < 2) return null;

  return (
    <div className="rule mt-5 pt-3.5">
      <div className="mb-2.5 flex items-baseline justify-between gap-3">
        <span className="spec-sm text-ink-3">SWITCH BODY</span>
        <span className="spec-sm text-ink-3">
          {pending ? "RE-RANKING…" : `${avatars.length} PLATES`}
        </span>
      </div>

      <div className="flex gap-1.5">
        {avatars.map((a) => {
          const on = a.id === activeId;
          return (
            <button
              key={a.id}
              type="button"
              disabled={pending || on}
              aria-pressed={on}
              title={a.customization.label}
              onClick={() => {
                const data = new FormData();
                data.set("id", a.id);
                start(() => void setActiveAvatar(data));
              }}
              className="group min-w-0 flex-1 text-left disabled:cursor-default"
            >
              <span
                className={`relative block aspect-[3/4] w-full overflow-hidden border transition-colors duration-300 ${
                  on
                    ? "border-ink"
                    : "border-ink/20 group-hover:border-ink/60"
                }`}
              >
                <Image
                  src={a.renderUrl}
                  alt=""
                  fill
                  sizes="80px"
                  className={`object-cover transition-all duration-500 ${
                    on
                      ? "opacity-100"
                      : "opacity-55 grayscale group-hover:opacity-85 group-hover:grayscale-0"
                  }`}
                />
                {on && (
                  <span className="absolute inset-x-0 top-0 h-[3px] bg-madder" />
                )}
              </span>
              <span
                className={`spec-sm mt-1.5 block truncate ${
                  on ? "text-ink" : "text-ink-3"
                }`}
              >
                {a.customization.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
