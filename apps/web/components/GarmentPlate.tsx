"use client";

import {
  motion,
  useMotionTemplate,
  useMotionValue,
  useSpring,
  useTransform,
} from "motion/react";
import Image from "next/image";
import { memo } from "react";

import { INK } from "@/lib/ornament";
import { tintOf, tintOfDark } from "@/lib/tint";
import { ZONE_LABEL, type Garment } from "@/lib/types";

/**
 * ═══════════════════════════════════════════════════════════════════════════
 *  One garment, on a card the colour of itself
 * ═══════════════════════════════════════════════════════════════════════════
 *
 *  A port of `Card - Casual` (Figma node 68:247) — the rail, the shelf, the
 *  look slots and the lightbox all show this, so it takes no layout opinions:
 *  it fills the width it is given and holds the design's 1063 × 1752.
 *
 *  ── everything is a share of the card's width ────────────────────────────
 *
 *  Every number below is a Figma pixel over 1063, written in `cqw`, against
 *  `container-type: inline-size` on the article itself. That is the whole
 *  sizing strategy and it is deliberate: the design has four elements whose
 *  relationship to each other is the design — lettering bleeding out of a
 *  panel, a garment sitting proud of it, a title that overflows its own line
 *  box — and clamps or breakpoints would let them drift apart at some size
 *  nobody checked. In `cqw` the 200px card in a look slot and the 1063px card
 *  in the reference are the same drawing.
 *
 *  ── the two oversized faces ──────────────────────────────────────────────
 *
 *  Neither font-size below can be read as a height on screen; see the note in
 *  app/layout.tsx. Scholar Block draws caps at 2.13em, so the title's 6.34cqw
 *  stands about 13.5cqw tall and hangs outside its own box. Identity draws
 *  fingerprints inside its letterforms, which is why the texture behind the
 *  garment is typeset rather than a background image — it spells the garment's
 *  own name, and re-wraps per card, so no two cards carry the same pattern.
 * ═══════════════════════════════════════════════════════════════════════════
 */

/** Figma px over the 1063px card, as a container-width percentage. */
const w = (px: number) => `${((px / 1063) * 100).toFixed(3)}cqw`;

/**
 * How much lettering to set behind the garment.
 *
 * The reference runs "PINKSHIRT" seven times — 63 characters, which fills the
 * panel to just past its bottom edge at the design's size. Names here vary
 * from "SHOES" to "WIDELEGPLEATEDTROUSER", so the repeat count is derived from
 * that character budget rather than fixed. Overshooting is free (the panel
 * clips); undershooting leaves a bald patch at the bottom of the panel, so the
 * target is set a little above what the reference needs.
 */
const FILL_CHARS = 80;

/* ── fitting the title ───────────────────────────────────────────────────
   Scholar Block advance widths in em, read out of the font's own hmtx. They
   run 1.0–2.9em because the glyphs are drawn at twice their em box, and they
   are here because the title has to fit the card and there is nothing else to
   measure it with: this is a server component, so there is no element to ask.

   The design's own string checks the model — "PINK SHIRT" sums to 15.653em,
   less 0.05em of tracking per character is 15.153em, and at the specified
   67.34px that is 1020px. The browser measures the same string at 15.132em,
   so the table is good to about a sixth of a percent.

   1020 is therefore the measure, not the 1058 on the Figma text node: that
   node starts at x=36 and so runs 31px past the right edge of its own 1063
   frame. Only "PINK SHIRT" is short enough not to notice. Fitting to 1058
   clipped the last letter off two thirds of the wardrobe — and fitting to
   1020 costs nothing, because it is what the reference actually occupies. */

const ADVANCE: Record<string, number> = {
  " ": 1.121, A: 2.145, B: 1.722, C: 1.646, D: 1.648, E: 1.576, F: 1.664,
  G: 1.702, H: 2.158, I: 1.014, J: 1.592, K: 1.732, L: 1.541, M: 2.206,
  N: 1.857, O: 1.617, P: 1.642, Q: 1.79, R: 1.743, S: 1.603, T: 1.769,
  U: 1.845, V: 1.974, W: 2.949, X: 1.913, Y: 2.028, Z: 1.572, "0": 1.64,
  "1": 1.058, "2": 1.608, "3": 1.613, "4": 1.613, "5": 1.576, "6": 1.531,
  "7": 1.557, "8": 1.552, "9": 1.523, "-": 1.183, "'": 0.322, "&": 1.125,
  ".": 0.321,
};

