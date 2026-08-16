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

/* ── the fan ──────────────────────────────────────────────────────────────
   The rail is a hand of cards, not a row of tiles: they overlap, they lean
   away from whatever you are looking at, and they bounce into place. Scroll
   position drives the lean, so pushing the rack fans it — and the pointer
   drives the push, so reaching for one garment moves its neighbours out of
   the way the same as it would on a real rod. */

/**
 * How much of its own width each card hides behind the one before it.
 *
 * Small on purpose. At 0.17 the fan looked right and the cards were useless —
 * the title is the bottom third of the card, so each one buried the name of
 * the garment before it and the rail became a row of anonymous colours. Eight
 * per cent is enough to read as a hand of cards rather than a row of tiles,
 * and the hover push opens a proper gap wherever you are actually looking.
 */
const OVERLAP = 0.08;
/** Degrees of lean at the edge of the rail. */
const FAN_TILT = 9;
/** How far the outermost cards sit below the one in the middle, in px. */
const FAN_DROP = 20;
/** How much smaller the outermost cards are. */
const FAN_SHRINK = 0.11;
/** How far a card's neighbours step aside when it is picked up, in px. */
const PUSH = 26;
/** Neighbours beyond this many places away don't move. */
const PUSH_REACH = 3;
/** The hanger drawn above every card. Must match `Hanger`'s own height. */
const HANGER = "3.6rem";
/** Wheel delta to rail pixels — see the note on `onWheel`. */
const WHEEL_GAIN = 0.62;

/** The card's proportion, from the design. Kept in step with GarmentPlate. */
const CARD_RATIO = 1063 / 1752;

