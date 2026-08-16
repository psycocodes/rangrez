"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

import {
  chainOrder,
  LOOK_WASH,
  moodFor,
  SLOTS,
  slotFor,
} from "@/lib/look";
import { GarmentPlate } from "./GarmentPlate";
import { materialise } from "@/lib/rasterize";
import {
  FRAMING,
  type Avatar,
  type Garment,
  type SlotId,
} from "@/lib/types";

/**
 * ═══════════════════════════════════════════════════════════════════════════
 *  The look creator — a room, not a page
 * ═══════════════════════════════════════════════════════════════════════════
 *
 *  Everywhere else in Rangrez is a spec sheet: ruled, numbered, paper-white,
 *  scrollable. This is the one place that is a *room*. It fills the viewport
 *  exactly once and never scrolls, the light in it drifts, and there is only
 *  one thing in the middle. Different world, same building — the type, the
 *  dyes and the hairline rules are all still the house's.
 *
 *  The hierarchy is the whole design:
 *
 *    the body      centre, tallest, lit, floating free of any frame
 *    the slots     above it, small, quiet until something is in them
 *    the racks     fanned into the bottom corners like a hand of cards,
 *                  half off-stage, deferring to the body
 *
 *  An earlier version gave the racks full-height columns either side. Three
 *  things of equal weight is not a composition, and the eye had nowhere to
 *  land. Now they are dealt into the corners and the body is unmistakably the
 *  subject.
 * ═══════════════════════════════════════════════════════════════════════════
 */

type StepState = "waiting" | "working" | "done" | "failed";

/** How long the empty room holds one mood before drifting to the next. */
const MOOD_MS = 7000;