/** Mean of A–Z, for anything the table doesn't carry. */
const ADVANCE_FALLBACK = 1.794;

const TITLE_BOX = 1005;
const TITLE_MAX = 67.34;
const TITLE_TRACKING = -0.05;

/**
 * Line spacing, in ems.
 *
 * 2.128 of that is cap, so anything near the 1.0 a normal face wants would
 * set the second line straight through the first. 2.5 leaves a little under
 * four tenths of a cap between them, which at this weight is the right amount
 * of light — a slab this heavy closes up if you give it any less.
 */
const TITLE_LEADING = 2.5;

/**
 * Where the first line's capitals land, in Figma pixels down the card.
 *
 * Positioning this block by the top of its line box does not survive a change
 * of size or leading — the ink floats inside the box, so a smaller or broken
 * title slides up under the category line, which is exactly what it did. The
 * cap line is what a reader sees, so that is what is held still.
 *
 * Derived, not eyeballed. The browser reports Scholar Block's content area as
 * 2.770em above the baseline and 0.810 below (3.580 in total — the font's own
 * bounding box) and its capitals as 2.132em. For a line box of `lead` ems the
 * half-leading is (lead − 3.580)/2, so
 *
 *     cap top = box top + size · [ (lead − 3.580) / 2 + 2.770 − 2.132 ]
 *
 * At the reference's 1232, 67.34px and `normal` leading — where the box *is*
 * the content area, so the bracket is just 0.638 — that puts the capitals at
 * 1275, and every other size and break is placed to agree with it.
 */
const TITLE_CAP_TOP = 1275;

/** The bracket above, for the leading this actually sets. */
const TITLE_INK_OFFSET = (TITLE_LEADING - 3.58) / 2 + 0.638;

/** Width of `text` in ems, tracking included. */
function widthOf(text: string): number {
  return (
    [...text].reduce((sum, c) => sum + (ADVANCE[c] ?? ADVANCE_FALLBACK), 0) +
    TITLE_TRACKING * text.length
  );
}

/**
 * The name, set as large as it will go — over two lines if that buys anything.
 *
 * A wardrobe is full of three-word names, and on one line "Tailored Wool
 * Trouser" has to shrink to under half the design's size to fit the card. The
 * design is a title that *fills* the card, so the fix is to break it rather
 * than to keep shrinking: broken at its most even space, that same name sets
 * at 56 against 30, and reads like the reference again.
 *
 * One line is still preferred, and a name that fits at full size never breaks
 * — so "Pink Shirt" lands on 67.34px on one line, exactly as drawn. The break
 * has to earn itself: a split that gains less than a sixth isn't worth the
 * second line.
 */
function layoutTitle(text: string): { lines: string[]; size: number } {
  const one = TITLE_BOX / Math.max(widthOf(text), 1);
  if (one >= TITLE_MAX) return { lines: [text], size: TITLE_MAX };

  // The most even break available, measured — not the middle character, which
  // on a name like "Boxy Heavyweight Tee" splits inside the long word's worth
  // of ink and leaves one line twice the other.
  let best: { lines: string[]; size: number } | null = null;
  for (let i = 0; i < text.length; i++) {
    if (text[i] !== " ") continue;
    const head = text.slice(0, i);
    const tail = text.slice(i + 1);
    const size = TITLE_BOX / Math.max(widthOf(head), widthOf(tail), 1);
    if (!best || size > best.size) best = { lines: [head, tail], size };
  }

  // Compared *after* the ceiling, not before. "PINK SHIRT" gains almost
  // twofold on paper by breaking after the space, and gains nothing at all in
  // fact — both layouts are already pinned at the maximum — so comparing the
  // uncapped numbers broke the one name the design is drawn around.
  const two = Math.min(TITLE_MAX, best?.size ?? 0);
  if (!best || two < one * 1.16) return { lines: [text], size: one };
  return { lines: best.lines, size: two };
}

/**
 * Memoised, and not as a precaution.
 *
 * This is the most expensive thing on either page to render: a container
 * query, eighty characters of a 170px display face that re-wraps to fill the
 * panel, and an image. The look creator's hands re-render on every hover —
 * that is how the push knows where your pointer is — and re-rendering five of
 * these on each pointer move was the whole of the choppiness. None of the
 * props move when a sibling is hovered, so the plate can sit the change out.
 */
