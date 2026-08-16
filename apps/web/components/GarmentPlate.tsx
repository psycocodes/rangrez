"use client";

import Image from "next/image";

import { INK, halftone } from "@/lib/ornament";
import { tintOf, tintOfDark } from "@/lib/tint";
import { ZONE_LABEL, type Garment } from "@/lib/types";

/**
 * One garment, on a card the colour of itself.
 *
 * This is the atom of the whole redesign — it appears on the rail in the
 * closet, on the wheels in the dashboard, and stacked on the shelf. Which is
 * exactly why it takes no layout opinions: no margin, no position, no width
 * beyond what it is given. It fills its parent and nothing else.
 *
 * ── the three planes ─────────────────────────────────────────────────────
 *
 * A flat card with a picture on it looks like a div. The reference has three
 * planes and so does this:
 *
 *   1. the card    — the garment's colour at 88% lightness, the outermost
 *   2. the wash    — a half-step darker, inset, the panel the piece lies in
 *   3. the garment — sitting proud of the wash with its own shadow
 *
 * That inset alone does most of the work of making it read as a printed card
 * rather than a coloured rectangle.
 */
export function GarmentPlate({
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

  return (
    <article
      className={`relative flex h-full w-full flex-col overflow-hidden ${className}`}
      style={{ background: t.card, color: t.ink }}
    >
      {/* The dot screen. Multiplied over the card's own colour so it darkens
          the ink rather than fogging it grey — this is the difference between
          "printed" and "a div with a texture on it". */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 z-[3] mix-blend-multiply opacity-30"
        style={{ backgroundImage: `url("${halftone(t.ink, 0.06, 7)}")` }}
      />

      {/* plane two: the panel */}
      <div
        className="relative m-[6%] mb-0 flex-1 overflow-hidden rounded-[3px]"
        style={{
          background: `radial-gradient(120% 90% at 50% 18%, ${t.card}, ${t.wash} 78%)`,
        }}
      >
        <Image
          src={garment.imageUrl}
          alt={garment.name}
          fill
          sizes="(max-width: 768px) 45vw, 22vw"
          priority={priority}
          // Contained, not covered: a garment cropped by its own card is a
          // garment you cannot identify, and identifying it is the card's job.
          className="object-contain p-[4%] drop-shadow-[0_10px_18px_rgba(20,18,14,0.18)]"
          unoptimized={garment.imageUrl.startsWith("data:")}
        />

        {garment.inPalette && (
          <span
            title="Inside your colour season"
            className="absolute right-1.5 top-1.5 z-[2] text-[0.6rem] leading-none"
            style={{ color: t.edge }}
          >
            ✦
          </span>
        )}
      </div>

      {/* plane one: the caption, printed straight onto the card */}
      {showName && (
        <div className="relative z-[2] px-[7%] pb-[6%] pt-[4%]">
          <p className="spec-sm" style={{ color: t.edge }}>
            {ZONE_LABEL[garment.zone]}
          </p>
          <h3
            className="aside mt-1 truncate text-[clamp(0.8rem,1.5vw,1.05rem)] leading-tight"
            title={garment.name}
          >
            {garment.name}
          </h3>
          {garment.sizeLabel && (
            <span
              className="spec-sm absolute bottom-[6%] right-[7%] border px-1.5 py-1"
              style={{ borderColor: t.edge }}
            >
              {garment.sizeLabel.toUpperCase()}
            </span>
          )}
        </div>
      )}
    </article>
  );
}

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
