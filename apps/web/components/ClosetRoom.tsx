"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState, useEffect } from "react";
import { motion } from "framer-motion";

import { Navbar } from "./Navbar";
import { Closet } from "./Closet";
import { LookCreator } from "./LookCreator";
import { CommandSearch } from "./CommandSearch";
import { GarmentModal } from "./GarmentModal";
import { RoomTab } from "./RoomTab";
import { slotFor } from "@/lib/look";
import type { BaseModelStatus } from "@/lib/base-models-server";
import { ORIGIN_LABEL, type Garment, type User } from "@/lib/types";

type Room = "dashboard" | "wardrobe";

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
  const [view, setView] = useState<Room>("dashboard");
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

      {/* ── the two rooms, on one continuous sliding track ──────────────────────────────────── */}
      <div className="relative flex flex-1 min-h-0 overflow-hidden w-full h-full">
        <motion.div
          className="flex h-full w-full shrink-0"
          initial={false}
          animate={{ x: view === "dashboard" ? "0%" : "-100%" }}
          transition={{
            type: "spring",
            stiffness: 240,
            damping: 28,
            mass: 0.9,
          }}
        >
          {/* ── one · the dashboard, which is home ── */}
          <div
            className="relative flex h-full w-full min-h-0 shrink-0 flex-col overflow-hidden"
            {...({ inert: view === "dashboard" ? undefined : "" } as Record<string, string | undefined>)}
          >
            <LookCreator
              avatars={user.avatars}
              activeAvatarId={user.activeAvatarId}
              garments={wearableGarments}
              onBackToWardrobe={() => setView("wardrobe")}
              embedded
            />
          </div>

          {/* ── two · the wardrobe, which arrives from the right ── */}
          <div
            className="relative flex h-full w-full min-h-0 shrink-0 flex-col overflow-hidden"
            {...({ inert: view === "wardrobe" ? undefined : "" } as Record<string, string | undefined>)}
          >
            {shown.length === 0 ? (
              <div className="flex min-h-0 flex-1 items-center justify-center px-6 text-center">
                <div>
                  <p className="display text-[clamp(1.8rem,4vw,3rem)] text-abyss">
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
                  </p>

                  {/* Description */}
                  <p className="font-mono text-xs sm:text-sm font-bold uppercase text-[#12100d]/70 max-w-md mx-auto leading-relaxed mt-4">
                    {tab === "wishlist"
                      ? "Save garments while browsing Zara, H&M or Myntra using the extension."
                      : "Import from product URLs or drop images to hang your clothes on the rail in seconds."}
                  </p>

                  {/* CTA Button */}
                  <div className="pt-4">
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

            {/* Back the way you came — the dashboard is off to the left. */}
            <RoomTab
              side="left"
              tone="madder"
              label="Dashboard"
              title="Slide back to the dashboard"
              onClick={() => setView("dashboard")}
            />

            {/* ── add or import a garment ── */}
            <Link
              href="/add-garment"
              aria-label="Add or import garment"
              className="absolute bottom-6 right-6 z-40 flex h-14 w-14 sm:h-16 sm:w-16 items-center justify-center rounded-2xl border-[3px] border-[#12100d] bg-[#FFDE59] text-[#12100d] shadow-[4px_4px_0px_#12100d] transition-all duration-200 hover:-translate-x-0.5 hover:-translate-y-0.5 hover:bg-[#FFE57F] hover:shadow-[6px_6px_0px_#12100d] active:translate-x-[3px] active:translate-y-[3px] active:shadow-[1px_1px_0px_#12100d] cursor-pointer"
            >
              <span className="text-3xl sm:text-4xl font-black leading-none select-none">+</span>
            </Link>
          </div>
        </motion.div>
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