export const GarmentPlate = memo(function GarmentPlate({
  garment,
  dark = false,
  showName = true,
  priority = false,
  variant = "standard",
  className = "",
}: {
  garment: Garment;
  /** Invert the family for a dark room — see tintOfDark. */
  dark?: boolean;
  showName?: boolean;
  priority?: boolean;
  interactive?: boolean;
  variant?: "standard" | "short" | "shoe";
  className?: string;
}) {
  const t = dark ? tintOfDark(garment.dye.hex) : tintOf(garment.dye.hex);

  // Auto-detect layout mode
  const isShoe = variant === "shoe" || garment.zone === "shoes";
  const isShort = variant === "short";

  // Maximum 12 characters for garment names
  const displayName =
    garment.name.length > 12 ? garment.name.slice(0, 12).trim() : garment.name;

  // Derive continuous repeating text to fill the background box
  const word = (displayName || "PINKSHIRT").toUpperCase().replace(/[^A-Z0-9]/g, "") || "PINKSHIRT";
  const chant = word.repeat(Math.max(2, Math.ceil(FILL_CHARS / word.length)));

  const titleWords = displayName.toUpperCase().split(" ");
  const poster = showName;

  /* ── 1. SHOE CARD LAYOUT (Figma Node: Card - Shoe - Wardrobe - Front) ── */
  if (isShoe) {
    return (
      <article
        className={`relative flex flex-col overflow-hidden rounded-[24px] border-[3px] border-[#12100d] shadow-[4px_4px_0px_#12100d] ${
          poster ? "h-full w-full" : "h-full w-full"
        } ${className}`}
        style={{
          containerType: "inline-size",
          contain: "paint",
          aspectRatio: "1.45 / 1",
          background: t.wash,
          color: t.ink,
        }}
      >
        {/* Top/Center Stadium Pill Wash Panel */}
        <div
          className="relative m-[3.5%] mb-0 h-[68%] overflow-hidden rounded-[18px] border-2 border-[#12100d]/30"
          style={{ background: t.card }}
        >
          {/* Repeating Identity watermark scaling in cqw */}
          <p
            aria-hidden
            className="absolute text-center select-none pointer-events-none"
            style={{
              left: w(-72),
              top: w(-45),
              width: w(1253),
              fontFamily: "var(--font-identity)",
              fontSize: w(170.621),
              lineHeight: 1,
              letterSpacing: "0.01em",
              overflowWrap: "anywhere",
              color: t.complement,
            }}
          >
            {chant}
          </p>

          {/* Shoe cutout artwork floating centered */}
          <div className="relative z-[10] h-full w-full">
            <Image
              src={garment.imageUrl}
              alt={displayName}
              fill
              sizes="(max-width: 768px) 45vw, 22vw"
              priority={priority}
              className="object-contain p-[6%] drop-shadow-[0_12px_18px_rgba(18,16,13,0.38)]"
              unoptimized={garment.imageUrl.startsWith("data:")}
            />
          </div>
        </div>

        {/* Bottom Title Line & Zone */}
        {poster && (
          <div className="relative z-[18] flex flex-1 items-center justify-between px-[6%] pb-[2%] pt-[1%]">
            <span
              className="font-iosevka font-bold tracking-[0.14em] uppercase text-[#2f1714]/80"
              style={{ fontSize: "clamp(0.62rem, 3.8cqw, 0.85rem)" }}
            >
              SHOES
            </span>
            <h3
              className="font-friday truncate leading-none tracking-[0.01em] uppercase text-white"
              style={{ fontSize: "clamp(1.1rem, 7.5cqw, 1.7rem)" }}
              title={displayName}
            >
              {displayName}
            </h3>
          </div>
        )}
      </article>
    );
  }

  /* ── 2. SHORT HORIZONTAL CARD LAYOUT (Card - Casual - Wardrobe - Front - Shoertest) ── */
  if (isShort) {
    return (
      <article
        className={`relative flex flex-row items-center overflow-hidden rounded-tl-[48px] rounded-bl-[48px] rounded-tr-[48px] rounded-br-[18px] border-2 border-[#12100d] shadow-[3px_3px_0px_#12100d] sm:shadow-[4px_4px_0px_#12100d] p-[2.5%] gap-[3.5%] ${
          poster ? "h-full w-full" : "h-full w-full"
        } ${className}`}
        style={{
          containerType: "inline-size",
          contain: "paint",
          aspectRatio: poster ? "1.58 / 1" : undefined,
          background: t.wash,
          color: t.ink,
        }}
      >
        {/* Left Side Vertical Pill Stadium Panel */}
        <div
          className="relative h-full w-[44%] shrink-0 overflow-hidden rounded-[34px] border border-[#12100d]/20"
          style={{ background: t.card }}
        >
          <p
            aria-hidden
            className="absolute text-center select-none pointer-events-none"
            style={{
              left: w(-72),
              top: w(-45),
              width: w(1253),
              fontFamily: "var(--font-identity)",
              fontSize: w(170.621),
              lineHeight: 1,
              letterSpacing: "0.01em",
              overflowWrap: "anywhere",
              color: t.complement,
            }}
          >
            {chant}
          </p>

          <div className="relative z-[10] h-full w-full">
            <Image
              src={garment.imageUrl}
              alt={displayName}
              fill
              sizes="(max-width: 768px) 45vw, 22vw"
              priority={priority}
              className="object-contain p-[5%] drop-shadow-[0_12px_20px_rgba(18,16,13,0.42)]"
              unoptimized={garment.imageUrl.startsWith("data:")}
            />
          </div>
        </div>

        {/* Right Side Stacked Category & Title */}
        {poster && (
          <div className="relative z-[18] flex flex-1 flex-col items-end justify-center pr-[7%] text-right">
            <p
              className="font-iosevka font-bold tracking-[0.16em] uppercase text-[#2f1714]/85 text-right mb-1"
              style={{ fontSize: "clamp(0.82rem, 5cqw, 1.2rem)" }}
            >
              {garment.zone === "top"
                ? "SHIRTS"
                : ZONE_LABEL[garment.zone]?.toUpperCase() || "PIECE"}
            </p>
            <div
              className="flex flex-col font-friday leading-[0.9] tracking-[0.01em] uppercase text-white text-right"
              style={{ fontSize: "clamp(1.45rem, 11.5cqw, 2.75rem)" }}
            >
              {titleWords.length > 1 ? (
                <>
                  <span>{titleWords[0]}</span>
                  <span>{titleWords.slice(1).join(" ")}</span>
                </>
              ) : (
                <span>{displayName}</span>
              )}
            </div>
          </div>
        )}
      </article>
    );
  }

  /* ── 3. STANDARD BIG LONG VERTICAL CARD LAYOUT (Card - Casual) ── */
  return (
    <article
      className={`relative flex flex-col overflow-hidden rounded-t-[44px] sm:rounded-t-[52px] rounded-b-[12px] sm:rounded-b-[14px] border-2 border-[#12100d] shadow-[3px_3px_0px_#12100d] sm:shadow-[4px_4px_0px_#12100d] ${
        poster ? "h-full w-full" : "h-full w-full"
      } ${className}`}
      style={{
        containerType: "inline-size",
        contain: "paint",
        aspectRatio: poster ? "1 / 1.65" : undefined,
        background: t.wash,
        color: t.ink,
      }}
    >
      {/* ── Inner Wash Panel (extended downwards) ── */}
      <div
        className="relative m-[2.2%] mb-0 flex-1 overflow-hidden rounded-t-[36px] sm:rounded-t-[44px] rounded-b-[6px] border border-[#12100d]/20"
        style={{ background: t.card }}
      >
        <p
          aria-hidden
          className="absolute text-center select-none pointer-events-none"
          style={{
            left: w(-72),
            top: w(-45),
            width: w(1253),
            fontFamily: "var(--font-identity)",
            fontSize: w(170.621),
            lineHeight: 1,
            letterSpacing: "0.01em",
            overflowWrap: "anywhere",
            color: t.complement,
          }}
        >
          {chant}
        </p>

        <div className="relative z-[10] h-full w-full">
          <Image
            src={garment.imageUrl}
            alt={displayName}
            fill
            sizes="(max-width: 768px) 45vw, 22vw"
            priority={priority}
            className="object-contain p-[5%] drop-shadow-[0_14px_24px_rgba(18,16,13,0.42)]"
            unoptimized={garment.imageUrl.startsWith("data:")}
          />
        </div>

        {garment.inPalette && (
          <span
            title="Inside your colour season"
            className="absolute right-2 top-2 z-[18] text-[0.7rem] leading-none"
            style={{ color: t.edge }}
          >
            ✦
          </span>
        )}
      </div>

      {/* ── Bottom labels aligned left with dynamic text ── */}
      {poster && (
        <div className="relative z-[18] px-[5%] pb-[3.5%] pt-[1.5%] text-left">
          <p
            className="font-iosevka font-bold tracking-[0.16em] uppercase text-[#2f1714]/85"
            style={{ fontSize: "clamp(0.68rem, 4.4cqw, 0.95rem)" }}
          >
            {garment.zone === "top"
              ? "SHIRTS"
              : ZONE_LABEL[garment.zone]?.toUpperCase() || "PIECE"}
          </p>
          <h3
            className="font-friday mt-0.5 whitespace-nowrap leading-tight tracking-[0.01em] uppercase text-white"
            style={{ fontSize: "clamp(1.1rem, 7.8cqw, 1.65rem)" }}
            title={displayName}
          >
            {displayName}
          </h3>
        </div>
      )}
    </article>
  );
});

