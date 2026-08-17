"use client";

import {
  motion,
  useMotionValue,
  useSpring,
  useTransform,
  AnimatePresence,
  type MotionValue,
} from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";

import { GarmentPlate, Hanger } from "./GarmentPlate";
import { GarmentFlip } from "./GarmentFlip";
import { Ground } from "./Ornament";
import { INK } from "@/lib/ornament";
import type { Garment, Zone } from "@/lib/types";

/**
 * ═══════════════════════════════════════════════════════════════════════════
 *  The closet
 * ═══════════════════════════════════════════════════════════════════════════
 *
 *  Not a grid of clothes. A cupboard: a brass rod, garments hanging off it on
 *  hooks, and a shelf underneath for shoes. One viewport, no page scroll —
 *  the racks scroll sideways, the way you actually push coats along a rail.
 *
 *  ── on the physics ───────────────────────────────────────────────────────
 *
 *  Two motions, and keeping them separate is the whole trick:
 *
 *    the rail scrolls   native `overflow-x`, so momentum is the operating
 *                       system's own — better than anything reimplemented,
 *                       and it brings keyboard, trackpad and touch with it
 *
 *    the garment swings a pendulum about its hook. Two forces feed it: the
 *                       rail's velocity (shove the rack, everything on it
 *                       lags and tilts) and your own drag (grab a shirt, pull
 *                       it, let go, it swings back and settles)
 *
 *  Doing the scroll with a drag handler instead would have meant nesting a
 *  draggable card inside a draggable rail, where the child always wins — so
 *  either the cards stop being grabbable or the rack stops scrolling. Native
 *  scroll for the rail and drag for the card is what lets both be true.
 *
 *  The spring is deliberately underdamped. Cloth on a hook overshoots before
 *  it settles; a critically-damped return reads as an animation, and this
 *  should read as weight.
 * ═══════════════════════════════════════════════════════════════════════════
 */

/** How far a garment may be pulled off the hook before it resists. */
const PULL = 70;
/** Degrees of tilt at full rail velocity. */
const MAX_SWING = 20;
/** Rail velocity that counts as "full" (px/s). */
const FULL_TILT_VELOCITY = 1800;

// High-fidelity spring for pure hanger hook pendulum oscillation
const PENDULUM_SPRING = { stiffness: 95, damping: 10, mass: 0.85 } as const;
const TILT_SPRING = { stiffness: 220, damping: 28, mass: 0.8 } as const;

/**
 * Everything that makes a row of clothes push sideways.
 *
 * One hook because there are two such rows — the hanging rails and the shoe
 * drawer — and they had drifted apart. The drawer had the wheel conversion but
 * none of the dragging, so a rail could be shoved along with the pointer and
 * the drawer could not; it simply sat there while the rails moved, which is
 * exactly what it looked like from the outside.
 *
 * `overflow-y` is pinned to hidden on purpose. A box with `overflow-x: auto`
 * and `overflow-y: visible` does not stay visible — CSS computes the visible
 * axis to `auto` as well, so the drawer was quietly scrollable up and down and
 * ate part of the gesture meant for sideways.
 */
function useRailScroll() {
  const ref = useRef<HTMLDivElement>(null);
  const drag = useRef({ active: false, from: 0, at: 0 });

  /** A plain mouse has no horizontal axis; lend it the vertical one. */
  const onWheel = useCallback((e: React.WheelEvent) => {
    const node = ref.current;
    if (!node) return;
    // A trackpad swiping sideways already says what it means — leave it to the
    // browser, whose momentum is better than anything reimplemented here.
    if (Math.abs(e.deltaX) >= Math.abs(e.deltaY)) return;
    node.scrollLeft += e.deltaY * 0.9;
  }, []);

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    // A card is a thing you pull off the rail, not a handle for the rail.
    if ((e.target as HTMLElement).closest('[role="listitem"],[data-shelf-item]')) return;
    const node = ref.current;
    if (!node) return;
    drag.current = { active: true, from: e.clientX, at: node.scrollLeft };
  }, []);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    const node = ref.current;
    if (!drag.current.active || !node) return;
    node.scrollLeft = drag.current.at - (e.clientX - drag.current.from);
  }, []);

  const onPointerUp = useCallback(() => {
    drag.current.active = false;
  }, []);

  const nudge = useCallback((dir: 1 | -1, by = 280) => {
    ref.current?.scrollBy({ left: dir * by, behavior: "smooth" });
  }, []);

  return { ref, nudge, handlers: { onWheel, onPointerDown, onPointerMove, onPointerUp } };
}

