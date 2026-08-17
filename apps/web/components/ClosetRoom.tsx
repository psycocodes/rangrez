"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState, useEffect } from "react";

import { Navbar } from "./Navbar";
import { Closet } from "./Closet";
import { LookCreator } from "./LookCreator";
import { CommandSearch } from "./CommandSearch";
import { GarmentModal } from "./GarmentModal";
import { RoomTab } from "./RoomTab";
import { slotFor } from "@/lib/look";
import type { BaseModelStatus } from "@/lib/base-models-server";
import { ORIGIN_LABEL, type Avatar, type Garment, type User } from "@/lib/types";

/**
 * The dashboard and the wardrobe, as two halves of one sliding surface.
 *
 * ── how the slide works, and why not AnimatePresence ─────────────────────
 *
 * This used to swap the two rooms through `<AnimatePresence mode="wait">`.
 * That mode does what it says: it runs the outgoing room's exit to completion
 * and only *then* mounts the incoming one. So the sequence was room one slides
 * away, an empty background is held for a beat, room two slides in — two
 * animations with a gap between them, which is why it never felt like a slide.
 * Both rooms also cross-faded, and a room fading out over a background it
 * matches reads as a flicker rather than as movement.
 *
 * They are now on one track and the track is what moves. Neither room
 * animates; they are both simply *on* the thing sliding, which is what makes
 * it read as one surface with two rooms on it rather than two pictures being
 * swapped. It is a single compositor-only transform, so it holds its frame
 * rate with the whole closet and the look creator mounted at once.
 *
 * ── which way round ──────────────────────────────────────────────────────
 *
 * The dashboard is home. It is pane one, it is what the surface opens on, and
 * the wardrobe arrives from the right when you ask for it. The wardrobe used
 * to be first, which put the dashboard offstage to the right at rest and made
 * the default view the cupboard rather than the thing you came to do.
 */

/**
 * The two rooms, in the order they sit on the track.
 *
 * "dashboard" is first because it is home: the surface opens on it, and the
 * wardrobe is the place you go from there. Reversing these reverses the slide.
 */
type Room = "dashboard" | "wardrobe";

/** Long enough to read as travel between two rooms, short enough to repeat. */
const SLIDE_MS = 560;

/** Out fast, settle soft. No overshoot — these are walls, not cloth. */
const SLIDE_EASE = "cubic-bezier(0.62, 0.02, 0.2, 1)";
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

  /**
   * Whether the wardrobe's rails exist in the DOM yet.
   *
   * The dashboard is home, so it is mounted from the first paint and never
   * deferred. The wardrobe is the room you travel to, and it has to be there
   * *before* the slide starts or the first transition pays for rendering every
   * garment card at once. So it mounts on idle, well ahead of any click, and
   * never unmounts. A click that beats idle mounts it on the spot — the
   * browser had simply not got round to it, not refused.
   */
  const [wardrobeReady, setWardrobeReady] = useState(false);
  useEffect(() => {
    if (wardrobeReady) return;
    const w = window as typeof window & {
      requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number;
      cancelIdleCallback?: (id: number) => void;
    };
    if (!w.requestIdleCallback) {
      const t = setTimeout(() => setWardrobeReady(true), 900);
      return () => clearTimeout(t);
    }
    const id = w.requestIdleCallback(() => setWardrobeReady(true), { timeout: 3000 });
    return () => w.cancelIdleCallback?.(id);
  }, [wardrobeReady]);

  /* Whether the track is mid-travel. Set from the click and cleared from the
     transition's own end event — never from an effect, so there is no timer
     racing the animation and no second render just to say "still moving". */
  const [sliding, setSliding] = useState(false);

  const go = (next: Room) => {
    if (next === "wardrobe") setWardrobeReady(true);
    if (next !== view) setSliding(true);
    setView(next);
  };

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

      {/* ── the two rooms, on one track ──────────────────────────────────── */}
      <div className="relative flex flex-1 min-h-0 overflow-hidden">
        <div
          /* `w-full` with panes that refuse to shrink, *not* `w-200%`. This
             is a flex item, so a width wider than its container is simply
             shrunk back to fit — a 200%-wide track measured 100% wide and
             gave each pane half the viewport. The panes overflow instead, and
             the parent clips them. */
          className="flex h-full w-full motion-reduce:transition-none"
          style={{
            // translate3d, not left/margin: this is the only property here the
            // compositor can animate without laying anything out again. -100%
            // is the track's own width, which is exactly one pane.
            transform: view === "dashboard" ? "translate3d(0,0,0)" : "translate3d(-100%,0,0)",
            transition: `transform ${SLIDE_MS}ms ${SLIDE_EASE}`,
          }}
          onTransitionEnd={(e) => {
            // Only the track's own transform, not a button's hover bubbling up.
            if (e.target === e.currentTarget && e.propertyName === "transform") {
              setSliding(false);
            }
          }}
        >
          {/* ── one · the dashboard, which is home ── */}
          <Pane show={view === "dashboard"} sliding={sliding}>
            <LookCreator
              avatars={user.avatars}
              activeAvatarId={user.activeAvatarId}
              garments={wearableGarments}
              onBackToWardrobe={() => go("wardrobe")}
              embedded
            />
          </Pane>

          {/* ── two · the wardrobe, which arrives from the right ── */}
          <Pane show={view === "wardrobe"} sliding={sliding}>
            {wardrobeReady &&
              (shown.length === 0 ? (
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
              ))}

            {/* Back the way you came — the dashboard is off to the left. */}
            <RoomTab
              side="left"
              tone="madder"
              label="Dashboard"
              title="Slide back to the dashboard"
              onClick={() => go("dashboard")}
            />

            {/* ── add or import a garment ── */}
            <Link
              href="/add-garment"
              aria-label="Add or import garment"
              className="absolute bottom-6 right-6 z-40 flex h-14 w-14 sm:h-16 sm:w-16 items-center justify-center rounded-2xl border-[3px] border-[#12100d] bg-[#FFDE59] text-[#12100d] shadow-[4px_4px_0px_#12100d] transition-all duration-200 hover:-translate-x-0.5 hover:-translate-y-0.5 hover:bg-[#FFE57F] hover:shadow-[6px_6px_0px_#12100d] active:translate-x-[3px] active:translate-y-[3px] active:shadow-[1px_1px_0px_#12100d] cursor-pointer"
            >
              <span className="text-3xl sm:text-4xl font-black leading-none select-none">+</span>
            </Link>
          </Pane>
        </div>
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

/**
 * One room on the track.
 *
 * `relative` is load-bearing: the pull tab and the add button inside are
 * positioned against this, and they must travel with their own room rather
 * than against the viewport. See RoomTab for why they stopped being `fixed`.
 *
 * The room you cannot see is made genuinely absent rather than merely
 * offscreen — `inert` takes it out of the tab order and off the accessibility
 * tree, which is what stops a Tab press from scrolling the track sideways to
 * chase a focused control in the other room. `content-visibility` is only
 * applied once the slide has finished, because a pane that skips rendering is
 * a pane that pops when it comes back.
 */
function Pane({
  show,
  sliding,
  children,
}: {
  show: boolean;
  sliding: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      className="relative flex h-full w-full min-h-0 shrink-0 flex-col overflow-hidden"
      // `inert` is a real attribute in React 19; the cast keeps older DOM
      // typings from rejecting it.
      {...({ inert: show ? undefined : "" } as Record<string, string | undefined>)}
      style={{ contentVisibility: !show && !sliding ? "hidden" : "visible" }}
    >
      {children}
    </div>
  );
}
