"use client";

import Image from "next/image";
import { useCallback, useState } from "react";

import { GarmentPlate } from "./GarmentPlate";
import { tintOf } from "@/lib/tint";
import type { Garment } from "@/lib/types";

/**
 * ═══════════════════════════════════════════════════════════════════════════
 *  A garment, and the same garment worn
 * ═══════════════════════════════════════════════════════════════════════════
 *
 *  Every piece in the wardrobe holds two pictures. The flat cutout says *what
 *  it is*; the render says *what it looks like on you*. The card shows the
 *  first and turns over to show the second, which is the whole product in one
 *  gesture — and it is a turn rather than a crossfade because these are two
 *  sides of one object, not two states of one image.
 *
 *  ── the card itself is untouched ────────────────────────────────────────
 *
 *  The front face is `GarmentPlate` exactly as it was. This wraps it rather
 *  than editing it: the plate is a faithful port of a Figma design and has no
 *  business growing a back.
 *
 *  ── on the render arriving late ─────────────────────────────────────────
 *
 *  A piece is saved, and the try-on is rendered behind it — thirty seconds of
 *  someone else's GPU. So a card may well be turned over before its back
 *  exists. Rather than refusing to turn, it turns and asks for the render
 *  right then, which also quietly repairs every piece saved before any of this
 *  existed and every render that failed. One request per card per session; the
 *  guard is the state below, not a debounce.
 * ═══════════════════════════════════════════════════════════════════════════
 */

type Phase = "idle" | "asking" | "failed";

export function GarmentFlip({
  garment,
  variant = "standard",
  priority = false,
  interactive = false,
  onOpen,
}: {
  garment: Garment;
  variant?: "standard" | "short" | "shoe";
  priority?: boolean;
  interactive?: boolean;
  /** The full record, still reachable from the back of the card. */
  onOpen?: (garment: Garment) => void;
}) {
  const [flipped, setFlipped] = useState(false);
  const [phase, setPhase] = useState<Phase>("idle");
  /** A render this session, which the prop cannot know about yet. */
  const [fresh, setFresh] = useState<string | null>(null);

  const worn = fresh ?? garment.tryOnUrl;
  const tint = tintOf(garment.dye.hex);

  const ask = useCallback(async () => {
    if (phase === "asking") return;
    setPhase("asking");
    try {
      const res = await fetch("/api/wardrobe/render", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // No avatarId: the route falls back to the active plate, which is the
        // one the person is looking at their wardrobe with.
        body: JSON.stringify({
          id: garment.id,
          name: garment.name,
          zone: garment.zone,
          imageUrl: garment.imageUrl,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.tryOnUrl) throw new Error(json.error ?? "no render");
      setFresh(json.tryOnUrl as string);
      setPhase("idle");
    } catch {
      setPhase("failed");
    }
  }, [garment.id, phase]);

  const turn = useCallback(() => {
    setFlipped((was) => {
      const next = !was;
      if (next && !worn && phase === "idle") void ask();
      return next;
    });
  }, [worn, phase, ask]);

  return (
    <div
      className="relative h-full w-full"
      style={{ perspective: 1100 }}
      data-flipped={flipped || undefined}
    >
      <div
        className="relative h-full w-full motion-reduce:transition-none"
        style={{
          transformStyle: "preserve-3d",
          transform: flipped ? "rotateY(180deg)" : "rotateY(0deg)",
          transition: "transform 620ms cubic-bezier(0.5, 0.05, 0.2, 1)",
        }}
      >
        {/* ── the piece ─────────────────────────────────────────────────── */}
        <button
          type="button"
          onClick={turn}
          aria-label={`${garment.name} — see it worn`}
          aria-pressed={flipped}
          tabIndex={flipped ? -1 : 0}
          className="absolute inset-0 h-full w-full cursor-pointer text-left focus:outline-none"
          style={{ backfaceVisibility: "hidden", WebkitBackfaceVisibility: "hidden" }}
        >
          <GarmentPlate
            garment={garment}
            variant={variant}
            priority={priority}
            interactive={interactive}
          />
        </button>

        {/* ── the same piece, worn ──────────────────────────────────────── */}
        <div
          aria-hidden={!flipped}
          className="absolute inset-0 h-full w-full overflow-hidden rounded-[24px] border-[3px] border-abyss"
          style={{
            backfaceVisibility: "hidden",
            WebkitBackfaceVisibility: "hidden",
            transform: "rotateY(180deg)",
            // The back is dyed from the same cloth as the front, so turning it
            // over does not feel like arriving at a different card.
            background: tint.card,
          }}
        >
          <button
            type="button"
            onClick={turn}
            aria-label={`${garment.name} — back to the garment`}
            tabIndex={flipped ? 0 : -1}
            className="absolute inset-0 h-full w-full cursor-pointer focus:outline-none"
          >
            {worn ? (
              <Image
                src={worn}
                alt={`${garment.name}, worn`}
                fill
                sizes="(max-width: 768px) 45vw, 20vw"
                className="object-cover object-top"
              />
            ) : (
              <span className="absolute inset-0 flex items-center justify-center px-4 text-center">
                <span className="spec-sm leading-relaxed" style={{ color: tint.mark }}>
                  {phase === "asking"
                    ? "PUTTING IT ON…"
                    : phase === "failed"
                      ? "THAT RENDER DIDN'T TAKE"
                      : "NOT WORN YET"}
                </span>
              </span>
            )}
          </button>

          {/* Sits above the turn-back button so the record stays reachable
              without going through the front of the card again. */}
          {onOpen && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onOpen(garment);
              }}
              tabIndex={flipped ? 0 : -1}
              className="spec-sm absolute bottom-2 left-1/2 z-[2] -translate-x-1/2 rounded-brut border-2 border-abyss bg-leaf px-2.5 py-1 text-abyss shadow-brut-sm transition-[translate,box-shadow] hover:bg-brass active:translate-x-[2px] active:translate-y-[2px] active:shadow-none"
            >
              DETAILS
            </button>
          )}

          {phase === "failed" && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setPhase("idle");
                void ask();
              }}
              tabIndex={flipped ? 0 : -1}
              className="spec-sm absolute right-2 top-2 z-[2] rounded-brut border-2 border-abyss bg-madder px-2 py-0.5 text-leaf shadow-brut-sm"
            >
              RETRY
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
