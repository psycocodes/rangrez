"use client";

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
  className = "",
}: {
  garment: Garment;
  /** Invert the family for a dark room — see tintOfDark. */
  dark?: boolean;
  showName?: boolean;
  priority?: boolean;
  className?: string;
}) {
  const t = dark ? tintOfDark(garment.dye.hex) : tintOf(garment.dye.hex);

  // No spaces and no punctuation, so the line breaks fall mid-word and each
  // line starts on a different letter — that offset *is* the pattern. Set as
  // one string rather than one node per repeat: a wrapped string breaks
  // wherever the measure runs out, whereas separate nodes would break at the
  // same place every time and stack into columns.
  const word = garment.name.toUpperCase().replace(/[^A-Z0-9]/g, "");
  const chant = word
    ? word.repeat(Math.max(2, Math.ceil(FILL_CHARS / word.length)))
    : "";

  // Set in caps rather than relying on the face having no lowercase, so the
  // string measured is the string drawn.
  const title = layoutTitle(garment.name.toUpperCase());

  // The lightbox and the look slots want the piece, not the poster: no
  // caption, no forced proportion, just the panel filling whatever box it was
  // handed. Only the full card claims the design's aspect.
  const poster = showName;

  return (
    <article
      className={`relative overflow-hidden ${poster ? "" : "h-full w-full"} ${className}`}
      style={{
        containerType: "inline-size",
        // Nothing inside a card ever draws outside it, and saying so lets the
        // browser treat the card as its own paint unit. Without it a repaint
        // here is allowed to dirty whatever is behind — on the look creator
        // that is a full-bleed block-print ground and a large blurred floor
        // light, both of which cost far more to repaint than the card does.
        contain: "paint",
        aspectRatio: poster ? "1063 / 1752" : undefined,
        // The card's field is the *deeper* of the two tints and the panel
        // inside it is the lighter one — which is the way round the reference
        // has it, and the opposite of what this card used to do. A pale card
        // holding a darker panel reads as a hole; this reads as a mount.
        background: t.wash,
        color: t.ink,
      }}
    >
      {/* ── the panel, and the name printed across it ─────────────────── */}
      <div
        className="absolute overflow-hidden"
        style={
          poster
            ? { left: w(55), top: w(54), width: w(950), height: w(1109), background: t.card }
            : { inset: "5%", background: t.card }
        }
      >
        {/* Wider than the panel and starting above it, so the letters run off
            all four edges. Cropped lettering reads as a printed ground; the
            same lettering fitted inside the panel reads as a caption. */}
        <p
          aria-hidden
          className="absolute text-center"
          style={{
            left: w(-72),
            top: w(-45),
            width: w(1253),
            fontFamily: "var(--font-fingerprint)",
            fontSize: w(170.621),
            lineHeight: 1,
            letterSpacing: "0.01em",
            overflowWrap: "anywhere",
            // The alpha is in the colour, never on the element — see the note
            // on `complement` in lib/tint.ts.
            color: t.complement,
          }}
        >
          {chant}
        </p>
      </div>

      {/* ── the garment, sitting proud of the panel ─────────────────────
          The reference's 849 × 982 at (105, 117), grown 8% about its own
          centre. That still leaves about 16px of panel either side at the
          reference size, so the piece never touches the panel's edge — but
          it is the thing you are meant to be looking at, and at the drawn
          size it was sitting too far inside its own mount. */}
      <div
        className="absolute"
        style={
          poster
            ? { left: w(71), top: w(78), width: w(917), height: w(1061) }
            : { inset: "7%" }
        }
      >
        <Image
          src={garment.imageUrl}
          alt={garment.name}
          fill
          sizes="(max-width: 768px) 45vw, 22vw"
          priority={priority}
          // Contained, not covered: a garment cropped by its own card is a
          // garment you cannot identify, and identifying it is the card's job.
          // No cast shadow — the reference has none, and the lettering has to
          // stay legible right up to the garment's edge for the two planes to
          // read as printed rather than stacked.
          className="object-contain"
          unoptimized={garment.imageUrl.startsWith("data:")}
        />

        {garment.inPalette && (
          <span
            title="Inside your colour season"
            className="absolute right-0 top-0 z-[2] leading-none"
            style={{ color: t.mark, fontSize: w(34) }}
          >
            ✦
          </span>
        )}
      </div>

      {/* ── the caption, printed straight onto the card ───────────────── */}
      {poster && (
        <>
          <p
            className="absolute whitespace-nowrap"
            style={{
              left: w(36),
              top: w(1184),
              fontFamily: "var(--font-label)",
              fontSize: w(63.562),
              lineHeight: 1,
              letterSpacing: "0.01em",
              color: t.mark,
            }}
          >
            {ZONE_LABEL[garment.zone].toUpperCase()}
          </p>

          {/* Broken where layoutTitle decided, never by the browser: at this
              size the face overflows its own line box, so a wrap the layout
              didn't measure would set one line through another. */}
          <p
            className="absolute"
            style={{
              left: w(36),
              top: w(TITLE_CAP_TOP - title.size * TITLE_INK_OFFSET),
              width: w(TITLE_BOX),
              fontFamily: "var(--font-block)",
              fontSize: w(title.size),
              lineHeight: TITLE_LEADING,
              letterSpacing: `${TITLE_TRACKING}em`,
              color: "rgba(255,255,255,0.7)",
            }}
          >
            {title.lines.map((line) => (
              <span key={line} className="block whitespace-nowrap">
                {line}
              </span>
            ))}
          </p>
        </>
      )}
    </article>
  );
});

/**
 * The same card, hanging.
 *
 * A hook and a shoulder line, drawn above the plate — so on the rail the piece
 * reads as *hung* rather than as a card that happens to be near a rod. The
 * swing itself is the caller's business (see the closet); this only draws the
 * hardware.
 */
export function Hanger({ tone = INK.brass }: { tone?: string }) {
  // Drawn as one SVG rather than assembled from bordered spans. The first
  // attempt built the shoulders out of a clip-pathed box, and a clip-path over
  // a border produces the two edges of the box, not the two arms of a hanger —
  // on screen it was a hook floating above nothing.
  return (
    <svg
      aria-hidden
      viewBox="0 0 100 36"
      preserveAspectRatio="xMidYMax meet"
      className="block h-9 w-full overflow-visible"
    >
      <g
        fill="none"
        stroke={tone}
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {/* The hook, opening to the right the way a real one does. */}
        <path d="M50 15 V9 a5 5 0 1 0 -5 -5" />
        {/* Shoulders and the bar across them. */}
        <path d="M50 15 L14 31 H86 Z" />
      </g>
    </svg>
  );
}