/**
 * Clothing hanger with 3D shaded polished brown wood ball finial sitting on the brass rail.
 */
export function Hanger({ tone = "#7C4A27" }: { tone?: string }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 100 36"
      preserveAspectRatio="xMidYMax meet"
      className="relative z-[12] block h-9 w-full overflow-visible pointer-events-none"
    >
      <defs>
        {/* Warm Walnut / Teak Wood Spherical Radial Gradient with muted gloss */}
        <radialGradient id="woodBallGrad" cx="32%" cy="28%" r="68%">
          <stop offset="0%" stopColor="#E0B78B" />
          <stop offset="22%" stopColor="#C48E5A" />
          <stop offset="50%" stopColor="#96552B" />
          <stop offset="75%" stopColor="#693412" />
          <stop offset="92%" stopColor="#45200A" />
          <stop offset="100%" stopColor="#241004" />
        </radialGradient>
      </defs>

      <g fill="none" strokeLinecap="round" strokeLinejoin="round">
        {/* ── 1. Shaded 3D Brown Wood Ball resting on rail rod ── */}
        {/* Contact cast shadow on rod */}
        <ellipse cx="50" cy="15" rx="5.2" ry="1.6" fill="#12100d" opacity="0.6" />

        {/* Main 3D shaded wood ball with bold Neobrutalist outline */}
        <circle
          cx="50"
          cy="9.5"
          r="6.5"
          fill="url(#woodBallGrad)"
          stroke="#12100d"
          strokeWidth="1.8"
        />

        {/* Ambient bottom-right warm bounce rim reflection */}
        <path
          d="M52 14.6 A 5.5 5.5 0 0 0 55.5 9.5"
          stroke="#C48E5A"
          strokeWidth="0.8"
          opacity="0.35"
        />

        {/* Muted soft diffused gloss highlight glint */}
        <ellipse
          cx="47.8"
          cy="7.2"
          rx="1.7"
          ry="1.1"
          fill="#FFEFE0"
          opacity="0.3"
          transform="rotate(-15 47.8 7.2)"
        />

        {/* Matching wood collar mount connecting ball to wishbone */}
        <ellipse cx="50" cy="15.5" rx="3.5" ry="1.6" fill="#6E3816" stroke="#12100d" strokeWidth="1.2" />

        {/* ── 2. Wooden Hanger Contoured Wishbone Arms with bold neobrutalist line ── */}
        <path
          d="M10 28 C22 22 36 17 50 15.5 C64 17 78 22 90 28"
          stroke="#12100d"
          strokeWidth="4.6"
        />
        <path
          d="M10 28 C22 22 36 17 50 15.5 C64 17 78 22 90 28"
          stroke={tone}
          strokeWidth="3.2"
        />

        {/* ── 3. Dual Card Holding Clips (Neobrutalist Black & Brass) ── */}
        {/* Left Holding Clip */}
        <path d="M10 24 V34" stroke="#12100d" strokeWidth="4.4" />
        <path d="M10 24 V34" stroke="#FFDE59" strokeWidth="2.2" />
        <circle cx="10" cy="27" r="1.4" fill="#12100d" />

        {/* Right Holding Clip */}
        <path d="M90 24 V34" stroke="#12100d" strokeWidth="4.4" />
        <path d="M90 24 V34" stroke="#FFDE59" strokeWidth="2.2" />
        <circle cx="90" cy="27" r="1.4" fill="#12100d" />
      </g>
    </svg>
  );
}