const FAN_SPRING = { stiffness: 210, damping: 17, mass: 0.8 } as const;

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

  /** The rail's scroll position, as something the cards can read per frame. */
  const scrolled = useMotionValue(0);
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
    scrolled.set(node.scrollLeft);
    // Scroll events stop firing when the rail stops, and the last one we saw
    // was at full speed — without this the rack would hang tilted forever.
    if (settle.current) clearTimeout(settle.current);
    settle.current = setTimeout(() => velocity.set(0), 90);
  }, [velocity, scrolled]);

  useEffect(() => {
    return () => {
      if (settle.current) clearTimeout(settle.current);
    };
  }, []);

  /**
   * A plain mouse wheel emits deltaY; without this it does nothing here.
   *
   * Two things it has to get right, and the first version got neither. A wheel
   * notch is around 100px and a trackpad flick is a stream of 2–3px events, so
   * passing deltaY through untouched makes the mouse lurch a third of the rail
   * per click while the trackpad crawls; `WHEEL_GAIN` and the deadzone put the
   * two on the same footing. And once a rail has reached its end the gesture
   * has to be handed back — a wheel that keeps being swallowed at the last
   * garment is a rail that feels broken, and it is why this was annoying.
   */
  // Bound natively rather than through React's `onWheel`, which is registered
  // passive at the root — preventDefault there is a no-op and a console
  // warning, and without it the page fights the rail for the same gesture.
  useEffect(() => {
    const node = scroller.current;
    if (!node) return;

    const handler = (e: WheelEvent) => {
      const amount = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
      if (Math.abs(amount) < 0.5) return;

      const room = node.scrollWidth - node.clientWidth;
      const at = node.scrollLeft;
      if ((amount < 0 && at <= 0) || (amount > 0 && at >= room - 1)) return;

      e.preventDefault();
      node.scrollLeft = at + amount * WHEEL_GAIN;
    };

    // The fan's position comes off a native listener rather than React's
    // `onScroll`. Both fire, but this one is the value every card reads on
    // every frame of momentum, and routing it through the synthetic system
    // adds a hop for no benefit — the swing above is welcome to keep it.
    const track = () => scrolled.set(node.scrollLeft);
    track();

    node.addEventListener("wheel", handler, { passive: false });
    node.addEventListener("scroll", track, { passive: true });
    return () => {
      node.removeEventListener("wheel", handler);
      node.removeEventListener("scroll", track);
    };
  }, [scrolled]);

  /* ── what the fan is measured against ──────────────────────────────────
     A card leans by where it sits relative to the middle of the rail, so the
     rail's width has to be live too: it changes with the viewport, and the
     scroll position changes with every frame of momentum. */
  const [viewport, setViewport] = useState(0);
  const [cardW, setCardW] = useState(0);
  const [held, setHeld] = useState<number | null>(null);

  useEffect(() => {
    const node = scroller.current;
    if (!node) return;
    const measure = () => {
      setViewport(node.clientWidth);
      // The card is sized by the rail's height and its own proportion — the
      // same derivation the markup makes, done here so the overlap can be a
      // real number of pixels instead of a percentage of the wrong thing.
      const hanger = parseFloat(getComputedStyle(node).fontSize) * 3.6;
      setCardW(Math.max(0, (node.clientHeight - hanger) * CARD_RATIO));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(node);
    return () => ro.disconnect();
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
              onPointerLeave={() => setHeld(null)}
              tabIndex={0}
              role="list"
              aria-label={`${rack.label} rail`}
              className="no-scrollbar -mt-[18px] flex h-[calc(100%+18px)] items-start overflow-x-auto overflow-y-hidden px-4 focus-visible:outline-none lg:px-8"
              style={{ scrollbarWidth: "none" }}
            >
              {garments.map((g, i) => (
                <Hanging
                  key={g.id}
                  garment={g}
                  swing={swing}
                  scrolled={scrolled}
                  viewport={viewport}
                  cardW={cardW}
                  index={i}
                  held={held}
                  onHold={setHeld}
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
  scrolled,
  viewport,
  cardW,
  index,
  held,
  onHold,
  onOpen,
}: {
  garment: Garment;
  /** Rail velocity, normalised to −1…1. */
  swing: MotionValue<number>;
  /** The rail's scroll position, in px. */
  scrolled: MotionValue<number>;
  /** The rail's visible width, in px. */
  viewport: number;
  /** One card's width, in px. */
  cardW: number;
  index: number;
  /** Which card the pointer is on, if any. */
  held: number | null;
  onHold: (index: number | null) => void;
  onOpen?: (garment: Garment) => void;
}) {
  const self = useRef<HTMLDivElement>(null);
  const x = useMotionValue(0);
  const y = useMotionValue(0);

  // Where this card sits along the rail, measured once it has a position.
  // Read off the element rather than computed from the index, because the
  // overlap, the padding and the trailing spacer all move it.
  const [home, setHome] = useState(0);
  useEffect(() => {
    const node = self.current;
    if (!node) return;
    setHome(node.offsetLeft + node.offsetWidth / 2);
  }, [cardW, viewport]);

  /**
   * How far from the middle of the rail this card is, as −1…1.
   *
   * Everything about the fan hangs off this one number: cards lean away from
   * the middle, sit lower and stand smaller the further out they are. Because
   * it reads the live scroll position, pushing the rack *fans* it — the
   * hand of cards opens and closes under your hand instead of sliding past
   * like a strip of tiles.
   */
  const place = useTransform(scrolled, (s) =>
    viewport ? Math.max(-1, Math.min(1, (home - s - viewport / 2) / (viewport / 2))) : 0,
  );

  const fanTilt = useTransform(place, (p) => p * FAN_TILT);
  const drop = useSpring(
    useTransform(place, (p) => Math.abs(p) * FAN_DROP),
    FAN_SPRING,
  );
  const shrink = useSpring(
    useTransform(place, (p) => 1 - Math.abs(p) * FAN_SHRINK),
    FAN_SPRING,
  );

  // Pulling the hem to the right swings the garment clockwise about its hook.
  const pull = useTransform(x, [-PULL, PULL], [-16, 16]);
  const drift = useTransform(swing, (v) => -v * MAX_SWING);

  // Three forces, all real, so they add: the hand on the hem, the rack's
  // momentum, and where on the fan the card is standing.
  const rotate = useTransform(
    [pull, drift, fanTilt],
    ([a, b, c]) => (a as number) + (b as number) + (c as number),
  );
  const settled = useSpring(rotate, SWING_SPRING);

  /**
   * Reaching for one garment moves its neighbours out of the way.
   *
   * Cards to the left step left and cards to the right step right, falling off
   * with distance, so a gap opens around whatever you are pointing at. On a
   * real rod you do this with the back of your hand without noticing.
   */
  const gap =
    held === null || held === index
      ? 0
      : Math.sign(index - held) *
        PUSH *
        Math.max(0, 1 - (Math.abs(index - held) - 1) / PUSH_REACH);

  const lifted = held === index;

  return (
    // Two layers, and they must be two.
    //
    // The outer one deals the card in and lifts it on hover. The inner one is
    // the pendulum, and its x/y are motion values the drag writes to directly.
    // Collapsed into one element, `animate={{ y: 0 }}` and `style={{ y }}` are
    // two owners of the same property: motion hands control to the motion value
    // and the entrance animation never finishes — every card past the second
    // one sat permanently half-faded, which is exactly what it did.
    // No width. The card carries the design's 1063 × 1752 and the rail gives
    // it a height, so its width falls out of the two — hard-coding one as well
    // would either crop the card or leave a gap beside it at most rail
    // heights, and the rail's height moves with the viewport.
    <motion.div
      ref={self}
      role="listitem"
      className="relative h-full shrink-0"
      style={{
        // Each card tucks behind the one before it, the way garments actually
        // sit on a rod. The first keeps its full margin so the rail still
        // starts where the padding says it does.
        marginLeft: index ? -cardW * OVERLAP : 0,
        // Later cards in front, and whatever is under the pointer in front of
        // everything — otherwise reaching for a card lifts it *behind* its
        // neighbour, which reads as a glitch rather than as a gesture.
        zIndex: lifted ? 60 : index,
      }}
      // Dealt in: from below, small, and slightly over-rotated, on a spring
      // loose enough to overshoot. Cloth settles; a card thrown onto a table
      // bounces, and this is the moment the rail is a hand of cards.
      initial={{ opacity: 0, y: 46, scale: 0.82 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{
        delay: Math.min(index * 0.055, 0.6),
        type: "spring",
        stiffness: 240,
        damping: 13,
        mass: 0.7,
      }}
    >
      {/* Layer two: the pointer. Steps aside for its neighbour, or rises when
          it is the one being reached for. Plain numbers on `animate`. */}
      <motion.div
        className="relative h-full w-full"
        onPointerEnter={() => onHold(index)}
        animate={{ x: gap, y: lifted ? -20 : 0 }}
        transition={FAN_SPRING}
      >
        {/* Layer three: the fan. Driven by scroll position alone. */}
        <motion.div
          className="relative h-full w-full"
          style={{ y: drop, scale: shrink }}
        >
          {/* Layer four: the pendulum, whose x and y the drag writes to
              directly. Each property has exactly one owner across these four
              elements, which is the whole reason there are four: `animate`
              and a motion value on the same property means motion hands
              control to the value and the animation never completes. Every
              card past the second one once sat permanently half-faded that
              way. */}
          <motion.div
            className="relative h-full w-full cursor-grab active:cursor-grabbing"
            style={{
              x,
              y,
              rotate: settled,
              // The hook, not the card's middle. This one line is the
              // difference between a garment swinging and a card wobbling.
              transformOrigin: "50% 10px",
            }}
            drag
            dragConstraints={{ left: -PULL, right: PULL, top: 0, bottom: PULL * 0.5 }}
            dragElastic={0.14}
            dragSnapToOrigin
            dragTransition={{ bounceStiffness: 220, bounceDamping: 14 }}
            onClick={() => onOpen?.(garment)}
          >
            <Hanger tone={INK.brass} />
            {/* inline-block so `width: auto` shrinks to the aspect ratio
                instead of filling the parent — a block box ignores the
                ratio here. */}
            <div
              className="relative inline-block aspect-[1063/1752] overflow-hidden rounded-[4px] transition-shadow duration-500"
              style={{
                height: `calc(100% - ${HANGER})`,
                border: `1px solid ${INK.abyss}22`,
                boxShadow: lifted
                  ? "0 30px 46px -18px rgba(14,44,57,0.55)"
                  : "0 16px 30px -16px rgba(14,44,57,0.42)",
              }}
            >
              <GarmentPlate garment={garment} priority={index < 4} />
            </div>
          </motion.div>
        </motion.div>
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
