"use client";

import {
  motion,
  useMotionTemplate,
  useMotionValue,
  useSpring,
  useTransform,
} from "motion/react";
import Image from "next/image";
import { useCallback, useRef } from "react";

import { INK, halftone } from "@/lib/ornament";
import { tintOf, tintOfDark } from "@/lib/tint";
import { ZONE_LABEL, type Garment } from "@/lib/types";

/**
 * One garment, on a card the colour of itself.
 *
 * ── 3D Tilted Card & Parallax ─────────────────────────────────────────────
 *
 * Implements full 3D perspective tilting, specular glare sheen, and multi-plane
 * Z-depth. Pointer coordinates calculate responsive rotateX / rotateY and a
 * dynamic light-bounce highlight.
 *
 *   1. the card    — base plate with halftone ink dots (Z: 0..2px)
 *   2. the wash    — inset panel with radial dye vignette (Z: 14px)
 *   3. the garment — cutout artwork floating with deep shadow (Z: 28px)
 *   4. the caption — typographic spec and badge (Z: 18px)
 *   5. the sheen   — specular glare tracking pointer (Z: 32px)
 */
const IDENTITY_LINES = [
  "PINKSHI",
  "RTPINKS",
  "HIRTPIN",
  "KSHIRTP",
  "INKSHIR",
  "TPINKSH",
  "IRTPINK",
  "SHIRTPI",
  "NKSHIRT",
  "PINKSHI",
  "RTPINKS",
];

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
  interactive?: boolean;
  className?: string;
}) {
  const t = dark ? tintOfDark(garment.dye.hex) : tintOf(garment.dye.hex);

  // Continuous repeating text for natural typographic texture wrap
  const repeatingText = "PINKSHIRT".repeat(40);

  return (
    <div className={`relative h-full w-full select-none ${className}`}>
      <article className="relative flex h-full w-full flex-col overflow-hidden rounded-t-[40px] sm:rounded-t-[48px] rounded-b-[8px] border-2 border-[#12100d] bg-[#C6827E] shadow-[4px_4px_0px_#12100d] sm:shadow-[4px_4px_0px_#12100d]">
        {/* Left eyelet punched hole with shadow and thread */}
        <div
          aria-hidden
          className="pointer-events-none absolute left-[19%] top-[8%] z-[22] -ml-2 -mt-2 flex h-4 w-4 items-center justify-center rounded-full border border-white/20 bg-[#12100d] shadow-[inset_0_2px_4px_rgba(0,0,0,0.95),0_1px_2px_rgba(0,0,0,0.5)] sm:h-5 sm:w-5"
        >
          <div className="h-2.5 w-0.5 rounded-full bg-white shadow-sm" />
        </div>

        {/* Right eyelet punched hole with shadow and thread */}
        <div
          aria-hidden
          className="pointer-events-none absolute right-[19%] top-[8%] z-[22] -mr-2 -mt-2 flex h-4 w-4 items-center justify-center rounded-full border border-white/20 bg-[#12100d] shadow-[inset_0_2px_4px_rgba(0,0,0,0.95),0_1px_2px_rgba(0,0,0,0.5)] sm:h-5 sm:w-5"
        >
          <div className="h-2.5 w-0.5 rounded-full bg-white shadow-sm" />
        </div>

        {/* Inner Inset Panel behind the shirt */}
        <div className="relative m-[3.5%] mb-0 flex-1 overflow-hidden rounded-t-[32px] sm:rounded-t-[40px] rounded-b-[4px] border border-[#12100d]/20 bg-gradient-to-b from-[#D6928E] to-[#C27A76]">
          {/* Continuous Identity text wrapped and cropped by frame edges */}
          <div
            aria-hidden
            className="pointer-events-none absolute -inset-x-1 inset-y-0 z-[1] flex overflow-hidden p-1 select-none opacity-50 mix-blend-overlay"
          >
            <p className="font-identity text-[2.2rem] sm:text-[1.8rem] font-normal leading-[0.76] tracking-tighter uppercase text-white break-all">
              {repeatingText}
            </p>
          </div>

          {/* Plane 3: Cutout garment artwork floating centered */}
          <div className="relative z-[10] h-full w-full">
            <Image
              src="/seed/Pink Shirt.png"
              alt={garment.name}
              fill
              sizes="(max-width: 768px) 45vw, 22vw"
              priority={priority}
              className="object-contain p-[6%] drop-shadow-[0_14px_24px_rgba(18,16,13,0.42)]"
              unoptimized
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

        {/* Bottom labels: Category in Iosevka Nerd Font, Title in FridayNightLights */}
        {showName && (
          <div className="relative z-[18] px-[6%] pb-[5%] pt-[3%]">
            <p className="font-iosevka text-[0.75rem] sm:text-[0.85rem] font-bold tracking-[0.16em] uppercase text-[#2f1714]/85">
              SHIRTS
            </p>
            <h3
              className="font-friday mt-0.5 truncate text-[1.35rem] sm:text-[1.75rem] leading-tight tracking-[0.01em] uppercase text-white drop-shadow-[0_1px_3px_rgba(18,16,13,0.5)]"
              title="PINK SHIRT"
            >
              PINK SHIRT
            </h3>
          </div>
        )}
      </article>
    </div>
  );
}

/**
 * Dual front and back hanging string suspension lines.
 * Back cables drop behind the card; front cables hook over the rod and dip into the eyelet holes.
 */
export function Hanger({ tone = "#EDE7DA" }: { tone?: string }) {
  return (
    <div className="relative h-11 w-full overflow-visible">
      {/* Back cable layer sitting behind card */}
      <svg
        aria-hidden
        viewBox="0 0 100 44"
        preserveAspectRatio="none"
        className="pointer-events-none absolute inset-0 z-[1] block h-full w-full overflow-visible"
      >
        <g
          fill="none"
          stroke="#B5ADA0"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M50 8 L19 44" />
          <path d="M50 8 L81 44" />
        </g>
      </svg>

      {/* Front cable layer with brass hook on the rail */}
      <svg
        aria-hidden
        viewBox="0 0 100 44"
        preserveAspectRatio="none"
        className="pointer-events-none absolute inset-0 z-[20] block h-full w-full overflow-visible"
      >
        <g
          fill="none"
          stroke={tone}
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          {/* Top brass hook sitting over the rod */}
          <path
            d="M50 8 V2 a4 4 0 1 0 -4 -4"
            stroke={INK.brass}
            strokeWidth="2.6"
          />
          {/* Front white hanging lines entering the two holes */}
          <path
            d="M50 8 L19 44"
            stroke="#FFFFFF"
            className="drop-shadow-[0_1px_2px_rgba(0,0,0,0.35)]"
          />
          <path
            d="M50 8 L81 44"
            stroke="#FFFFFF"
            className="drop-shadow-[0_1px_2px_rgba(0,0,0,0.35)]"
          />
        </g>
      </svg>
    </div>
  );
}
