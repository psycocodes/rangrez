"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sparkles,
  ShoppingBag,
  RotateCcw,
  Plus,
  X,
  Lock,
  ChevronLeft,
  ChevronRight,
  Shirt,
  Layers,
  Footprints,
  Scissors,
  Loader2,
  Scan,
  GripHorizontal,
} from "lucide-react";

import { chainOrder, SLOTS, slotFor } from "@/lib/look";
import { GarmentPlate } from "./GarmentPlate";
import { SwipeButton } from "./SwipeButton";
import { ArtifactModal } from "./ArtifactModal";
import { materialise } from "@/lib/rasterize";
import { saveLocalArtifact } from "@/lib/artifacts-client";
import {
  FRAMING,
  type ArtifactItem,
  type Avatar,
  type Garment,
  type SlotId,
  type Zone,
} from "@/lib/types";

type StepState = "waiting" | "working" | "done" | "failed";

const ESTIMATED_ZONE_PRICES: Record<Zone, number> = {
  top: 2490,
  bottom: 3990,
  outerwear: 7490,
  shoes: 4990,
  accessory: 1890,
};

// 4 main slots according to wireframe diagram with Lucide React icons
const WIREFRAME_SLOTS: Array<{
  id: SlotId;
  label: string;
  wireframeLabel: string;
  icon: React.ReactNode;
}> = [
  {
    id: "torso",
    label: "Torso",
    wireframeLabel: "shirt",
    icon: <Shirt className="h-5 w-5 stroke-[2.2] text-[#1E3A8A]" />,
  },
  {
    id: "layer",
    label: "Outerwear",
    wireframeLabel: "layer",
    icon: <Layers className="h-5 w-5 stroke-[2.2] text-[#CA761E]" />,
  },
  {
    id: "bottom",
    label: "Bottom",
    wireframeLabel: "pants",
    icon: <Scissors className="h-5 w-5 stroke-[2.2] text-[#15803D]" />,
  },
  {
    id: "shoes",
    label: "Footwear",
    wireframeLabel: "shoes",
    icon: <Footprints className="h-5 w-5 stroke-[2.2] text-[#B91C1C]" />,
  },
];

