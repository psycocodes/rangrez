"use client";


import { useMemo, useState } from "react";

import { signOut } from "@/app/actions/auth";
import { AddClothesProvider, useDock } from "./AddClothes";
import { Closet } from "./Closet";
import { GarmentPlate } from "./GarmentPlate";
import { Ground } from "./Ornament";
import { INK } from "@/lib/ornament";
import { tintOf } from "@/lib/tint";
import { ORIGIN_LABEL, type Avatar, type Garment } from "@/lib/types";

/**
 * The wardrobe, as a room.
 */
export function ClosetRoom({
  garments,
  name,
  note,
  avatars,
  activeAvatarId,
}: {
  garments: Garment[];
  name: string;
  note?: string;
  avatars: Avatar[];
  activeAvatarId?: string;
}) {
  return (
    <AddClothesProvider avatars={avatars} activeAvatarId={activeAvatarId}>
      <Room garments={garments} name={name} note={note} />
    </AddClothesProvider>
  );
}

function Room({
  garments,
  name,
  note,
}: {
  garments: Garment[];
  name: string;
  note?: string;
}) {
  const [tab, setTab] = useState<"bought" | "wishlist">("bought");
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState<Garment | null>(null);

  const shown = useMemo(() => {
    const owned = tab === "bought"
      ? garments.filter((g) => g.origin !== "shop")
      : garments.filter((g) => g.origin === "shop");

    const q = query.trim().toLowerCase();
    if (!q) return owned;

    return owned.filter((g) =>
      [g.name, g.dye.name, g.material, g.zone, g.sizeLabel, ORIGIN_LABEL[g.origin]]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(q),
    );
  }, [garments, tab, query]);

  return (
    <div
      className="page relative flex flex-col overflow-hidden text-abyss"
      style={{
        backgroundImage: "url('/assets/backgrounds/wardrobe-background.png')",
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundColor: "#EBE3D5",
      }}
    >
      {/* ── Neobrutalist Header with Search, Filter & Account Details ── */}
      <header className="relative z-20 flex shrink-0 flex-wrap items-center justify-between gap-3 border-b-[3px] border-[#12100d] bg-[#F4EFE6]/95 px-4 py-2.5 backdrop-blur-md lg:px-7">
        {/* Brand Badge */}
        <div className="flex items-center gap-2.5">
          <span className="border-2 border-[#12100d] bg-white px-2.5 py-1 text-[0.82rem] font-black tracking-[0.22em] uppercase text-[#12100d] shadow-[2px_2px_0px_#12100d]">
            RANGREZ
          </span>
          <span className="hidden font-mono text-[0.72rem] font-bold tracking-[0.14em] uppercase text-[#12100d]/60 sm:inline">
            WARDROBE
          </span>
        </div>

        {/* Search & Filter Controls */}
        <div className="flex min-w-0 flex-1 items-center justify-center gap-2.5 max-w-xl">
          <label className="relative min-w-0 flex-1">
            <span className="sr-only">Search your wardrobe</span>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="SEARCH PIECES, DYES, CUTS…"
              className="w-full border-2 border-[#12100d] bg-white px-3 py-1.5 font-mono text-[0.8rem] font-bold uppercase text-[#12100d] outline-none shadow-[2px_2px_0px_#12100d] transition-all placeholder:text-[#12100d]/35 focus:shadow-[3px_3px_0px_#12100d]"
            />
          </label>

          <div className="flex shrink-0 items-center gap-1.5">
            {(["bought", "wishlist"] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTab(t)}
                aria-pressed={tab === t}
                className={`border-2 border-[#12100d] px-3 py-1.5 text-[0.75rem] font-black tracking-wider uppercase shadow-[2px_2px_0px_#12100d] transition-all active:translate-x-[1px] active:translate-y-[1px] ${
                  tab === t
                    ? "bg-[#FFDE59] text-[#12100d]"
                    : "bg-white text-[#12100d]/65 hover:bg-[#FAF6EF] hover:text-[#12100d]"
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        {/* Account Details on Side of Filter */}
        <div className="flex shrink-0 items-center gap-2">
          <div className="flex items-center gap-2 border-2 border-[#12100d] bg-white px-2.5 py-1 shadow-[2px_2px_0px_#12100d]">
            <span className="text-[0.78rem] font-black tracking-wide uppercase text-[#12100d]">
              {name}
            </span>
            {note && (
              <span className="border border-[#12100d] bg-[#FFDE59] px-1.5 py-0.5 font-mono text-[0.62rem] font-bold text-[#12100d]">
                {note}
              </span>
            )}
          </div>
          <form action={signOut}>
            <button
              type="submit"
              className="border-2 border-[#12100d] bg-[#FF5A5F] px-2.5 py-1 text-[0.75rem] font-black uppercase text-white shadow-[2px_2px_0px_#12100d] transition-all hover:bg-[#FF3B42] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none"
            >
              EXIT
            </button>
          </form>
        </div>
      </header>

      {/* ── the cupboard ──────────────────────────────────────────────── */}
      {shown.length === 0 ? (
        <div className="flex min-h-0 flex-1 items-center justify-center px-6 text-center">
          <div>
            <p className="display text-[clamp(1.8rem,4vw,3rem)] text-abyss">
              {query ? (
                <>
                  Nothing matches <span className="aside">“{query}”.</span>
                </>
              ) : tab === "wishlist" ? (
                <>
                  Nothing on the <span className="aside">wishlist.</span>
                </>
              ) : (
                <>
                  The rail is <span className="aside">bare.</span>
                </>
              )}
            </p>
            <p className="mt-4 text-[0.9rem] text-abyss/60">
              {tab === "wishlist"
                ? "Pieces you try on from a shop page land here."
                : "Upload a few things and they will be hanging in seconds."}
            </p>
          </div>
        </div>
      ) : (
        <Closet garments={shown} onOpen={setOpen} />
      )}

      {/* ── Neobrutalist Floating + Action Button (Bottom-Right) ── */}
      <FloatingAddButton />

      {open && <Lightbox garment={open} onClose={() => setOpen(null)} />}
    </div>
  );
}

/** Neobrutalist Floating Action Button for adding/uploading clothes */
function FloatingAddButton() {
  const dock = useDock();
  if (!dock) return null;
  return (
    <button
      type="button"
      onClick={dock.open}
      aria-label="Hang new garment"
      className="fixed bottom-6 right-6 z-40 flex h-14 w-14 sm:h-16 sm:w-16 items-center justify-center rounded-2xl border-[3px] border-[#12100d] bg-[#FFDE59] text-[#12100d] shadow-[4px_4px_0px_#12100d] transition-all duration-200 hover:-translate-x-0.5 hover:-translate-y-0.5 hover:bg-[#FFE57F] hover:shadow-[6px_6px_0px_#12100d] active:translate-x-[3px] active:translate-y-[3px] active:shadow-[1px_1px_0px_#12100d] cursor-pointer"
    >
      <span className="text-3xl sm:text-4xl font-black leading-none select-none">+</span>
    </button>
  );
}

/**
 * One piece, held up to the light.
 *
 * Takes its whole palette from the garment, like the card does — so opening a
 * piece doesn't drop you into a grey modal, it fills the screen with that
 * garment's own colour.
 */
function Lightbox({
  garment,
  onClose,
}: {
  garment: Garment;
  onClose: () => void;
}) {
  const t = tintOf(garment.dye.hex);
  const worn = garment.tryOnUrl;

  return (
    <div
      role="dialog"
      aria-modal
      aria-label={garment.name}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-md lg:p-10"
      style={{ background: `${t.ink}e6` }}
      onClick={onClose}
    >
      <div
        className="relative flex max-h-full w-full max-w-4xl flex-col overflow-hidden lg:flex-row"
        style={{ background: t.card }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative aspect-square w-full lg:w-1/2">
          <GarmentPlate garment={garment} showName={false} />
        </div>

        <div className="flex min-w-0 flex-1 flex-col justify-between gap-6 p-6 lg:p-8">
          <div>
            <p className="spec-sm" style={{ color: t.edge }}>
              {ORIGIN_LABEL[garment.origin].toUpperCase()} · {garment.zone.toUpperCase()}
            </p>
            <h2
              className="display mt-3 text-[clamp(1.7rem,3.4vw,2.8rem)]"
              style={{ color: t.ink }}
            >
              {garment.name}
            </h2>
            <p className="mt-4 text-[0.9rem] leading-relaxed" style={{ color: t.ink }}>
              {garment.material}
            </p>

            <dl className="mt-6 grid grid-cols-2 gap-px" style={{ background: t.edge }}>
              {[
                ["Dye", garment.dye.name],
                ["Size", garment.sizeLabel ?? "—"],
                ["Cut", garment.fit?.cut ?? "—"],
                ["Worn", `${garment.wornCount}×`],
              ].map(([k, v]) => (
                <div key={k} className="px-3 py-2.5" style={{ background: t.card }}>
                  <dt className="spec-sm" style={{ color: t.edge }}>
                    {k.toUpperCase()}
                  </dt>
                  <dd className="tight mt-1.5 text-[0.9rem] capitalize" style={{ color: t.ink }}>
                    {v}
                  </dd>
                </div>
              ))}
            </dl>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {worn && (
              <span className="spec-sm px-2 py-1.5" style={{ background: t.ink, color: t.card }}>
                RENDERED ON YOU
              </span>
            )}
            <button
              type="button"
              onClick={onClose}
              className="spec ml-auto border px-3 py-2 transition-colors"
              style={{ borderColor: t.edge, color: t.ink }}
            >
              Close ×
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
