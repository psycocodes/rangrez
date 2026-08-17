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

/** How far a garment may be pulled off the hook before it refuses. */
const PULL = 46;
/** Degrees of tilt at full rail velocity. */
const MAX_SWING = 13;
/** Rail velocity that counts as "full". Measured, not guessed — a hard flick
 *  on a trackpad peaks around 2500px/s. */
const FULL_TILT_VELOCITY = 2200;

const SWING_SPRING = { stiffness: 90, damping: 11, mass: 0.9 } as const;

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
    <div className="relative flex min-h-0 flex-1 flex-col">
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

  /**
   * Rail velocity, in px/s, as a motion value the hanging cards read.
   *
   * Measured off real scroll events rather than motion's `useVelocity`,
   * because the scroll here is the browser's and not a motion value — which
   * is the point: we get the platform's momentum and still get to watch it.
   */
  const velocity = useMotionValue(0);
  const swing = useSpring(velocity, SWING_SPRING);
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
    // Scroll events stop firing when the rail stops, and the last one we saw
    // was at full speed — without this the rack would hang tilted forever.
    if (settle.current) clearTimeout(settle.current);
    settle.current = setTimeout(() => velocity.set(0), 90);
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
    if (Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return; // already horizontal
    node.scrollLeft += e.deltaY;
  }, []);

  const nudge = (dir: 1 | -1) => {
    const node = scroller.current;
    if (!node) return;
    node.scrollBy({ left: dir * node.clientWidth * 0.7, behavior: "smooth" });
  };

  return (
    <section
      className="relative flex min-h-0 flex-col border-b border-abyss/12"
      style={{ flex: `${grow} 1 0%` }}
      aria-label={rack.label}
    >
      {/* ── the rod ───────────────────────────────────────────────────── */}
      <div className="relative z-[2] shrink-0 px-4 pt-3 lg:px-8">
        <div className="mb-2 flex items-baseline justify-between gap-4">
          <span className="spec text-abyss/75">{rack.label}</span>
          <span className="spec-sm text-abyss/40">
            {String(garments.length).padStart(2, "0")} HANGING
          </span>
        </div>
        <div className="rod h-[7px] w-full rounded-full" />
      </div>

      {/* ── the rail ──────────────────────────────────────────────────── */}
      <div className="relative min-h-0 flex-1">
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
              tabIndex={0}
              role="list"
              aria-label={`${rack.label} rail`}
              className="no-scrollbar -mt-[18px] flex h-[calc(100%+18px)] items-start gap-4 overflow-x-auto overflow-y-hidden px-4 focus-visible:outline-none lg:gap-6 lg:px-8"
              style={{ scrollbarWidth: "none" }}
            >
              {garments.map((g, i) => (
                <Hanging
                  key={g.id}
                  garment={g}
                  swing={swing}
                  index={i}
                  onOpen={onOpen}
                />
              ))}
              {/* Air at the end, so the last garment can reach the middle of
                  the rail instead of being pinned against the edge. */}
              <span aria-hidden className="block w-[22vw] shrink-0" />
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
  onOpen,
}: {
  garment: Garment;
  /** Rail velocity, normalised to −1…1. */
  swing: MotionValue<number>;
  index: number;
  onOpen?: (garment: Garment) => void;
}) {
  const x = useMotionValue(0);
  const y = useMotionValue(0);

  // Pulling the hem to the right swings the garment clockwise about its hook.
  const pull = useTransform(x, [-PULL, PULL], [-16, 16]);
  const drift = useTransform(swing, (v) => -v * MAX_SWING);

  // The two forces are independent and both real, so they add. A garment you
  // are holding while the rack is moving should feel both.
  const rotate = useTransform([pull, drift], ([a, b]) => (a as number) + (b as number));
  const settled = useSpring(rotate, SWING_SPRING);

  return (
    // Two layers, and they must be two.
    //
    // The outer one deals the card in and lifts it on hover. The inner one is
    // the pendulum, and its x/y are motion values the drag writes to directly.
    // Collapsed into one element, `animate={{ y: 0 }}` and `style={{ y }}` are
    // two owners of the same property: motion hands control to the motion value
    // and the entrance animation never finishes — every card past the second
    // one sat permanently half-faded, which is exactly what it did.
    <motion.div
      role="listitem"
      className="relative h-full shrink-0"
      // No width: the card carries the design's 1063 × 1752 and the rail gives
      // it a height, so its width falls out of the two. Fixing one as well
      // would crop the card at most rail heights, and the rail's height moves
      // with the viewport.
      initial={{ opacity: 0, y: -18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index * 0.035, 0.5), duration: 0.5 }}
      whileHover={{ y: -7 }}
    >
      <motion.div
        className="relative h-full w-full cursor-grab active:cursor-grabbing"
        style={{
          x,
          y,
          rotate: settled,
          // The hook, not the card's middle. This one line is the difference
          // between a garment swinging and a card wobbling.
          transformOrigin: "50% 10px",
        }}
        drag
        dragConstraints={{ left: -PULL, right: PULL, top: 0, bottom: PULL * 0.5 }}
        dragElastic={0.14}
        dragSnapToOrigin
        dragTransition={{ bounceStiffness: 220, bounceDamping: 14 }}
        whileTap={{ scale: 0.985 }}
        onClick={() => onOpen?.(garment)}
      >
        <Hanger tone={INK.brass} />
        <div
          // inline-block so `width: auto` shrinks to the aspect ratio instead
          // of filling the parent — a block box ignores the ratio here.
          className="relative inline-block aspect-[1063/1752] h-[calc(100%-3.6rem)] overflow-hidden rounded-[4px] shadow-[0_16px_30px_-16px_rgba(14,44,57,0.42)]"
          style={{ border: `1px solid ${INK.abyss}22` }}
        >
          <GarmentPlate garment={garment} priority={index < 4} />
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
          <div className="no-scrollbar flex min-h-0 flex-1 items-end gap-4 overflow-x-auto px-4 pb-4 lg:gap-6 lg:px-8">
            {garments.map((g, i) => (
              <motion.button
                key={g.id}
                type="button"
                onClick={() => onOpen?.(g)}
                // Height-driven for the same reason the rail is — the card
                // owns its proportion, the shelf only says how tall.
                className="relative aspect-[1063/1752] h-[80%] shrink-0 overflow-hidden text-left"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04, duration: 0.4 }}
                whileHover={{ y: -8 }}
              >
                <GarmentPlate garment={g} />
              </motion.button>
            ))}
            <span aria-hidden className="block w-[16vw] shrink-0" />
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