export function LookCreator({
  avatars,
  activeAvatarId,
  garments,
  onBackToWardrobe,
  embedded = false,
}: {
  avatars: Avatar[];
  activeAvatarId?: string;
  garments: Garment[];
  onBackToWardrobe?: () => void;
  embedded?: boolean;
}) {
  const [plateId, setPlateId] = useState(activeAvatarId ?? avatars[0]?.id);
  const [picked, setPicked] = useState<Partial<Record<SlotId, Garment>>>({});
  const [render, setRender] = useState<string | null>(null);
  const [steps, setSteps] = useState<Partial<Record<SlotId, StepState>>>({});
  const [building, setBuilding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  // Drag over state for slots
  const [dragOverSlot, setDragOverSlot] = useState<SlotId | null>(null);

  // Minted artifact reveal state
  const [mintedArtifact, setMintedArtifact] = useState<ArtifactItem | null>(null);
  const [artifactModalOpen, setArtifactModalOpen] = useState(false);

  const plate = avatars.find((a) => a.id === plateId) ?? avatars[0];
  const framing = FRAMING[plate?.framing ?? "full"];
  const openSlots = useMemo(() => new Set(framing.slots), [framing]);

  // Split garments into top carousel (Tops & Layers) and bottom carousel (Bottoms & Shoes)
  const { topCarouselGarments, bottomCarouselGarments } = useMemo(() => {
    const tops: Garment[] = [];
    const bottoms: Garment[] = [];

    for (const g of garments) {
      if (g.zone === "top" || g.zone === "outerwear" || g.zone === "accessory") {
        tops.push(g);
      } else {
        bottoms.push(g);
      }
    }
    return { topCarouselGarments: tops, bottomCarouselGarments: bottoms };
  }, [garments]);

  const chosen = SLOTS.filter((s) => picked[s.id]);
  const done = SLOTS.filter((s) => steps[s.id] === "done").length;

  function put(garment: Garment) {
    const id = slotFor(garment);
    if (!id) return;

    if (!openSlots.has(id)) {
      setNote(
        `"${plate.customization.label}" is framed ${framing.label.toLowerCase()} — cannot equip ${id}.`,
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

  const notifyStatus = (status: { busy?: boolean; ready?: boolean }) => {
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("rangrez-trialroom-status", { detail: status }));
    }
  };

  /**
   * Generation workflow with comprehensive scanning and artifact minting
   */
  async function build() {
    const order = chainOrder(
      Object.fromEntries(chosen.map((s) => [s.id, picked[s.id]!.id])),
    );
    if (!order.length || !plate) return;

    setBuilding(true);
    notifyStatus({ busy: true, ready: false });
    setError(null);
    setNote(null);
    setSteps(
      Object.fromEntries(order.flatMap((s) => s.slots.map((id) => [id, "waiting"]))),
    );

    try {
      await Promise.all(
        order
          .flatMap((s) => s.slots)
          .map((id) => materialise(picked[id]!)),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't prepare those pieces.");
      setSteps({});
      setBuilding(false);
      notifyStatus({ busy: false });
      return;
    }

    let base: string | undefined;
    setRender(null);
    let lastRenderUrl: string | null = null;

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
            pieces: step.pieces,
            target: step.target,
            avatarId: plate.id,
            baseUrl: base,
          }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? "That layer didn't take.");

        base = json.renderUrl as string;
        lastRenderUrl = base;
        setRender(base);
        mark("done");
      } catch (err) {
        mark("failed");
        setError(err instanceof Error ? err.message : "That layer didn't take.");
        break;
      }
    }

    setBuilding(false);

    const finalUrl = lastRenderUrl || plate.renderUrl;
    if (finalUrl) {
      notifyStatus({ busy: false, ready: true });

      const equippedGarments = chosen.map((s) => picked[s.id]!).filter(Boolean);
      const wishlistCount = equippedGarments.filter((g) => g.origin === "shop" || g.sourceUrl).length;
      const totalPrice = equippedGarments.reduce((sum, g) => {
        return sum + (ESTIMATED_ZONE_PRICES[g.zone] || 2500);
      }, 0);

      const newArtifact: ArtifactItem = {
        id: crypto.randomUUID(),
        userId: plate.id,
        name: `Fit #${Math.floor(100 + Math.random() * 900)} — ${equippedGarments.map((g) => g.name).slice(0, 2).join(" + ")}`,
        renderUrl: finalUrl,
        avatarId: plate.id,
        avatarLabel: plate.customization.label,
        garments: equippedGarments,
        slotGarments: picked,
        totalPrice,
        wishlistCount,
        createdAt: new Date().toISOString(),
      };

      saveLocalArtifact(newArtifact);
      try {
        fetch("/api/artifacts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(newArtifact),
        }).catch(() => {});
      } catch {}

      setMintedArtifact(newArtifact);
      setArtifactModalOpen(true);
    } else {
      notifyStatus({ busy: false });
    }
  }

  const shown = render ?? plate?.cutoutUrl ?? plate?.renderUrl;
  const floating = !render && Boolean(plate?.cutoutUrl);

  return (
    <div
      className="relative flex h-[calc(100vh-4.2rem)] min-h-[40rem] w-full flex-col justify-between overflow-hidden"
      style={{
        backgroundImage: "url('/assets/backgrounds/trialroom-background.png')",
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
      }}
    >
      {/* Halftone Dot Overlay */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.25]"
        style={{
          backgroundImage:
            "radial-gradient(#12100d 1.5px, transparent 1.5px), repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(18,16,13,0.04) 3px, rgba(18,16,13,0.04) 4px)",
          backgroundSize: "20px 20px, 100% 4px",
        }}
      />

      {/* ── Top Bar: Title "Outfit Compositor" + Avatar Selector ── */}
      <div className="relative z-20 flex shrink-0 items-center justify-between gap-3 px-4 pt-2.5 pb-1 lg:px-6">
        <div className="flex items-center gap-2">
          <div
            className="flex items-center gap-1.5 rounded-xl border-2 border-[#12100d] bg-[#FFDE59] px-3 py-1 text-xs font-black uppercase tracking-wider text-[#12100d] shadow-[2px_2px_0px_#12100d]"
            style={{ fontFamily: "var(--font-clash), sans-serif" }}
          >
            <Sparkles className="h-3.5 w-3.5" />
            <span>Outfit Compositor</span>
          </div>

          <span
            className="rounded-lg border border-[#12100d] bg-white px-2.5 py-0.5 text-xs font-bold text-[#12100d] shadow-[1.5px_1.5px_0px_#12100d]"
            style={{ fontFamily: "var(--font-clash), sans-serif" }}
          >
            {chosen.length ? `${chosen.length} / 4 EQUIPPED` : "SLOTS READY"}
          </span>
        </div>

        {/* Right: Avatar Switcher */}
        <div className="flex items-center gap-2">
          {avatars.length > 1 && (
            <div className="flex items-center gap-1 rounded-xl border-2 border-[#12100d] bg-white p-1 shadow-[2px_2px_0px_#12100d]">
              {avatars.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => {
                    setPlateId(a.id);
                    setRender(null);
                    setSteps({});
                  }}
                  className={`rounded-lg px-2.5 py-0.5 text-xs font-bold uppercase transition-all cursor-pointer ${
                    a.id === plate?.id
                      ? "bg-[#FFDE59] text-[#12100d] border border-[#12100d]"
                      : "text-[#12100d]/60 hover:text-[#12100d]"
                  }`}
                  style={{ fontFamily: "var(--font-clash), sans-serif" }}
                >
                  {a.customization.label}
                </button>
              ))}
            </div>
          )}

          <span
            className="rounded-lg border border-[#12100d] bg-[#7FE06E] px-2.5 py-0.5 text-xs font-black uppercase text-[#12100d] shadow-[1.5px_1.5px_0px_#12100d]"
            style={{ fontFamily: "var(--font-clash), sans-serif" }}
          >
            {framing.label}
          </span>
        </div>
      </div>

      {/* ── Main Wireframe 2-Column Split ── */}
      <div className="relative z-10 flex flex-1 min-h-0 items-center justify-between px-3 sm:px-6 py-2 gap-4 lg:gap-6">
        
        {/* ═════════════════════════════════════════════════════════════════
         *  LEFT SECTION: [ AVATAR ] + [ VERTICAL SLOTS: shirt, layer, pants, shoes ]
         * ═════════════════════════════════════════════════════════════════ */}
        <div className="relative flex h-full max-h-[96%] flex-1 max-w-[34rem] items-stretch gap-2.5 rounded-3xl border-[3.5px] border-[#12100d] bg-[#F4EFE6] p-3 shadow-[8px_8px_0px_#12100d]">
          
          {/* Avatar Stage Box */}
          <div className="relative flex-1 min-h-0 flex flex-col items-center justify-center overflow-hidden rounded-2xl border-2 border-[#12100d] bg-white shadow-[3px_3px_0px_#12100d]">
            {/* Corner HUD Marks */}
            <span className="absolute top-2 left-2 font-mono text-[0.7rem] font-bold text-[#12100d]/40 select-none">┌</span>
            <span className="absolute top-2 right-2 font-mono text-[0.7rem] font-bold text-[#12100d]/40 select-none">┐</span>
            <span className="absolute bottom-2 left-2 font-mono text-[0.7rem] font-bold text-[#12100d]/40 select-none">└</span>
            <span className="absolute bottom-2 right-2 font-mono text-[0.7rem] font-bold text-[#12100d]/40 select-none">┘</span>

            {/* Avatar Photo / Render */}
            {shown && (
              <div className="relative h-full w-full flex items-center justify-center p-2">
                <Image
                  key={shown}
                  src={shown}
                  alt={plate?.customization.label || "Avatar Body"}
                  fill
                  priority
                  className={`object-contain transition-all duration-300 ${
                    building ? "opacity-85 brightness-105" : ""
                  } ${floating ? "drop-shadow-[0_16px_24px_rgba(18,16,13,0.25)]" : ""}`}
                />

                {/* Laser Scanning Animation */}
                {building && (
                  <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-2xl">
                    <motion.div
                      animate={{ top: ["0%", "92%", "0%"] }}
                      transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
                      className="absolute inset-x-0 z-30 flex flex-col items-center"
                    >
                      <div
                        className="h-16 w-full opacity-60"
                        style={{
                          background:
                            "linear-gradient(to bottom, transparent, rgba(255, 90, 95, 0.15), rgba(255, 90, 95, 0.45))",
                        }}
                      />
                      <div className="h-1.5 w-full bg-[#FF5A5F] shadow-[0_0_16px_#FF5A5F]" />
                    </motion.div>

                    <div className="absolute top-3 left-1/2 -translate-x-1/2 z-40 flex items-center gap-1.5 rounded-xl border border-[#12100d] bg-[#FFDE59] px-2.5 py-1 text-[11px] font-black uppercase text-[#12100d] shadow-[2px_2px_0px_#12100d]">
                      <Scan className="h-3.5 w-3.5 animate-spin" />
                      <span>DYEING LAYER ({done + 1}/{chosen.length})</span>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Bottom Avatar Tag */}
            <div className="absolute bottom-2 inset-x-2 z-20 flex items-center justify-between rounded-xl border border-[#12100d] bg-white/90 px-2.5 py-1 backdrop-blur-xs">
              <span
                className="text-xs font-black uppercase text-[#12100d]"
                style={{ fontFamily: "var(--font-clash), sans-serif" }}
              >
                {render ? "MINTED FIT" : plate?.customization.label.toUpperCase()}
              </span>

              <span className="text-[10px] font-bold text-[#1E3A8A]">
                {chosen.length} PCS
              </span>
            </div>
          </div>

          {/* Vertical Slots Strip (shirt, layer, pants, shoes) */}
          <div className="flex w-[6.5rem] sm:w-[7.5rem] flex-col justify-between gap-2 shrink-0">
            {WIREFRAME_SLOTS.map((slot) => {
              const item = picked[slot.id];
              const isOpen = openSlots.has(slot.id);
              const state = steps[slot.id];
              const isOver = dragOverSlot === slot.id;

              return (
                <div
                  key={slot.id}
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.dataTransfer.dropEffect = "copy";
                    setDragOverSlot(slot.id);
                  }}
                  onDragLeave={() => setDragOverSlot(null)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setDragOverSlot(null);
                    try {
                      const data = e.dataTransfer.getData("application/json");
                      if (data) {
                        const g = JSON.parse(data) as Garment;
                        put(g);
                      }
                    } catch {}
                  }}
                  className={`group relative flex-1 min-h-[4.5rem] flex flex-col items-center justify-center rounded-2xl border-[2.5px] transition-all duration-200 overflow-hidden ${
                    isOver
                      ? "border-[#12100d] bg-[#FFDE59] scale-105 shadow-[4px_4px_0px_#12100d] ring-2 ring-[#12100d]"
                      : item
                        ? "border-[#12100d] bg-white shadow-[3px_3px_0px_#12100d]"
                        : isOpen
                          ? "border-dashed border-[#12100d]/50 bg-white/70 hover:bg-white hover:border-[#12100d]"
                          : "border-[#12100d]/20 bg-[#12100d]/10 opacity-50 cursor-not-allowed"
                  }`}
                >
                  {item ? (
                    <>
                      {/* Garment Thumbnail */}
                      <Image
                        src={item.imageUrl}
                        alt={item.name}
                        fill
                        sizes="90px"
                        className={`object-contain p-1 ${
                          state === "working" ? "opacity-35 saturate-50" : ""
                        }`}
                      />

                      {/* Remove Button */}
                      {!building && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            clear(slot.id);
                          }}
                          aria-label={`Remove ${item.name}`}
                          className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-md border border-[#12100d] bg-white text-[#12100d] shadow-[1px_1px_0px_#12100d] hover:bg-[#FF5A5F] hover:text-white transition-colors cursor-pointer z-20"
                        >
                          <X className="h-2.5 w-2.5 stroke-[3]" />
                        </button>
                      )}

                      {/* Dye indicator */}
                      <div
                        className="absolute top-1 left-1 h-3 w-3 rounded-full border border-[#12100d]"
                        style={{ backgroundColor: item.dye.hex }}
                        title={item.dye.name}
                      />

                      {/* Loading state */}
                      {state === "working" && (
                        <div className="absolute inset-0 z-30 flex items-center justify-center bg-[#FFDE59]/80">
                          <Loader2 className="h-4 w-4 animate-spin text-[#12100d]" />
                        </div>
                      )}

                      {/* Slot Label Tag */}
                      <div className="absolute inset-x-0 bottom-0 z-10 border-t border-[#12100d] bg-[#7FE06E] py-0.5 text-center">
                        <span
                          className="block truncate px-1 text-[8px] font-black uppercase text-[#12100d] leading-none"
                          style={{ fontFamily: "var(--font-clash), sans-serif" }}
                        >
                          {slot.wireframeLabel}
                        </span>
                      </div>
                    </>
                  ) : (
                    <div className="flex flex-col items-center justify-center p-1 text-center select-none">
                      <div className="flex items-center justify-center">{slot.icon}</div>
                      <span
                        className="mt-0.5 text-[10px] font-black uppercase tracking-wider text-[#12100d]"
                        style={{ fontFamily: "var(--font-clash), sans-serif" }}
                      >
                        {slot.wireframeLabel}
                      </span>
                      {isOpen && (
                        <span className="text-[8px] font-bold text-[#12100d]/50">
                          {isOver ? "DROP" : "DROP / CLICK"}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* ═════════════════════════════════════════════════════════════════
         *  RIGHT SECTION: [ TOP CAROUSEL ] + [ BOTTOM CAROUSEL ] + [ SLIDER ]
         * ═════════════════════════════════════════════════════════════════ */}
        <div className="flex h-full max-h-[96%] flex-1 flex-col justify-between gap-3 overflow-hidden">
          
          {/* TOP CARD CAROUSEL (Tops & Outerwear) */}
          <SimpleScrollableDeck
            title="Tops · Layers"
            icon={<Shirt className="h-3.5 w-3.5 text-[#1E3A8A]" />}
            garments={topCarouselGarments}
            onPick={put}
            disabled={building}
          />

          {/* BOTTOM CARD CAROUSEL (Bottoms & Shoes) */}
          <SimpleScrollableDeck
            title="Pants · Shoes"
            icon={<ShoppingBag className="h-3.5 w-3.5 text-[#0C535E]" />}
            garments={bottomCarouselGarments}
            onPick={put}
            disabled={building}
          />

          {/* BOTTOM SLIDER & CONTROLS */}
          <div className="shrink-0 space-y-1.5 pt-1">
            {/* Error / Note Banner */}
            {(note || error) && (
              <div
                className={`rounded-xl border-2 border-[#12100d] p-2 text-center text-xs font-bold shadow-[2px_2px_0px_#12100d] ${
                  error ? "bg-[#FF5A5F] text-white" : "bg-[#FFDE59] text-[#12100d]"
                }`}
              >
                {error ?? note}
              </div>
            )}

            {/* Slider */}
            <SwipeButton
              onSwipeComplete={build}
              disabled={building || chosen.length === 0}
              loading={building}
              stepText={`Dyeing Layer ${done + 1} of ${chosen.length}...`}
              pieceCount={chosen.length}
            />

            {/* Action Bar */}
            <div className="flex items-center justify-between px-1">
              <button
                type="button"
                disabled={building || chosen.length === 0}
                onClick={() => {
                  setPicked({});
                  setRender(null);
                  setSteps({});
                  setError(null);
                  setNote(null);
                }}
                className="flex items-center gap-1 rounded-xl border-2 border-[#12100d] bg-white px-3 py-1 text-xs font-bold uppercase text-[#12100d] shadow-[2px_2px_0px_#12100d] hover:bg-[#FF5A5F] hover:text-white transition-colors cursor-pointer disabled:opacity-40"
                style={{ fontFamily: "var(--font-clash), sans-serif" }}
              >
                <RotateCcw className="h-3 w-3" />
                <span>RESET</span>
              </button>

              <Link
                href="/artifacts"
                className="text-xs font-black uppercase text-[#12100d] underline decoration-[#FFDE59] decoration-2 underline-offset-2 hover:opacity-80"
                style={{ fontFamily: "var(--font-clash), sans-serif" }}
              >
                PAST ARTIFACTS →
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* ── Minted Artifact Reveal Modal ── */}
      <ArtifactModal
        artifact={mintedArtifact}
        isOpen={artifactModalOpen}
        onClose={() => setArtifactModalOpen(false)}
      />
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
 *  SIMPLE SCROLLABLE CARD CAROUSEL (Zero excessive padding, Draggable)
 * ═══════════════════════════════════════════════════════════════════════════ */

function SimpleScrollableDeck({
  title,
  icon,
  garments,
  onPick,
  disabled,
}: {
  title: string;
  icon: React.ReactNode;
  garments: Garment[];
  onPick: (g: Garment) => void;
  disabled: boolean;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);

  const scroll = (direction: "left" | "right") => {
    if (scrollRef.current) {
      const amount = direction === "left" ? -240 : 240;
      scrollRef.current.scrollBy({ left: amount, behavior: "smooth" });
    }
  };

  return (
    <div className="relative flex flex-1 min-h-[9rem] max-h-[14rem] flex-col rounded-3xl border-[3px] border-[#12100d] bg-white p-2.5 shadow-[5px_5px_0px_#12100d] overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between pb-1.5 px-1 border-b-2 border-[#12100d]/10">
        <div className="flex items-center gap-1.5">
          {icon}
          <span
            className="text-xs font-black uppercase tracking-wider text-[#12100d]"
            style={{ fontFamily: "var(--font-clash), sans-serif" }}
          >
            {title}
          </span>
          <span className="rounded-md bg-[#FFDE59] px-1.5 py-0.2 text-[10px] font-black text-[#12100d]">
            {garments.length}
          </span>
        </div>

        {/* Scroll Arrows */}
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => scroll("left")}
            aria-label="Scroll left"
            className="flex h-6 w-6 items-center justify-center rounded-lg border border-[#12100d] bg-[#FAF8F5] text-[#12100d] hover:bg-[#FFDE59] transition-colors cursor-pointer"
          >
            <ChevronLeft className="h-3.5 w-3.5 stroke-[3]" />
          </button>
          <button
            type="button"
            onClick={() => scroll("right")}
            aria-label="Scroll right"
            className="flex h-6 w-6 items-center justify-center rounded-lg border border-[#12100d] bg-[#FAF8F5] text-[#12100d] hover:bg-[#FFDE59] transition-colors cursor-pointer"
          >
            <ChevronRight className="h-3.5 w-3.5 stroke-[3]" />
          </button>
        </div>
      </div>

      {/* Horizontal Scroll Track */}
      <div
        ref={scrollRef}
        className="flex flex-1 min-h-0 items-center gap-2.5 overflow-x-auto py-1.5 px-1 scroll-smooth snap-x select-none"
        style={{ scrollbarWidth: "none" }}
      >
        {garments.length === 0 ? (
          <div className="w-full text-center text-xs font-bold text-[#12100d]/50 py-4">
            No pieces in this section yet
          </div>
        ) : (
          garments.map((garment) => {
            const isShop = garment.origin === "shop" || Boolean(garment.sourceUrl);
            const price = ESTIMATED_ZONE_PRICES[garment.zone] || 2490;

            return (
              <div
                key={garment.id}
                draggable={!disabled}
                onDragStart={(e) => {
                  e.dataTransfer.setData("application/json", JSON.stringify(garment));
                  e.dataTransfer.effectAllowed = "copy";
                }}
                onClick={() => onPick(garment)}
                className="group relative flex h-full w-[8.5rem] sm:w-[9.5rem] shrink-0 snap-start flex-col justify-between rounded-2xl border-2 border-[#12100d] bg-[#FAF8F5] p-1.5 shadow-[2.5px_2.5px_0px_#12100d] hover:shadow-[4px_4px_0px_#12100d] hover:-translate-y-0.5 hover:bg-[#FFDE59]/20 transition-all cursor-grab active:cursor-grabbing overflow-hidden"
              >
                {/* Thumbnail */}
                <div className="relative aspect-[4/3] w-full overflow-hidden rounded-xl border border-[#12100d]/20 bg-white">
                  <Image
                    src={garment.imageUrl}
                    alt={garment.name}
                    fill
                    className="object-contain p-1 transition-transform group-hover:scale-105"
                  />

                  {/* Price / Owned Tag */}
                  <span className="absolute top-1 left-1 rounded bg-[#12100d] px-1.5 py-0.2 text-[8px] font-black text-white">
                    {isShop ? `₹${price.toLocaleString()}` : "OWNED"}
                  </span>

                  {/* Dye dot */}
                  <div
                    className="absolute top-1 right-1 h-3 w-3 rounded-full border border-[#12100d]"
                    style={{ backgroundColor: garment.dye.hex }}
                    title={garment.dye.name}
                  />
                </div>

                {/* Info & Equip Action */}
                <div className="mt-1 px-0.5">
                  <p
                    className="truncate text-[11px] font-bold text-[#12100d] uppercase leading-tight"
                    style={{ fontFamily: "var(--font-clash), sans-serif" }}
                  >
                    {garment.name}
                  </p>
                  <div className="flex items-center justify-between pt-0.5">
                    <span className="text-[9px] text-[#12100d]/60 font-bold uppercase">
                      {garment.zone}
                    </span>
                    <span className="text-[9px] font-black text-[#1E3A8A] group-hover:text-[#CA761E]">
                      EQUIP ➔
                    </span>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
