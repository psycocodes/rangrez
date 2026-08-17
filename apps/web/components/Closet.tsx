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

export interface Rack {
  id: string;
  label: string;
  zones: Zone[];
}

/** Torso above, bottoms below — the order a cupboard is actually organised in. */
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
      {RACKS.map((rack, i) => {
        const items = garments.filter((g) => rack.zones.includes(g.zone));
        return (
          <Rail
            key={rack.id}
            rack={rack}
            garments={items}
            onOpen={onOpen}
            // The top rack gets the taller share: a shirt is longer than a
            // folded trouser, and equal halves make both look wrong.
            grow={i === 0 ? 1.15 : 1}
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
  const scroller = useRef<HTMLDivElement>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  /**
   * Rail velocity, in px/s, as a motion value the hanging cards read.
   */
  const velocity = useMotionValue(0);
  const swing = useSpring(velocity, PENDULUM_SPRING);
  const last = useRef({ x: 0, t: 0 });
  const settle = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isDraggingRail = useRef(false);
  const dragStartX = useRef(0);
  const scrollStartX = useRef(0);

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

  /** A plain mouse wheel emits deltaY; without this it does nothing here. */
  const onWheel = useCallback((e: React.WheelEvent) => {
    const node = scroller.current;
    if (!node) return;
    if (Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return;
    node.scrollLeft += e.deltaY * 0.9;
  }, []);

  const nudge = (dir: 1 | -1) => {
    const node = scroller.current;
    if (!node) return;
    node.scrollBy({ left: dir * 260, behavior: "smooth" });
  };

  // Rail background pan support
  const handlePointerDown = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest('[role="listitem"]')) return;
    isDraggingRail.current = true;
    dragStartX.current = e.clientX;
    if (scroller.current) {
      scrollStartX.current = scroller.current.scrollLeft;
    }
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDraggingRail.current || !scroller.current) return;
    const dx = e.clientX - dragStartX.current;
    scroller.current.scrollLeft = scrollStartX.current - dx;
  };

  const handlePointerUp = () => {
    isDraggingRail.current = false;
  };

  const hoveredIndex = garments.findIndex((g) => g.id === hoveredId);

  return (
    <section
      className="relative flex min-h-0 flex-col border-b border-abyss/12"
      style={{ flex: `${grow} 1 0%` }}
      aria-label={rack.label}
    >
      {/* ── header label ─────────────────────────────────────────────────── */}
      <div className="relative z-[2] shrink-0 px-4 pt-3 pb-1 lg:px-8">
        <div className="flex items-baseline justify-between gap-4">
          <span className="spec text-abyss/75">{rack.label}</span>
          <span className="spec-sm text-abyss/40">
            {String(garments.length).padStart(2, "0")} HANGING
          </span>
        </div>
      </div>

      {/* ── the rail with continuous rod ───────────────────────────────── */}
      <div className="relative min-h-0 flex-1 overflow-hidden">
        {/* Continuous brass rod running across the entire rail viewport */}
        <div
          aria-hidden
          className="rod pointer-events-none absolute inset-x-0 top-[3px] z-[3] h-[7px]"
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
              onWheel={onWheel}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerLeave={() => {
                handlePointerUp();
                setHoveredId(null);
              }}
              tabIndex={0}
              role="list"
              aria-label={`${rack.label} rail`}
              className="no-scrollbar flex h-full items-start overflow-x-auto overflow-y-hidden px-6 pt-0 focus-visible:outline-none lg:px-10"
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
  onHover: (hovered: boolean) => void;
  onOpen?: (garment: Garment) => void;
}) {
  const x = useMotionValue(0);
  const releaseTorque = useMotionValue(0);

  // Pure pendulum sway around the hanger hook fulcrum (50% 4px):
  // 1. Manual horizontal drag pull: x -> -18deg to +18deg
  // 2. Rail momentum inertia lag: swing -> -20deg to +20deg
  // 3. Fling release impulse: decaying harmonic spring
  const pull = useTransform(x, [-PULL, PULL], [-18, 18]);
  const drift = useTransform(swing, (v) => -v * MAX_SWING);
  const rawZ = useTransform(
    [pull, drift, releaseTorque],
    ([p, d, r]) => (p as number) + (d as number) + (r as number),
  );
  const settledRotateZ = useSpring(rawZ, PENDULUM_SPRING);

  // Reversed Hanger Tilt Angle (Negative / inward tilt):
  // Idle: -26deg (turned inside along the rod)
  // Hovered: 0deg (upright, facing straight forward)
  // Neighbors: parts subtly (-32deg or -20deg)
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
    // Transfer drag release velocity into pendulum angular impulse
    const impulse = Math.max(-20, Math.min(20, info.velocity.x * 0.014));
    releaseTorque.set(impulse);
    // Smooth decay to rest
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
      className="relative h-full shrink-0 snap-center -mr-8 sm:-mr-12 md:-mr-14 lg:-mr-16"
      style={{
        width: "clamp(8.5rem, 15vw, 13.5rem)",
        perspective: 1000,
        zIndex: isHovered ? 150 : baseZIndex,
      }}
      initial={{ opacity: 0, y: -20 }}
      animate={{
        opacity: 1,
        x: partingX,
        y: isHovered ? -4 : 0,
        scale: isHovered ? 1.025 : isAnyHovered ? 0.95 : 0.98,
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
          transformOrigin: "50% 4px",
          transformStyle: "preserve-3d",
        }}
        drag="x"
        dragConstraints={{ left: -PULL, right: PULL }}
        dragElastic={0.18}
        dragSnapToOrigin
        dragTransition={{ bounceStiffness: 220, bounceDamping: 14 }}
        onDragEnd={handleDragEnd}
        whileTap={{ scale: 0.985 }}
        onClick={() => onOpen?.(garment)}
      >
        <Hanger tone="#EDE7DA" />
        <div
          className="relative -mt-2.5 w-full flex-1 min-h-0"
          style={{
            transformStyle: "preserve-3d",
          }}
        >
          <GarmentPlate
            garment={garment}
            priority={index < 4}
            interactive={isHovered}
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
      className={`absolute top-1/2 z-[3] hidden h-11 w-8 -translate-y-1/2 items-center justify-center border border-abyss/20 bg-leaf/85 text-abyss/70 backdrop-blur-sm transition-colors duration-300 hover:border-abyss hover:bg-brass hover:text-abyss md:flex ${
        side === "left" ? "left-0" : "right-0"
      }`}
    >
      <span className="spec text-[0.7rem]">{side === "left" ? "‹" : "›"}</span>
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
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={open}
      className="group relative z-[12] flex shrink-0 items-center justify-center gap-3 border-t-2 border-abyss bg-abyss px-4 py-2.5 text-leaf transition-colors duration-300 hover:bg-peacock"
    >
      <span
        aria-hidden
        className={`spec text-brass-light transition-transform duration-500 [transition-timing-function:var(--ease-cloth)] ${
          open ? "rotate-180" : ""
        }`}
      >
        ▲
      </span>
      <span className="spec">
        {open ? "Close the shelf" : "Shoes & the rest"}
      </span>
      <span className="spec-sm text-leaf/50">
        {String(count).padStart(2, "0")}
      </span>
    </button>
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
  const shelfScroller = useRef<HTMLDivElement>(null);
  const isDraggingShelf = useRef(false);
  const dragStartX = useRef(0);
  const scrollStartX = useRef(0);

  const onWheel = useCallback((e: React.WheelEvent) => {
    const node = shelfScroller.current;
    if (!node) return;
    if (Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return;
    node.scrollLeft += e.deltaY * 0.9;
  }, []);

  const nudge = (dir: 1 | -1) => {
    const node = shelfScroller.current;
    if (!node) return;
    node.scrollBy({ left: dir * 240, behavior: "smooth" });
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest("button[data-shelf-item]")) return;
    isDraggingShelf.current = true;
    dragStartX.current = e.clientX;
    if (shelfScroller.current) {
      scrollStartX.current = shelfScroller.current.scrollLeft;
    }
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDraggingShelf.current || !shelfScroller.current) return;
    const dx = e.clientX - dragStartX.current;
    shelfScroller.current.scrollLeft = scrollStartX.current - dx;
  };

  const handlePointerUp = () => {
    isDraggingShelf.current = false;
  };

  return (
    <motion.div
      // Over the racks rather than beside them: a shelf you pull out covers
      // what is behind it, and the page has exactly one viewport to spend.
      className="absolute inset-x-0 bottom-0 z-[11] h-[58%] overflow-hidden border-t-2 border-abyss"
      initial={{ y: "100%" }}
      animate={{ y: 0 }}
      exit={{ y: "100%" }}
      transition={{ type: "spring", stiffness: 260, damping: 30 }}
    >
      <Ground
        kind="bandhani"
        tone={INK.brassLight}
        base={INK.abyss}
        opacity={0.18}
        glow={false}
        className="flex h-full flex-col"
      >
        <div className="flex items-baseline justify-between gap-4 px-4 pb-2 pt-3 lg:px-8">
          <span className="spec text-brass-light">On the shelf</span>
          <button
            type="button"
            onClick={onClose}
            className="spec-sm text-leaf/60 transition-colors hover:text-leaf"
          >
            CLOSE ×
          </button>
        </div>

        {garments.length === 0 ? (
          <p className="aside flex flex-1 items-center justify-center text-[1.1rem] text-leaf/40">
            Nothing on the shelf yet.
          </p>
        ) : (
          <div className="relative min-h-0 flex-1">
            <div
              ref={shelfScroller}
              onWheel={onWheel}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerLeave={handlePointerUp}
              className="no-scrollbar flex h-full items-end gap-5 overflow-x-auto px-6 pb-4 lg:gap-7 lg:px-10"
              style={{
                scrollbarWidth: "none",
                scrollSnapType: "x proximity",
                scrollPaddingLeft: "2rem",
              }}
            >
              {garments.map((g, i) => (
                <motion.button
                  key={g.id}
                  data-shelf-item
                  type="button"
                  onClick={() => onOpen?.(g)}
                  className="relative h-[82%] shrink-0 snap-center overflow-hidden rounded-[4px] text-left shadow-[0_12px_24px_-10px_rgba(0,0,0,0.5)]"
                  style={{ width: "clamp(8.5rem, 15vw, 13rem)", perspective: 900 }}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.04, duration: 0.4 }}
                  whileHover={{ y: -10, scale: 1.04 }}
                >
                  <GarmentPlate garment={g} />
                </motion.button>
              ))}
              <span aria-hidden className="block w-[20vw] shrink-0" />
            </div>

            <RailArrow side="left" onClick={() => nudge(-1)} />
            <RailArrow side="right" onClick={() => nudge(1)} />
          </div>
        )}

        {/* The shelf board the shoes stand on. */}
        <span
          aria-hidden
          className="rod block h-[6px] w-full shrink-0"
          style={{ borderRadius: 0 }}
        />
      </Ground>
    </motion.div>
  );
}
