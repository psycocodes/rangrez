"use client";

import Image from "next/image";
import Link from "next/link";
import { useState, useTransition } from "react";

import { deleteAvatar, setActiveAvatar } from "@/app/actions/avatars";
import { PlateCustomiser } from "./PlateCustomiser";
import { MAX_AVATARS, type Avatar } from "@/lib/types";

/**
 * The shelf of plates.
 *
 * Two different ideas live here and the design's whole job is to keep them
 * apart: which plate you are *looking at* (local, cheap, reversible) and which
 * plate is *in use* (stored, affects every render in the product). Selecting
 * is a click on the thumbnail; putting one to use is a labelled button that
 * only appears when it would do something.
 */
export function AvatarShelf({
  avatars,
  activeId,
}: {
  avatars: Avatar[];
  activeId?: string;
}) {
  const [openId, setOpenId] = useState(activeId ?? avatars[0]?.id);
  const [pending, start] = useTransition();

  const open = avatars.find((a) => a.id === openId) ?? avatars[0];
  const room = MAX_AVATARS - avatars.length;

  const act = (fn: (data: FormData) => Promise<void>, id: string) => {
    const data = new FormData();
    data.set("id", id);
    start(() => void fn(data));
  };

  return (
    <div>
      {/* ── the shelf ──────────────────────────────────────────────────── */}
      <div className="mb-3 flex items-baseline justify-between gap-4">
        <span className="spec-sm text-ink-3">
          {avatars.length} OF {MAX_AVATARS} PLATES
        </span>
        <span className="spec-sm text-ink-3">
          {room > 0 ? `ROOM FOR ${room} MORE` : "SHELF FULL"}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-px bg-ink/15 sm:grid-cols-4">
        {avatars.map((a) => {
          const isActive = a.id === activeId;
          const isOpen = a.id === open?.id;
          return (
            <div key={a.id} className="bg-paper p-2.5">
              <button
                type="button"
                onClick={() => setOpenId(a.id)}
                aria-pressed={isOpen}
                className="group block w-full text-left"
              >
                <div
                  className={`relative aspect-[3/4] w-full overflow-hidden border transition-colors duration-300 ${
                    isOpen ? "border-ink" : "border-transparent hover:border-ink/30"
                  }`}
                >
                  <Image
                    src={a.renderUrl}
                    alt={a.customization.label}
                    fill
                    sizes="(max-width: 640px) 45vw, 180px"
                    className={`object-cover transition-opacity duration-500 ${
                      isActive ? "opacity-100" : "opacity-70 group-hover:opacity-100"
                    }`}
                  />
                  {isActive && (
                    <span className="spec-sm absolute left-0 top-0 bg-turmeric px-1.5 py-1 text-ink">
                      IN USE
                    </span>
                  )}
                </div>
                <p className="tight mt-2 truncate text-[0.85rem]">
                  {a.customization.label}
                </p>
                <p className="spec-sm mt-1 truncate text-ink-3">
                  {a.colorSeason?.name ?? "UNANALYSED"}
                </p>
              </button>

              {/* The one action worth putting on the thumbnail itself. The
                  rest live under the plate you have open, where there is room
                  to say what they do. */}
              {!isActive && (
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => act(setActiveAvatar, a.id)}
                  className="spec-sm mt-2 w-full border border-ink/25 py-1.5 text-ink-3 transition-colors duration-300 hover:border-ink hover:bg-ink hover:text-paper disabled:opacity-40"
                >
                  USE THIS
                </button>
              )}
            </div>
          );
        })}

        {room > 0 && (
          <Link
            href="/atelier"
            className="group flex flex-col bg-paper p-2.5"
            aria-label="Shoot another plate"
          >
            <div className="relative flex aspect-[3/4] w-full flex-col items-center justify-center gap-3 border border-dashed border-ink/30 bg-paper-2 transition-colors duration-300 group-hover:border-ink group-hover:bg-paper-3">
              <span aria-hidden className="display text-[2rem] leading-none text-ink-3">
                +
              </span>
              <span className="spec-sm text-ink-3">SHOOT ANOTHER</span>
            </div>
            <p className="tight mt-2 text-[0.85rem]">
              Plate {String(avatars.length + 1).padStart(2, "0")}
            </p>
            <p className="spec-sm mt-1 text-ink-3">EMPTY</p>
          </Link>
        )}
      </div>

      <p className="mt-4 max-w-[62ch] text-[0.82rem] leading-relaxed text-ink-3">
        Keep up to {MAX_AVATARS}: a studio plate, a full length, one in the light
        you actually dress in. The plate <b className="text-ink">in use</b> is
        what the wardrobe renders against and what the browser extension reaches
        for — and when you hold more than one, the extension asks which before it
        renders.
      </p>

      {/* ── the plate you have open ────────────────────────────────────── */}
      {open && (
        <div className="mt-9 border-t border-ink/15 pt-8">
          <div className="mb-6 flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
            <div className="flex items-baseline gap-3">
              <span className="spec text-madder">EDITING</span>
              <span className="display text-[1.5rem] leading-none">
                {open.customization.label}
              </span>
              {open.id === activeId && (
                <span className="spec-sm bg-turmeric px-1.5 py-1 text-ink">IN USE</span>
              )}
            </div>

            <div className="flex flex-wrap gap-2">
              {open.id !== activeId && (
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => act(setActiveAvatar, open.id)}
                  className="btn btn-ghost disabled:opacity-40"
                >
                  <span className="spec">Make this my avatar</span>
                  <span aria-hidden className="spec">→</span>
                </button>
              )}
              <Link href={`/atelier?replace=${open.id}`} className="btn btn-ghost">
                <span className="spec">Re-shoot</span>
                <span aria-hidden className="spec">↺</span>
              </Link>
              {avatars.length > 1 && (
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => {
                    if (
                      confirm(
                        `Retire "${open.customization.label}"? Garments already rendered against it keep their photographs.`,
                      )
                    ) {
                      act(deleteAvatar, open.id);
                    }
                  }}
                  className="btn btn-ghost !border-madder !text-madder disabled:opacity-40"
                >
                  <span className="spec">Retire</span>
                  <span aria-hidden className="spec">×</span>
                </button>
              )}
            </div>
          </div>

          {/* Keyed so switching plates resets the customiser's draft state
              instead of carrying the previous plate's unsaved crop across. */}
          <PlateCustomiser key={open.id} avatar={open} />
        </div>
      )}
    </div>
  );
}
