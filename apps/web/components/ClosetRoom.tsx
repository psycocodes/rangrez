"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState, useTransition, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

import { Navbar } from "./Navbar";
import { Closet } from "./Closet";
import { GarmentPlate } from "./GarmentPlate";
import { LookCreator } from "./LookCreator";
import { CommandSearch } from "./CommandSearch";
import { GarmentModal } from "./GarmentModal";
import { slotFor } from "@/lib/look";
import type { BaseModelStatus } from "@/lib/base-models-server";
import { ORIGIN_LABEL, type Avatar, type Garment, type User } from "@/lib/types";

/**
 * The wardrobe and trial room, unified with sliding window transitions and floating navbar.
 */
export function ClosetRoom({
  garments,
  user,
  baseModels = [],
  token,
  apiBase,
}: {
  garments: Garment[];
  user: User;
  baseModels?: BaseModelStatus[];
  token?: string;
  apiBase?: string;
}) {
  const [view, setView] = useState<"wardrobe" | "trial">("wardrobe");
  const [tab, setTab] = useState<"bought" | "wishlist">("bought");
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState<Garment | null>(null);
  const [searchModalOpen, setSearchModalOpen] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        setSearchModalOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const wearableGarments = useMemo(
    () => garments.filter((g) => slotFor(g) !== null),
    [garments],
  );

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
      {/* ── Unified Floating Navbar ── */}
      <Navbar
        user={user}
        token={token}
        apiBase={apiBase}
        showSearch={view === "wardrobe"}
        onSearchClick={() => setSearchModalOpen(true)}
        tab={tab}
        onTabChange={setTab}
      />

      {/* ── Seamless Sliding Viewport Between Wardrobe and Trial Room ── */}
      <div className="relative flex flex-1 min-h-0 overflow-hidden">
        <AnimatePresence mode="wait" initial={false}>
          {view === "wardrobe" ? (
            <motion.div
              key="wardrobe"
              className="relative flex min-h-0 flex-1 flex-col overflow-hidden w-full h-full"
              initial={{ x: "-100%", opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: "-100%", opacity: 0 }}
              transition={{ type: "spring", stiffness: 280, damping: 28 }}
            >
              {/* Cupboard Contents */}
              {shown.length === 0 ? (
                <div className="flex min-h-0 flex-1 flex-col items-center justify-center px-6 text-center select-none">
                  <div className="max-w-xl mx-auto space-y-4">
                    {/* Badge */}
                    <div className="inline-flex items-center gap-2 border-2 border-[#12100d] bg-[#12100d] px-3.5 py-1 text-white shadow-[2px_2px_0px_#FFDE59]">
                      <span className="font-mono text-xs font-black uppercase tracking-wider">
                        {query ? "NO MATCHES FOUND" : tab === "wishlist" ? "WISHLIST EMPTY" : "WARDROBE IS BARE"}
                      </span>
                    </div>

                    {/* Headline */}
                    <h2 className="font-friday text-4xl sm:text-6xl text-[#12100d] uppercase tracking-wide leading-tight">
                      {query ? (
                        <>
                          NOTHING MATCHES{" "}
                          <span className="bg-[#FFDE59] px-2 text-[#12100d]">“{query}”</span>
                        </>
                      ) : tab === "wishlist" ? (
                        <>
                          NOTHING ON THE{" "}
                          <span className="bg-[#FFDE59] px-2 text-[#12100d]">WISHLIST.</span>
                        </>
                      ) : (
                        <>
                          THE CLOSET RAIL IS{" "}
                          <span className="bg-[#FFDE59] px-2 text-[#12100d]">EMPTY.</span>
                        </>
                      )}
                    </h2>

                    {/* Description */}
                    <p className="font-mono text-xs sm:text-sm font-bold uppercase text-[#12100d]/70 max-w-md mx-auto leading-relaxed">
                      {tab === "wishlist"
                        ? "Save garments while browsing Zara, H&M or Myntra using the extension."
                        : "Import from product URLs or drop images to hang your clothes on the rail in seconds."}
                    </p>

                    {/* CTA Button */}
                    <div className="pt-2">
                      <Link
                        href="/add-garment"
                        className="inline-flex items-center gap-2.5 rounded-2xl border-[3px] border-[#12100d] bg-[#FFDE59] px-7 py-3.5 font-friday text-sm uppercase tracking-wider text-[#12100d] shadow-[5px_5px_0px_#12100d] hover:bg-[#FFE57F] hover:shadow-[7px_7px_0px_#12100d] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all cursor-pointer"
                      >
                        <span>ADD FIRST GARMENT →</span>
                      </Link>
                    </div>
                  </div>
                </div>
              ) : (
                <Closet garments={shown} onOpen={setOpen} />
              )}

              {/* ── Floating Left-Side Sliding Handle: Slide into Trial Room ──────── */}
              <button
                type="button"
                onClick={() => setView("trial")}
                aria-label="Slide to Trial Room"
                className="fixed left-0 top-1/2 -translate-y-1/2 z-40 flex flex-col items-center gap-2 rounded-r-2xl border-y-[3px] border-r-[3px] border-[#12100d] bg-[#FF5A5F] px-2.5 py-4 text-white shadow-[4px_4px_0px_#12100d] transition-all duration-200 hover:bg-[#FF3B42] hover:translate-x-[3px] cursor-pointer select-none"
              >
                <span className="text-sm font-black">⚡</span>
                <span
                  className="font-black text-[0.68rem] tracking-widest uppercase"
                  style={{ writingMode: "vertical-rl", textOrientation: "mixed" }}
                >
                  TRIAL ROOM
                </span>
                <span className="font-mono text-[0.62rem] font-bold">▶</span>
              </button>

              {/* ── Neobrutalist Floating + Action Button (Bottom-Right) -> Links to /add-garment ── */}
              <Link
                href="/add-garment"
                aria-label="Add or import garment"
                className="fixed bottom-6 right-6 z-40 flex h-14 w-14 sm:h-16 sm:w-16 items-center justify-center rounded-2xl border-[3px] border-[#12100d] bg-[#FFDE59] text-[#12100d] shadow-[4px_4px_0px_#12100d] transition-all duration-200 hover:-translate-x-0.5 hover:-translate-y-0.5 hover:bg-[#FFE57F] hover:shadow-[6px_6px_0px_#12100d] active:translate-x-[3px] active:translate-y-[3px] active:shadow-[1px_1px_0px_#12100d] cursor-pointer"
              >
                <span className="text-3xl sm:text-4xl font-black leading-none select-none">+</span>
              </Link>
            </motion.div>
          ) : (
            <motion.div
              key="trial"
              className="relative flex min-h-0 flex-1 flex-col overflow-hidden w-full h-full"
              initial={{ x: "100%", opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: "100%", opacity: 0 }}
              transition={{ type: "spring", stiffness: 280, damping: 28 }}
            >
              <LookCreator
                avatars={user.avatars}
                activeAvatarId={user.activeAvatarId}
                garments={wearableGarments}
                onBackToWardrobe={() => setView("wardrobe")}
                embedded
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <CommandSearch
        isOpen={searchModalOpen}
        onClose={() => setSearchModalOpen(false)}
        garments={garments}
        onSelect={(g) => setOpen(g)}
      />

      {open && (
        <GarmentModal
          garment={open}
          avatars={user.avatars}
          activeAvatarId={user.activeAvatarId}
          onClose={() => setOpen(null)}
        />
      )}
    </div>
  );
}