export function LookCreator({
  avatars,
  activeAvatarId,
  garments,
}: {
  avatars: Avatar[];
  activeAvatarId?: string;
  garments: Garment[];
}) {
  const [plateId, setPlateId] = useState(activeAvatarId ?? avatars[0]?.id);
  const [picked, setPicked] = useState<Partial<Record<SlotId, Garment>>>({});
  const [render, setRender] = useState<string | null>(null);
  const [steps, setSteps] = useState<Partial<Record<SlotId, StepState>>>({});
  const [building, setBuilding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  const plate = avatars.find((a) => a.id === plateId) ?? avatars[0];
  const framing = FRAMING[plate?.framing ?? "full"];
  const openSlots = useMemo(() => new Set(framing.slots), [framing]);

  // The room breathes while it waits. Stops mattering the moment anything is
  // chosen, because the clothes take over the lighting from then on.
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), MOOD_MS);
    return () => clearInterval(t);
  }, []);

  /**
   * Which rail the wheels are showing.
   *
   * A wheel that holds your whole wardrobe is a wheel you cannot find anything
   * on — thirty pieces is six full turns. Filtering to one zone at a time makes
   * each wheel a handful of cards, which is the number a carousel is actually
   * good for. Torso first because it is the layer everything else is chosen
   * around, and because it is the one every avatar framing can carry.
   */
  const [zone, setZone] = useState<ZoneFilter>("torso");

  const inZone = useMemo(
    () => garments.filter((g) => ZONE_FILTERS[zone].zones.includes(g.zone)),
    [garments, zone],
  );
  const { left, right } = useMemo(() => split(inZone), [inZone]);

  const chosen = SLOTS.filter((s) => picked[s.id]);
  const done = SLOTS.filter((s) => steps[s.id] === "done").length;
  const [lightA, lightB, lightC, lightD] = moodFor(
    SLOTS.map((s) => picked[s.id]?.dye.hex).filter(Boolean) as string[],
    tick,
  );

  function put(garment: Garment) {
    const id = slotFor(garment);
    if (!id) return;

    if (!openSlots.has(id)) {
      setNote(
        `“${plate.customization.label}” is framed ${framing.label.toLowerCase()} — there's nowhere to put ${id === "shoes" ? "shoes" : "that"}.`,
      );
      return;
    }
    setNote(null);
    setError(null);
    setPicked((p) => ({ ...p, [id]: garment }));
  }

  function clear(id: SlotId) {
    setPicked((p) => {
      const next = { ...p };
      delete next[id];
      return next;
    });
  }

  /**
   * The chain. One request per layer, and the body updates as each lands — so
   * a four-piece fit is four visible events, not ninety seconds of nothing.
   */
  async function build() {
    const order = chainOrder(
      Object.fromEntries(chosen.map((s) => [s.id, picked[s.id]!.id])),
    );
    if (!order.length || !plate) return;

    setBuilding(true);
    setError(null);
    setNote(null);
    setSteps(
      Object.fromEntries(order.flatMap((s) => s.slots.map((id) => [id, "waiting"]))),
    );

    // The starter pieces are drawings held as data: URIs, which the engine
    // cannot fetch and cannot decode. Rasterise any of those to a real file on
    // our origin first — once per garment, ever — so the chain below only ever
    // deals in ordinary URLs. Done up front rather than per layer so a fit
    // can't fail three renders in.
    try {
      await Promise.all(
        order
          .flatMap((s) => s.slots)
          .map((id) => materialise(picked[id]!)),
      );
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Couldn't prepare those pieces.",
      );
      setSteps({});
      setBuilding(false);
      return;
    }

    // Start from the bare plate, so rebuilding doesn't stack onto the last fit.
    let base: string | undefined;
    setRender(null);

    for (const step of order) {
      const mark = (state: StepState) =>
        setSteps((s) => ({
          ...s,
          ...Object.fromEntries(step.slots.map((id) => [id, state])),
        }));

      mark("working");
      try {
        const res = await fetch("/api/look/step", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            // The whole outfit at once. It is drawn onto one reference sheet
            // server-side and worn in a single render — rendering piece by
            // piece drifted the face and let the jacket paint over the tee.
            pieces: step.pieces,
            target: step.target,
            avatarId: plate.id,
            baseUrl: base,
          }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? "That layer didn't take.");

        base = json.renderUrl as string;
        setRender(base);
        mark("done");
      } catch (err) {
        mark("failed");
        setError(err instanceof Error ? err.message : "That layer didn't take.");
        break; // sequential: there is no body to carry on from
      }
    }

    setBuilding(false);
  }

  /**
   * The figure in the room.
   *
   * Before anything is built, the cutout — this room is a gradient and a body
   * on a rectangle of someone's hallway sits *on* it rather than *in* it, which
   * was the one thing that kept the page reading as a web page instead of a
   * room. Falls back to the plate when the photograph was too busy to matte, or
   * when it predates cutouts existing.
   *
   * Once a look has been built, the render — that one is a fresh photograph
   * from YouCam with its own background, and there is nothing of ours to matte
   * it with.
   */
  const shown = render ?? plate?.cutoutUrl ?? plate?.renderUrl;
  const floating = !render && Boolean(plate?.cutoutUrl);

  return (
    <div
      // Exactly one viewport, minus the bar above it. The breakpoint matches
      // the one the card fans appear at: from `md` up this is a fixed single
      // screen and the fans may hang off the floor by a few pixels, which is
      // the intended look. Below `md` the fans are gone and the room is
      // allowed to scroll, because a phone in portrait genuinely cannot hold
      // a body, a rail and a button at once.
      className="page relative min-h-[34rem] justify-between"
      style={
        {
          "--look-a": lightA,
          "--look-b": lightB,
          "--look-c": lightC,
          "--look-d": lightD,
          // The colours interpolate; the gradient itself never changes. This is
          // what makes the room drift rather than cut between moods.
          transition:
            "--look-a 2200ms var(--ease-cloth), --look-b 2200ms var(--ease-cloth), --look-c 2200ms var(--ease-cloth)",
          background: LOOK_WASH,
        } as React.CSSProperties
      }
    >
      {/* The weave, carried over from the rest of the app so this reads as the
          same cloth under different light. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.5]"
        style={{
          backgroundImage:
            "repeating-linear-gradient(90deg,rgba(20,18,14,.035) 0 1px,transparent 1px 3px),repeating-linear-gradient(0deg,rgba(20,18,14,.035) 0 1px,transparent 1px 3px)",
        }}
      />

      {/* ── the line at the top ─────────────────────────────────────────── */}
      <header className="relative z-20 flex shrink-0 items-baseline justify-between gap-4 px-4 py-2.5 lg:px-6">
        <span className="spec text-ink-3">
          The look creator
          <span className="ml-3 text-madder">
            {chosen.length ? `${chosen.length} on` : "empty rail"}
          </span>
        </span>

        <div className="flex items-center gap-2">
          {avatars.length > 1 &&
            avatars.map((a) => (
              <button
                key={a.id}
                type="button"
                className="chip !py-1"
                data-on={a.id === plate?.id}
                disabled={building}
                onClick={() => {
                  setPlateId(a.id);
                  setRender(null);
                  setSteps({});
                }}
              >
                <span className="spec">{a.customization.label}</span>
              </button>
            ))}
          <span className="spec-sm hidden text-ink-3 sm:block">
            {framing.label.toUpperCase()}
          </span>
        </div>
      </header>

      {/* ── the rail of slots ───────────────────────────────────────────── */}
      <div className="relative z-20 flex shrink-0 justify-center px-4">
        <SlotRail
          picked={picked}
          openSlots={openSlots}
          steps={steps}
          onClear={clear}
          disabled={building}
        />
      </div>

      {/* ── the body ────────────────────────────────────────────────────── */}
      <div className="relative z-10 flex min-h-0 flex-1 items-end justify-center">
        {/* Light falling on the floor where the figure stands. */}
        <div
          aria-hidden
          className="pointer-events-none absolute bottom-[7%] left-1/2 h-[22%] w-[38%] max-w-[26rem] -translate-x-1/2 rounded-[50%]"
          style={{
            background:
              "radial-gradient(50% 50%, rgba(255,255,255,.65), transparent 70%)",
          }}
        />

        {/* Smaller than it was: the wheels either side need room to turn, and
            the body reads as the subject through position and light rather
            than through sheer size. */}
        <figure className="relative flex h-full min-h-0 w-full max-w-[23rem] flex-col items-center justify-end pb-[8%]">
          {shown && (
            <Image
              key={shown}
              src={shown}
              alt={
                render
                  ? "Your avatar wearing the look"
                  : `${plate.customization.label} — base avatar`
              }
              width={900}
              height={1200}
              priority
              sizes="(max-width: 1024px) 80vw, 23rem"
              // A cutout casts a shadow shaped like the body; a rectangular
              // photograph casts one shaped like a rectangle, which is worse
              // than none at all. So the drop shadow only goes on when there
              // is a silhouette for it to follow.
              className={`rise h-full w-auto max-w-full object-contain ${
                floating
                  ? "drop-shadow-[0_28px_38px_rgba(20,18,14,0.32)]"
                  : "shadow-[0_28px_38px_rgba(20,18,14,0.28)]"
              }`}
            />
          )}

          {building && (
            <span
              aria-hidden
              className="scan absolute inset-x-0 top-0 z-[2] h-px bg-turmeric"
            />
          )}

          {/* The pedestal is only the shadow the figure casts. An earlier pass
              drew an actual plinth — a white slab with a lit top edge — and on
              a pale backdrop it read as a rendering error rather than an
              object. Contact shadow alone is enough to put someone on a floor. */}
          <span aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0">
            <span
              className="absolute inset-x-[18%] bottom-[1.15rem] block h-6 rounded-[50%] blur-[3px]"
              style={{
                background:
                  "radial-gradient(50% 50%, rgba(20,18,14,.42), transparent 74%)",
              }}
            />
            <span
              className="absolute inset-x-[30%] bottom-[1.5rem] block h-3 rounded-[50%]"
              style={{
                background:
                  "radial-gradient(50% 50%, rgba(20,18,14,.5), transparent 68%)",
              }}
            />
          </span>

          <figcaption className="spec-sm absolute bottom-0 left-1/2 -translate-x-1/2 whitespace-nowrap text-ink-3">
            {render ? "THE FIT" : plate.customization.label.toUpperCase()}
          </figcaption>
        </figure>
      </div>

      {/* ── the hands of cards ──────────────────────────────────────────── */}
      <Fan
        side="left"
        title={`${ZONE_FILTERS[zone].label} · shops`}
        empty="Nothing saved yet"
        garments={left}
        openSlots={openSlots}
        onPick={put}
        disabled={building}
      />
      <Fan
        side="right"
        title="Yours"
        empty="Nothing shot yet"
        garments={right}
        openSlots={openSlots}
        onPick={put}
        disabled={building}
      />

      {/* ── the three racks ─────────────────────────────────────────────── */}
      {/* Directly above the build button, because they are the same gesture:
          pick a rail, turn the wheels, add it, move to the next rail. Three
          taps down the body — torso, bottoms, shoes — is the order you dress
          in, so it is the order they sit in. */}
      <div className="relative z-30 mb-2.5 flex shrink-0 justify-center px-4">
        <div className="flex border-2 border-abyss bg-leaf/85 backdrop-blur-sm">
          {(Object.keys(ZONE_FILTERS) as ZoneFilter[]).map((id, i) => {
            const on = zone === id;
            const count = garments.filter((g) =>
              ZONE_FILTERS[id].zones.includes(g.zone),
            ).length;
            return (
              <button
                key={id}
                type="button"
                onClick={() => setZone(id)}
                aria-pressed={on}
                className={`spec relative flex items-center gap-2 px-4 py-2.5 transition-colors duration-300 ${
                  i > 0 ? "border-l-2 border-abyss" : ""
                } ${on ? "bg-brass text-abyss" : "text-abyss/55 hover:bg-abyss/8 hover:text-abyss"}`}
              >
                {ZONE_FILTERS[id].label}
                <span className={`spec-sm ${on ? "opacity-65" : "opacity-40"}`}>
                  {String(count).padStart(2, "0")}
                </span>
                {on && (
                  <span
                    aria-hidden
                    className="absolute inset-x-0 top-0 h-[3px] bg-madder"
                  />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── the one button ──────────────────────────────────────────────── */}
      <div className="relative z-30 mx-auto flex w-full max-w-[30rem] shrink-0 flex-col items-center px-4 pb-4">
        {(note || error) && (
          <p
            role={error ? "alert" : undefined}
            className={`mb-2.5 w-full border-l-2 py-2 pl-3 text-[0.8rem] leading-snug backdrop-blur-sm ${
              error
                ? "border-madder bg-madder/12 text-madder"
                : "border-turmeric bg-turmeric/20 text-ink-2"
            }`}
          >
            {error ?? note}
          </p>
        )}

        <div className="flex w-full gap-2">
          <button
            type="button"
            onClick={build}
            disabled={building || chosen.length === 0}
            className="btn flex-1"
          >
            <span className="spec">
              {building
                ? `Building · ${done} of ${chosen.length}`
                : chosen.length === 0
                  ? "Build your fit"
                  : `Build your fit · ${chosen.length} ${chosen.length === 1 ? "piece" : "pieces"}`}
            </span>
            <span aria-hidden className="spec">{building ? "···" : "→"}</span>
          </button>
          {(chosen.length > 0 || render) && !building && (
            <button
              type="button"
              onClick={() => {
                setPicked({});
                setRender(null);
                setSteps({});
                setError(null);
                setNote(null);
              }}
              className="btn btn-ghost bg-paper/40 backdrop-blur-sm"
            >
              <span className="spec">Reset</span>
              <span aria-hidden className="spec">×</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Which hand a piece is dealt into.
 *
 * Shop saves left, your own photographs right — and the starter wardrobe split
 * between them, so both hands have something in them on a fresh account and
 * the page can be driven before you own anything. They are real rows with real
 * images, so they render like anything else and need no label saying so.
 */
/** The three racks the dashboard filters by, in the order you dress. */
type ZoneFilter = "torso" | "bottom" | "shoes";

const ZONE_FILTERS: Record<
  ZoneFilter,
  { label: string; zones: Garment["zone"][] }
> = {
  torso: { label: "Torso", zones: ["top", "outerwear"] },
  bottom: { label: "Bottoms", zones: ["bottom"] },
  shoes: { label: "Shoes", zones: ["shoes", "accessory"] },
};

function split(garments: Garment[]): { left: Garment[]; right: Garment[] } {
  const left: Garment[] = [];
  const right: Garment[] = [];
  let seedFlip = false;

  for (const g of garments) {
    if (g.origin === "shop") left.push(g);
    else if (g.origin === "seed") {
      (seedFlip ? right : left).push(g);
      seedFlip = !seedFlip;
    } else right.push(g);
  }
  return { left, right };
}

/* ═══ the rail ═══════════════════════════════════════════════════════════ */

function SlotRail({
  picked,
  openSlots,
  steps,
  onClear,
  disabled,
}: {
  picked: Partial<Record<SlotId, Garment>>;
  openSlots: Set<SlotId>;
  steps: Partial<Record<SlotId, StepState>>;
  onClear: (id: SlotId) => void;
  disabled: boolean;
}) {
  return (
    // pt leaves room for the rail and the hangers below it.
    <div className="relative flex items-end gap-3 pt-6 sm:gap-4">
      {/* An actual clothes rail, with each slot hung off it. This was one rule
          drawn across the middle of the boxes, which read as a line struck
          through them rather than as something they hang from. */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-x-[-2.5rem] top-0 h-px bg-ink/30"
      />
      <span
        aria-hidden
        className="pointer-events-none absolute -top-[3px] left-[-2.5rem] h-[7px] w-px bg-ink/30"
      />
      <span
        aria-hidden
        className="pointer-events-none absolute -top-[3px] right-[-2.5rem] h-[7px] w-px bg-ink/30"
      />

      {SLOTS.map((slot) => {
        const on = picked[slot.id];
        const open = openSlots.has(slot.id);
        const state = steps[slot.id];

        return (
          <div key={slot.id} className="relative flex flex-col items-center gap-1.5">
            {/* the hanger */}
            <span
              aria-hidden
              className={`pointer-events-none absolute -top-6 h-6 w-px ${
                on ? "bg-ink/45" : open ? "bg-ink/25" : "bg-ink/12"
              }`}
            />
            <div
              title={open ? slot.hint : "Not in frame on this plate"}
              className={`relative flex h-[6.4rem] w-[5rem] flex-col overflow-hidden border transition-all duration-500 sm:h-[7.6rem] sm:w-[6rem] ${
                on
                  ? "border-ink bg-paper shadow-[0_16px_32px_-16px_rgba(20,18,14,.65)]"
                  : open
                    ? "border-dashed border-ink/40 bg-paper/45"
                    : "border-ink/15 bg-ink/[0.07]"
              }`}
              style={{ transitionTimingFunction: "var(--ease-cloth)" }}
            >
              {on ? (
                <>
                  <Image
                    src={on.imageUrl}
                    alt={on.name}
                    fill
                    sizes="100px"
                    className={`object-cover transition-all duration-500 ${
                      state === "working" ? "opacity-40 saturate-0" : ""
                    }`}
                  />
                  {state === "working" && (
                    <span
                      aria-hidden
                      className="scan absolute inset-x-0 top-0 h-px bg-turmeric"
                    />
                  )}
                  {state === "done" && (
                    <span className="spec-sm absolute inset-x-0 bottom-0 bg-turmeric py-1 text-center text-ink">
                      ON
                    </span>
                  )}
                  {state === "failed" && (
                    <span className="spec-sm absolute inset-x-0 bottom-0 bg-madder py-1 text-center text-paper">
                      NO
                    </span>
                  )}
                  {!disabled && (
                    <button
                      type="button"
                      onClick={() => onClear(slot.id)}
                      aria-label={`Take off ${on.name}`}
                      className="absolute right-0 top-0 flex h-6 w-6 items-center justify-center bg-paper text-ink transition-colors hover:bg-madder hover:text-paper"
                    >
                      <span className="spec-sm leading-none">×</span>
                    </button>
                  )}
                </>
              ) : (
                <div className="flex flex-1 flex-col items-center justify-center gap-2 p-2 text-center">
                  {open ? (
                    <span
                      aria-hidden
                      className="display text-[1.5rem] leading-none text-ink-3/45"
                    >
                      +
                    </span>
                  ) : (
                    <Lock />
                  )}
                  <span className="text-[0.66rem] leading-tight text-ink-3/70">
                    {open ? slot.hint : "not in frame"}
                  </span>
                </div>
              )}

              {!open && (
                <span
                  aria-hidden
                  className="pointer-events-none absolute inset-0 text-ink opacity-[0.09]"
                  style={{
                    backgroundImage:
                      "repeating-linear-gradient(135deg,currentColor 0 1px,transparent 1px 5px)",
                  }}
                />
              )}
            </div>

            <span
              className={`spec-sm ${on ? "text-ink" : open ? "text-ink-2" : "text-ink-3/55"}`}
            >
              {slot.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function Lock() {
  return (
    <svg width="8" height="9" viewBox="0 0 8 9" fill="none" aria-hidden className="text-ink-3/60">
      <rect x="0.5" y="3.5" width="7" height="5" stroke="currentColor" />
      <path d="M2 3.5V2a2 2 0 1 1 4 0v1.5" stroke="currentColor" />
    </svg>
  );
}

/* ═══ a hand of cards ════════════════════════════════════════════════════ */

/* ── the wheel ───────────────────────────────────────────────────────────── */

/**
 * Rim geometry. These three numbers decide whether the wheel is usable, not
 * just whether it looks right.
 *
 * Cards sit `RADIUS * STEP` apart along the rim. At 460px and 11° that came to
 * 88px between cards carrying 184px-wide cards — so the front card covered
 * most of every other one and owned fifteen times their share of the pointer.
 * Widening the radius buys spacing without turning the cards any harder.
 */
const STEP = 13;
const RADIUS = 720;
/** How many cards each way stay on the rim before they're dropped. */
const ARC = 3;

/** How far a scroll gesture must travel, in pixels, to move the wheel one card. */
const WHEEL_THRESHOLD = 55;
/** Quiet period after which a scroll counts as a fresh gesture, not a tail. */
const GESTURE_GAP_MS = 160;
/** Minimum between steps. Comfortably under the rim's own travel, so a held
 *  scroll keeps the wheel in continuous motion instead of stepping, stopping,
 *  and stepping again — the pause is what read as juddering. */
const STEP_COOLDOWN_MS = 180;
/** The rim's travel time. Paired with the cooldown above — keep them in step. */
const SPIN_MS = 420;

/**
 * A wheel of clothes, hubbed below the floor.
 *
 * Cards sit on the rim — `rotate(θ) translateY(-R)` puts each one at its own
 * angle and leaves it standing radially, so turning the wheel really does
 * carry the left-hand cards up and over the top and the right-hand ones back
 * down. Scrolling over it spins it; so do the arrows.
 *
 * Two things this fixes from the version before it. Hover now follows the
 * pointer rather than only ever lifting whichever card happened to be at the
 * front — a card you are looking at is the card that should come to you. And
 * clicking any card on the rim takes it, instead of making you index to the
 * front first.
 *
 * Deliberately hubbed off-stage in a corner: the wheel is the supporting cast,
 * and nothing here may compete with the body for the centre of the frame.
 */
function Fan({
  side,
  title,
  empty,
  garments,
  openSlots,
  onPick,
  disabled,
}: {
  side: "left" | "right";
  title: string;
  empty: string;
  garments: Garment[];
  openSlots: Set<SlotId>;
  onPick: (g: Garment) => void;
  disabled: boolean;
}) {
  const [index, setIndex] = useState(0);
  const [hover, setHover] = useState(false);
  const [held, setHeld] = useState<string | null>(null);
  const mirror = side === "left" ? 1 : -1;

  const move = (by: number) => {
    if (!garments.length) return;
    setIndex((i) => (i + by + garments.length) % garments.length);
  };

  /**
   * Turning the wheel by scrolling, one card at a time.
   *
   * A single flick of a trackpad emits dozens of wheel events, and inertia
   * keeps them coming for a second afterwards. Stepping on each one — which is
   * what this did at first — spun the wheel through its whole contents on one
   * gesture and read as broken.
   *
   * Two gates fix it. Distance: deltas accumulate and only trip a step at a
   * threshold, with the accumulator reset once a gesture goes quiet, so a new
   * flick starts from zero rather than inheriting the last one's tail. Time: a
   * step can't land while the previous one is still animating, which is what
   * makes a held scroll advance at a readable pace instead of a blur.
   */
  const travel = useRef(0);
  const lastEvent = useRef(0);
  const lastStep = useRef(0);

  const spin = (e: React.WheelEvent) => {
    if (disabled || !garments.length) return;

    const now = performance.now();
    if (now - lastEvent.current > GESTURE_GAP_MS) travel.current = 0;
    lastEvent.current = now;

    // Mice report lines, trackpads report pixels, some report pages.
    const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 360 : 1;
    travel.current += e.deltaY * unit;

    if (Math.abs(travel.current) < WHEEL_THRESHOLD) return;
    if (now - lastStep.current < STEP_COOLDOWN_MS) return;

    lastStep.current = now;
    move(travel.current > 0 ? 1 : -1);
    travel.current = 0;
  };

  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => {
        setHover(false);
        setHeld(null);
      }}
      // Safe to leave the event un-cancelled: from `md` up — the only place
      // this is visible — the room does not scroll, so there is nothing to
      // swallow from the page.
      onWheel={spin}
      className={`pointer-events-none absolute bottom-0 z-20 hidden h-[22rem] w-[27rem] md:block ${
        side === "left" ? "left-6" : "right-6"
      }`}
    >
      <div
        className={`pointer-events-auto absolute top-2 flex items-center gap-2.5 ${
          side === "left" ? "left-2" : "right-2 flex-row-reverse"
        }`}
      >
        <span className="spec text-ink-2">{title.toUpperCase()}</span>
        {garments.length > 0 && (
          <span className="spec-sm text-ink-3">
            {String(index + 1).padStart(2, "0")}/
            {String(garments.length).padStart(2, "0")}
          </span>
        )}
      </div>

      {garments.length === 0 ? (
        <p
          className={`absolute bottom-20 w-[15rem] text-ink-3 ${
            side === "left" ? "left-2 text-left" : "right-2 text-right"
          }`}
        >
          <span className="aside block text-[1.15rem] leading-tight">{empty}.</span>
          <span className="mt-1.5 block text-[0.76rem] leading-relaxed">
            {side === "left" ? (
              <>Try something on from a shop page and it lands here.</>
            ) : (
              <>
                <Link
                  href="/wardrobe"
                  className="pointer-events-auto text-ink underline decoration-madder underline-offset-4"
                >
                  Add clothes
                </Link>{" "}
                from your photos.
              </>
            )}
          </span>
        </p>
      ) : (
        <>
          {/* The hub. Everything on the rim is positioned from this one point,
              which is what makes the whole thing turn together. */}
          <div
            className="absolute"
            style={{
              left: side === "left" ? "42%" : "58%",
              // Below the floor of the room, so we only ever see the top of it.
              top: `calc(100% + ${RADIUS - 300}px)`,
              perspective: "1400px",
            }}
          >
            {garments.map((g, i) => {
              let offset = i - index;
              const half = garments.length / 2;
              if (offset > half) offset -= garments.length;
              if (offset < -half) offset += garments.length;

              const far = Math.abs(offset);
              if (far > ARC) return null;

              // The wheel leans out of the corner, so the hand opens toward
              // the middle of the room instead of straight up.
              const angle = mirror * (offset * STEP - 14);
              const lifted = held === g.id;

              return (
                <button
                  key={g.id}
                  type="button"
                  disabled={disabled}
                  onMouseEnter={() => setHeld(g.id)}
                  onFocus={() => setHeld(g.id)}
                  onBlur={() => setHeld(null)}
                  onClick={() => onPick(g)}
                  aria-label={`Put on ${g.name}`}
                  className="pointer-events-auto absolute bottom-0 left-0 w-[13.5rem] cursor-pointer disabled:cursor-default"
                  style={{
                    // rotate → out along the spoke → centre the card on the rim
                    // and stand it on that point. Order matters: every translate
                    // after the rotate happens in the rotated frame, which is
                    // exactly what keeps the cards radial.
                    transform: [
                      `rotate(${angle}deg)`,
                      `translateY(${-RADIUS - (lifted ? 46 : 0)}px)`,
                      "translateX(-50%)",
                      "translateY(100%)",
                      `scale(${lifted ? 1.1 : 1 - far * 0.035})`,
                    ].join(" "),
                    transformOrigin: "0 0",
                    // Monotonic along the rim, the way a real hand of cards
                    // stacks — each card is covered by exactly one neighbour,
                    // so every card exposes a strip of the same width. Peaking
                    // the z-order at the front instead put that one card on top
                    // of both its neighbours, and it ended up owning fifteen
                    // times its share of the pointer.
                    zIndex: lifted ? 30 : 20 - (offset + ARC),
                    // The cards at the ends of the rim sit back, but a card
                    // you are pointing at is never faded — you are looking at
                    // it, so it is not scenery any more.
                    opacity: lifted ? 1 : far > ARC - 1 ? 0.4 : 1,
                    transition: `transform ${SPIN_MS}ms var(--ease-cloth), opacity 520ms var(--ease-cloth)`,
                  }}
                >
                  <Card garment={g} lifted={lifted} openSlots={openSlots} />
                </button>
              );
            })}
          </div>

          {/* Arrows only while the wheel is under the pointer, as asked — and
              reachable by keyboard through focus-within regardless. */}
          <div
            className={`pointer-events-none absolute bottom-1 z-30 flex gap-1.5 transition-opacity duration-300 ${
              side === "left" ? "left-2" : "right-2"
            } ${hover ? "opacity-100" : "opacity-0 focus-within:opacity-100"}`}
          >
            {([-1, 1] as const).map((by) => (
              <button
                key={by}
                type="button"
                disabled={disabled}
                onClick={() => move(by)}
                aria-label={by < 0 ? `Turn ${title} back` : `Turn ${title} on`}
                className="pointer-events-auto flex h-9 w-9 items-center justify-center border border-ink bg-paper/90 text-ink shadow-[0_8px_20px_-10px_rgba(20,18,14,.7)] backdrop-blur-sm transition-colors duration-200 hover:bg-ink hover:text-paper disabled:opacity-40"
              >
                <span className="spec leading-none">{by < 0 ? "‹" : "›"}</span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

/**
 * One card on the wheel — the same plate the closet hangs, on its side.
 *
 * It used to be its own thing: a paper card with a cropped photograph and a
 * swatch chip. Two card designs for the same object in the same product is one
 * too many, and the wheel's version was the weaker of the pair — a beige card
 * behind a garment drawn on transparency is a beige card. `GarmentPlate` takes
 * its colour from the piece, so a wheel of them is a wheel of colours rather
 * than a stack of beige rectangles.
 */
function Card({
  garment,
  lifted,
  openSlots,
}: {
  garment: Garment;
  lifted: boolean;
  openSlots: Set<SlotId>;
}) {
  const slot = slotFor(garment);
  const blocked = slot !== null && !openSlots.has(slot);

  return (
    <div
      className="relative flex flex-col border-2 border-abyss text-left"
      style={{
        boxShadow: lifted
          ? "0 34px 58px -20px rgba(14,44,57,.7)"
          : "0 14px 28px -16px rgba(14,44,57,.5)",
        transition: "box-shadow 640ms var(--ease-cloth)",
      }}
    >
      <span className="absolute inset-x-0 top-0 z-[4] h-[3px] bg-madder" />

      <div className="relative aspect-[4/5]">
        <GarmentPlate garment={garment} />
        {blocked && (
          <span className="absolute inset-0 z-[4] flex items-end bg-abyss/65 p-2">
            <span className="spec-sm text-leaf">NOT IN FRAME</span>
          </span>
        )}
      </div>

      {/* The card under the pointer is the one that says what clicking does —
          it follows the hand, not a fixed position on the wheel. */}
      <div
        className={`overflow-hidden transition-[max-height] duration-500 ${
          blocked ? "bg-madder text-leaf" : "bg-abyss text-leaf"
        } ${lifted ? "max-h-9" : "max-h-0"}`}
        style={{ transitionTimingFunction: "var(--ease-cloth)" }}
      >
        <span className="spec block px-2.5 py-2">
          {blocked ? "Can't wear this" : "Put it on →"}
        </span>
      </div>
    </div>
  );
}