export interface Rack {
  id: string;
  label: string;
  zones: Zone[];
}

/** Torso above, bottoms below — equal vertical halves. */
export const RACKS: Rack[] = [
  { id: "torso", label: "Tops & layers", zones: ["top", "outerwear"] },
  { id: "bottom", label: "Bottoms", zones: ["bottom"] },
];

export function Closet({
  garments,
  onOpen,
}: {
  garments: Garment[];
  onOpen?: (garment: Garment) => void;
}) {
  const [shelfOpen, setShelfOpen] = useState(false);

  const shoes = garments.filter((g) => g.zone === "shoes");
  const spare = garments.filter((g) => g.zone === "accessory");

  return (
    <div className="relative flex min-h-0 flex-1 flex-col select-none">
      {RACKS.map((rack) => {
        const items = garments.filter((g) => rack.zones.includes(g.zone));
        return (
          <Rail
            key={rack.id}
            rack={rack}
            garments={items}
            onOpen={onOpen}
            // Equal 50/50 vertical distribution for top and bottom racks
            grow={1}
          />
        );
      })}

      {/* ── the shoe shelf ─────────────────────────────────────────────── */}
      <ShelfHandle
        open={shelfOpen}
        count={shoes.length + spare.length}
        onToggle={() => setShelfOpen((s) => !s)}
      />
      <AnimatePresence>
        {shelfOpen && (
          <Shelf
            garments={[...shoes, ...spare]}
            onOpen={onOpen}
            onClose={() => setShelfOpen(false)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

/* ── one rack ────────────────────────────────────────────────────────────── */

function Rail({
  rack,
  garments,
  grow,
  onOpen,
}: {
  rack: Rack;
  garments: Garment[];
  grow: number;
  onOpen?: (garment: Garment) => void;
}) {
  const { ref: scroller, nudge, handlers } = useRailScroll();
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  /**
   * Rail velocity, in px/s, as a motion value the hanging cards read.
   */
  const velocity = useMotionValue(0);
  const swing = useSpring(velocity, PENDULUM_SPRING);
  const last = useRef({ x: 0, t: 0 });
  const settle = useRef<ReturnType<typeof setTimeout> | null>(null);

  const onScroll = useCallback(() => {
    const node = scroller.current;
    if (!node) return;
    const now = performance.now();
    const dt = now - last.current.t;
    // Under ~8ms the numerator is noise and the quotient explodes.
    if (dt > 8) {
      const dx = node.scrollLeft - last.current.x;
      velocity.set(Math.max(-1, Math.min(1, (dx / dt) * 1000 / FULL_TILT_VELOCITY)));
      last.current = { x: node.scrollLeft, t: now };
    }
    // Settle back to upright
    if (settle.current) clearTimeout(settle.current);
    settle.current = setTimeout(() => velocity.set(0), 80);
  }, [velocity]);

  useEffect(() => {
    return () => {
      if (settle.current) clearTimeout(settle.current);
    };
  }, []);

  const [isShortRack, setIsShortRack] = useState(false);

  useEffect(() => {
    if (!scroller.current) return;
    const updateSize = () => {
      if (scroller.current) {
        // Only switch to short horizontal card when rack is genuinely squished (< 220px)
        setIsShortRack(scroller.current.clientHeight < 220);
      }
    };
    updateSize();
    const ro = new ResizeObserver(updateSize);
    ro.observe(scroller.current);
    return () => ro.disconnect();
  }, []);

  const hoveredIndex = garments.findIndex((g) => g.id === hoveredId);

  return (
    <section
      className="relative flex min-h-0 flex-col border-b border-abyss/12"
      style={{ flex: `${grow} 1 0%` }}
      aria-label={rack.label}
    >
      {/* ── the rail with continuous rod ── */}
      <div className="relative min-h-0 flex-1 overflow-hidden">
        {/* Continuous Neobrutalist brass rod running across the rail */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-[6px] z-[1] h-[9px] border-y-[2.5px] border-[#12100d] bg-[#FFDE59] shadow-[0px_3px_0px_#12100d]"
        />

        {garments.length === 0 ? (
          <p className="aside flex h-full items-center justify-center text-[1.1rem] text-abyss/35">
            This rail is empty.
          </p>
        ) : (
          <>
            <div
              ref={scroller}
              onScroll={onScroll}
              {...handlers}
              onPointerLeave={() => {
                handlers.onPointerUp();
                setHoveredId(null);
              }}
              tabIndex={0}
              role="list"
              aria-label={`${rack.label} rail`}
              className="no-scrollbar relative z-[10] flex h-full items-start overflow-x-auto overflow-y-hidden px-6 pt-0 focus-visible:outline-none lg:px-10"
              style={{
                scrollbarWidth: "none",
                scrollSnapType: "x proximity",
                scrollPaddingLeft: "2.5rem",
                scrollPaddingRight: "2.5rem",
                perspective: 1200,
                transformStyle: "preserve-3d",
              }}
            >
              {garments.map((g, i) => (
                <Hanging
                  key={g.id}
                  garment={g}
                  swing={swing}
                  index={i}
                  isHovered={hoveredId === g.id}
                  isAnyHovered={hoveredId !== null}
                  relativeIndex={hoveredIndex !== -1 ? i - hoveredIndex : 0}
                  isShort={isShortRack}
                  onHover={(h) => setHoveredId(h ? g.id : null)}
                  onOpen={onOpen}
                />
              ))}
              {/* Spacer at the end */}
              <span aria-hidden className="block w-[24vw] shrink-0" />
            </div>

            <RailArrow side="left" onClick={() => nudge(-1)} />
            <RailArrow side="right" onClick={() => nudge(1)} />
          </>
        )}
      </div>
    </section>
  );
}

/* ── one garment, hanging ────────────────────────────────────────────────── */

function Hanging({
  garment,
  swing,
  index,
  isHovered,
  isAnyHovered,
  relativeIndex,
  isShort = false,
  onHover,
  onOpen,
}: {
  garment: Garment;
  /** Rail velocity, normalised to −1…1. */
  swing: MotionValue<number>;
  index: number;
  isHovered: boolean;
  isAnyHovered: boolean;
  relativeIndex: number;
  isShort?: boolean;
  onHover: (hovered: boolean) => void;
  onOpen?: (garment: Garment) => void;
}) {
  const x = useMotionValue(0);
  const releaseTorque = useMotionValue(0);

  // Pure pendulum sway around the hanger hook fulcrum (50% 6px):
  const pull = useTransform(x, [-PULL, PULL], [-18, 18]);
  const drift = useTransform(swing, (v) => -v * MAX_SWING);
  const rawZ = useTransform(
    [pull, drift, releaseTorque],
    ([p, d, r]) => (p as number) + (d as number) + (r as number),
  );
  const settledRotateZ = useSpring(rawZ, PENDULUM_SPRING);

  // Reversed Hanger Tilt Angle (Negative / inward tilt):
  const targetHangerAngle = isHovered
    ? 0
    : isAnyHovered
      ? relativeIndex < 0
        ? -32
        : -20
      : -26;

  const handleDragEnd = (
    _event: MouseEvent | TouchEvent | PointerEvent,
    info: { velocity: { x: number; y: number } },
  ) => {
    const impulse = Math.max(-20, Math.min(20, info.velocity.x * 0.014));
    releaseTorque.set(impulse);
    setTimeout(() => releaseTorque.set(0), 40);
  };

  // Calculates smooth sliding separation along the rail when a card is hovered
  const partingX = !isAnyHovered || relativeIndex === 0
    ? 0
    : relativeIndex < 0
      ? relativeIndex === -1 ? -52 : relativeIndex === -2 ? -26 : relativeIndex === -3 ? -10 : 0
      : relativeIndex === 1 ? 60 : relativeIndex === 2 ? 30 : relativeIndex === 3 ? 12 : 0;

  // Inverted overlap: earlier cards sit ON TOP of later cards
  const baseZIndex = 80 - Math.min(index, 70);

  return (
    <motion.div
      role="listitem"
      className={`relative h-[92%] shrink-0 snap-center ${
        isShort
          ? "-mr-10 sm:-mr-14 md:-mr-18 lg:-mr-22"
          : "-mr-7 sm:-mr-10 md:-mr-12 lg:-mr-14"
      }`}
      style={{
        width: isShort ? "clamp(12.5rem, 21vw, 17.5rem)" : "clamp(7.5rem, 12.5vw, 11.2rem)",
        perspective: 1000,
        zIndex: isHovered ? 150 : baseZIndex,
      }}
      initial={{ opacity: 0, y: -20 }}
      animate={{
        opacity: 1,
        x: partingX,
        y: 0,
        scale: 1,
        transition: TILT_SPRING,
      }}
      onMouseEnter={() => onHover(true)}
      onMouseLeave={() => onHover(false)}
    >
      <motion.div
        className="relative flex h-full w-full cursor-grab active:cursor-grabbing flex-col items-center"
        style={{
          x,
          rotate: settledRotateZ,
          rotateY: targetHangerAngle,
          // Fulcrum point: top center of the hanger hook touching the brass rod
          transformOrigin: "50% 6px",
          transformStyle: "preserve-3d",
        }}
        drag="x"
        dragConstraints={{ left: -PULL, right: PULL }}
        dragElastic={0.18}
        dragSnapToOrigin
        dragTransition={{ bounceStiffness: 220, bounceDamping: 14 }}
        onDragEnd={handleDragEnd}
      >
        <Hanger tone="#7C4A27" />
        {/* The flip nests *inside* the hanger's tilt rather than competing
            with it: the parent already owns a rotateY for how the garment
            hangs, and two rotations on one element would fight. */}
        <div
          className="relative -mt-2.5 w-full flex-1 min-h-0"
          style={{
            transformStyle: "preserve-3d",
          }}
        >
          <GarmentFlip
            garment={garment}
            variant={isShort ? "short" : "standard"}
            priority={index < 4}
            interactive={isHovered}
            onOpen={onOpen}
          />
        </div>
      </motion.div>
    </motion.div>
  );
}

/* ── furniture ───────────────────────────────────────────────────────────── */

function RailArrow({
  side,
  onClick,
}: {
  side: "left" | "right";
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={side === "left" ? "Earlier on this rail" : "Further along this rail"}
      /* Inset from the edge rather than flush to it. The two room tabs are
         pinned to the middle of each side, and a rail's arrows sit at the
         quarter marks — on a short window the tab grew tall enough to cover
         them. The tab now scales with viewport height (see RoomTab) and these
         stand clear of its width, so the two can no longer meet. */
      className={`absolute top-1/2 z-[25] hidden h-11 w-9 -translate-y-1/2 items-center justify-center rounded-lg border-2 border-[#12100d] bg-[#FFDE59] text-[#12100d] shadow-[3px_3px_0px_#12100d] transition-all hover:bg-[#FFE57F] active:translate-x-[1px] active:shadow-[1px_1px_0px_#12100d] active:scale-[0.97] cursor-pointer md:flex ${
        side === "left" ? "left-[2.9rem]" : "right-[2.9rem]"
      }`}
    >
      <span className="font-black text-[0.85rem]">{side === "left" ? "◀" : "▶"}</span>
    </button>
  );
}

function ShelfHandle({
  open,
  count,
  onToggle,
}: {
  open: boolean;
  count: number;
  onToggle: () => void;
}) {
  return (
    <div className="relative z-[22] flex justify-center items-end shrink-0 w-full">
      <motion.button
        type="button"
        drag="y"
        dragConstraints={{ top: -80, bottom: 0 }}
        dragElastic={0.2}
        onDragEnd={(_e, info) => {
          if (info.offset.y < -20 || info.velocity.y < -100) {
            if (!open) onToggle();
          }
        }}
        onClick={onToggle}
        aria-expanded={open}
        className="flex items-center gap-3 rounded-t-2xl border-t-[3px] border-x-[3px] border-[#12100d] bg-[#FFDE59] hover:bg-[#FFE57F] px-8 py-2.5 text-[#12100d] shadow-[0px_-4px_0px_#12100d] transition-colors cursor-grab active:cursor-grabbing select-none"
      >
        <span
          aria-hidden
          className={`font-black text-sm transition-transform duration-300 ${
            open ? "rotate-180" : ""
          }`}
        >
          ▲
        </span>
        <span className="font-black text-[0.82rem] tracking-widest uppercase">
          {open ? "CLOSE SHOE DRAWER" : "DRAG / PULL SHOES"}
        </span>
        <span className="border-2 border-[#12100d] bg-white px-2 py-0.5 font-mono text-[0.68rem] font-black text-[#12100d]">
          {String(count).padStart(2, "0")}
        </span>
      </motion.button>
    </div>
  );
}

function Shelf({
  garments,
  onOpen,
  onClose,
}: {
  garments: Garment[];
  onOpen?: (garment: Garment) => void;
  onClose: () => void;
}) {
  // The same mechanism the hanging rails use — wheel, drag and arrows.
  const { ref: shelfScroller, nudge, handlers } = useRailScroll();

  return (
    <motion.div
      className="absolute inset-x-0 bottom-0 z-[30] h-[64%] overflow-hidden border-t-[3px] border-[#12100d] bg-[#F4EFE6]/98 backdrop-blur-md shadow-[0px_-8px_0px_rgba(18,16,13,0.15)] flex flex-col"
      initial={{ y: "100%" }}
      animate={{ y: 0 }}
      exit={{ y: "100%" }}
      transition={{ type: "spring", stiffness: 260, damping: 30 }}
    >
      {/* Neobrutalist Drawer Header matching top header tone */}
      <div className="flex shrink-0 items-center justify-between border-b-[3px] border-[#12100d] bg-[#F4EFE6] px-5 py-3 shadow-[0px_2px_0px_#12100d] lg:px-8">
        <span className="border-2 border-[#12100d] bg-[#FFDE59] px-3 py-1 font-black text-xs tracking-wider uppercase text-[#12100d] shadow-[2px_2px_0px_#12100d]">
          SHOE DRAWER
        </span>
        <button
          type="button"
          onClick={onClose}
          className="border-2 border-[#12100d] bg-[#FF5A5F] px-3 py-1 text-xs font-black uppercase text-white shadow-[2px_2px_0px_#12100d] transition-all hover:bg-[#FF3B42] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none cursor-pointer"
        >
          CLOSE ✕
        </button>
      </div>

      {garments.length === 0 ? (
        <p className="aside flex flex-1 items-center justify-center text-[1.1rem] text-[#12100d]/40">
          Nothing on the shelf yet.
        </p>
      ) : (
        <div className="relative min-h-0 flex-1">
          <div
            ref={shelfScroller}
            {...handlers}
            onPointerLeave={handlers.onPointerUp}
            role="list"
            aria-label="Shoe drawer"
            tabIndex={0}
            className="no-scrollbar flex h-full cursor-grab items-center gap-6 overflow-x-auto overflow-y-hidden px-8 pb-3 pt-1 focus-visible:outline-none active:cursor-grabbing"
            style={{
              scrollbarWidth: "none",
              scrollSnapType: "x proximity",
              scrollPaddingLeft: "2rem",
              scrollPaddingRight: "2rem",
            }}
          >
            {garments.map((g, i) => (
              <motion.div
                key={g.id}
                data-shelf-item
                className="relative h-[82%] shrink-0 snap-center"
                style={{ width: "clamp(13rem, 21vw, 17.5rem)" }}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04, duration: 0.4 }}
              >
                <div className="h-full w-full transition-transform hover:-translate-y-1">
                  <GarmentFlip garment={g} variant="shoe" onOpen={onOpen} />
                </div>
              </motion.div>
            ))}
            <span aria-hidden className="block w-[20vw] shrink-0" />
          </div>

          <RailArrow side="left" onClick={() => nudge(-1)} />
          <RailArrow side="right" onClick={() => nudge(1)} />
        </div>
      )}

      {/* The thick neobrutalist shelf board */}
      <div
        aria-hidden
        className="h-[10px] w-full shrink-0 border-t-[3px] border-[#12100d] bg-[#8B4513] shadow-[0px_3px_0px_#12100d]"
      />
    </motion.div>
  );
}
