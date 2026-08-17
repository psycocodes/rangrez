"use client";

import Image from "next/image";
import Link from "next/link";
import { memo, useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sparkles,
  ShoppingBag,
  Layers,
  ArrowRight,
  RotateCcw,
  Plus,
  X,
  Lock,
  ChevronLeft,
  ChevronRight,
  Shirt,
  Tag,
  Store,
  Check,
  Loader2,
  Scan,
  Maximize2,
} from "lucide-react";

import {
  chainOrder,
  SLOTS,
  slotFor,
} from "@/lib/look";
import { GarmentPlate } from "./GarmentPlate";
import { RoomTab } from "./RoomTab";
import { SwipeButton } from "./SwipeButton";
import { ArtifactModal } from "./ArtifactModal";
import { elasticOut, ramp } from "@/lib/ease";
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

type ZoneFilter = "all" | "torso" | "layer" | "bottom" | "shoes" | "accessory";

const ZONE_FILTERS: Record<
  ZoneFilter,
  { label: string; zones: Garment["zone"][] }
> = {
  all: { label: "All Items", zones: ["top", "outerwear", "bottom", "shoes", "accessory"] },
  torso: { label: "Tops", zones: ["top"] },
  layer: { label: "Layers", zones: ["outerwear"] },
  bottom: { label: "Bottoms", zones: ["bottom"] },
  shoes: { label: "Shoes", zones: ["shoes"] },
  accessory: { label: "Accessories", zones: ["accessory"] },
};

const ESTIMATED_ZONE_PRICES: Record<Zone, number> = {
  top: 2490,
  bottom: 3990,
  outerwear: 7490,
  shoes: 4990,
  accessory: 1890,
};

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
  const [zone, setZone] = useState<ZoneFilter>("all");

  // Newly minted artifact state
  const [mintedArtifact, setMintedArtifact] = useState<ArtifactItem | null>(null);
  const [artifactModalOpen, setArtifactModalOpen] = useState(false);

  const plate = avatars.find((a) => a.id === plateId) ?? avatars[0];
  const framing = FRAMING[plate?.framing ?? "full"];
  const openSlots = useMemo(() => new Set(framing.slots), [framing]);

  // Filter garments for the wheels
  const inZone = useMemo(() => {
    if (zone === "all") return garments;
    return garments.filter((g) => ZONE_FILTERS[zone].zones.includes(g.zone));
  }, [garments, zone]);

  const { left, right } = useMemo(() => split(inZone), [inZone]);
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
      className="relative flex h-full min-h-0 w-full flex-col justify-between overflow-hidden"
      style={{
        backgroundImage: "url('/assets/backgrounds/trialroom-background.png')",
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
      }}
    >
      {/* Halftone Dot & Brutalist Grid Overlays */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.25]"
        style={{
          backgroundImage:
            "radial-gradient(#12100d 1.5px, transparent 1.5px), repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(18,16,13,0.04) 3px, rgba(18,16,13,0.04) 4px)",
          backgroundSize: "20px 20px, 100% 4px",
        }}
      />

      {/* ── Top Control Bar: Category Rails & Room Title ── */}
      <div className="relative z-20 flex shrink-0 items-center justify-between gap-3 px-4 pt-3 pb-1 lg:px-6">
        {/* Left: Room Spec Badge */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 rounded-xl border-2 border-[#12100d] bg-[#FFDE59] px-3 py-1 font-friday text-xs uppercase tracking-wider text-[#12100d] shadow-[2px_2px_0px_#12100d]">
            <Sparkles className="h-3.5 w-3.5" />
            <span>TRIAL ROOM</span>
          </div>

          <span className="rounded-lg border border-[#12100d] bg-white px-2 py-0.5 font-mono text-[0.68rem] font-black text-[#12100d] shadow-[1px_1px_0px_#12100d]">
            {chosen.length ? `${chosen.length} / 5 EQUIPPED` : "5 SLOTS READY"}
          </span>
        </div>

        {/* Center: Category / Zone Rail Pills */}
        <div className="hidden sm:flex items-center rounded-2xl border-2 border-[#12100d] bg-white p-1 shadow-[3px_3px_0px_#12100d]">
          {(Object.keys(ZONE_FILTERS) as ZoneFilter[]).map((id) => {
            const on = zone === id;
            const count =
              id === "all"
                ? garments.length
                : garments.filter((g) => ZONE_FILTERS[id].zones.includes(g.zone)).length;

            return (
              <button
                key={id}
                type="button"
                onClick={() => setZone(id)}
                className={`flex items-center gap-1.5 rounded-xl px-2.5 py-1 font-mono text-[0.68rem] font-black uppercase transition-all cursor-pointer ${
                  on
                    ? "bg-[#12100d] text-[#FFDE59] shadow-[1px_1px_0px_#12100d]"
                    : "text-[#12100d]/70 hover:text-[#12100d] hover:bg-[#FAF6EF]"
                }`}
              >
                <span>{ZONE_FILTERS[id].label}</span>
                <span className={`text-[0.6rem] ${on ? "text-[#FFDE59]" : "text-[#12100d]/50"}`}>
                  ({count})
                </span>
              </button>
            );
          })}
        </div>

        {/* Right: Avatar Switcher Pills */}
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
                  className={`rounded-lg px-2.5 py-0.5 font-friday text-[0.68rem] uppercase transition-all cursor-pointer ${
                    a.id === plate?.id
                      ? "bg-[#FFDE59] text-[#12100d] font-bold border border-[#12100d]"
                      : "text-[#12100d]/60 hover:text-[#12100d]"
                  }`}
                >
                  {a.customization.label}
                </button>
              ))}
            </div>
          )}

          <span className="rounded-lg border border-[#12100d] bg-[#7FE06E] px-2 py-0.5 font-mono text-[0.65rem] font-black uppercase text-[#12100d] shadow-[1.5px_1.5px_0px_#12100d]">
            {framing.label}
          </span>
        </div>
      </div>

      {/* ── Main Stage: 3-Panel Split ── */}
      <div className="relative z-10 flex flex-1 min-h-0 items-center justify-between px-3 sm:px-6 gap-3 sm:gap-6">
        {/* ── Left Deck: Wishlist / Online Shops ── */}
        <Carousel3DDeck
          side="left"
          title="Wishlist · Shops"
          emptyText="No wishlist pieces saved yet"
          garments={left}
          openSlots={openSlots}
          onPick={put}
          disabled={building}
        />

        {/* ── Middle Stage: Centered Neobrutalist Avatar Station Card & Larger 5 Slots ── */}
        <div className="relative z-20 flex h-full max-h-[94%] w-full max-w-[28rem] flex-col items-center justify-between rounded-3xl border-[4px] border-[#12100d] bg-[#F4EFE6] p-3.5 sm:p-5 shadow-[8px_8px_0px_#12100d]">
          {/* ── Avatar Card Top Banner ── */}
          <div className="flex w-full items-center justify-between border-b-2 border-[#12100d]/15 pb-2 mb-1">
            <div className="flex items-center gap-2">
              <span className="h-3 w-3 rounded-full bg-[#7FE06E] border border-[#12100d] animate-pulse" />
              <span className="font-friday text-sm sm:text-base uppercase tracking-wide text-[#12100d]">
                {render ? "MINTED FIT" : plate?.customization.label.toUpperCase()}
              </span>
            </div>

            <div className="flex items-center gap-1.5 font-mono text-xs font-black text-[#12100d]/75 uppercase">
              <span className="text-[#FF5A5F]">{chosen.length}</span>
              <span>/ 5 SLOTS</span>
            </div>
          </div>

          {/* ── BIGGER 5 Equip Slots Dock (Top, Layer, Bottom, Shoes, Acc) ── */}
          <div className="w-full my-1">
            <BiggerSlotDock
              picked={picked}
              openSlots={openSlots}
              steps={steps}
              onClear={clear}
              disabled={building}
            />
          </div>

          {/* ── Avatar Figure with Hologram Scanning Animation ── */}
          <div className="relative flex flex-1 min-h-0 w-full items-center justify-center py-2 overflow-hidden rounded-2xl border-2 border-[#12100d]/20 bg-white/70 shadow-[inset_0_2px_6px_rgba(0,0,0,0.06)]">
            {/* HUD Corner Reticles */}
            <span className="absolute top-2 left-2 font-mono text-[0.7rem] font-bold text-[#12100d]/40 select-none">┌</span>
            <span className="absolute top-2 right-2 font-mono text-[0.7rem] font-bold text-[#12100d]/40 select-none">┐</span>
            <span className="absolute bottom-2 left-2 font-mono text-[0.7rem] font-bold text-[#12100d]/40 select-none">└</span>
            <span className="absolute bottom-2 right-2 font-mono text-[0.7rem] font-bold text-[#12100d]/40 select-none">┘</span>

            {/* Ground Contact Shadow */}
            <div
              aria-hidden
              className="pointer-events-none absolute bottom-3 left-1/2 h-4 w-[65%] -translate-x-1/2 rounded-[50%] bg-[#12100d]/25 blur-[4px]"
            />

            {shown && (
              <div className="relative h-full w-full flex items-center justify-center">
                <Image
                  key={shown}
                  src={shown}
                  alt={plate?.customization.label || "Avatar Body"}
                  width={700}
                  height={950}
                  priority
                  className={`h-full w-auto max-w-full object-contain transition-all duration-300 ${
                    building ? "opacity-85 brightness-105" : ""
                  } ${floating ? "drop-shadow-[0_18px_24px_rgba(18,16,13,0.3)]" : ""}`}
                />

                {/* ── HIGH-CRAFT AVATAR SCANNING LASER ANIMATION ── */}
                {building && (
                  <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-2xl">
                    {/* Laser Scanner Line + Gradient Trail */}
                    <motion.div
                      animate={{
                        top: ["0%", "92%", "0%"],
                      }}
                      transition={{
                        duration: 2.2,
                        repeat: Infinity,
                        ease: "easeInOut",
                      }}
                      className="absolute inset-x-0 z-30 flex flex-col items-center"
                    >
                      {/* Trailing Glow */}
                      <div
                        className="h-16 w-full opacity-60"
                        style={{
                          background:
                            "linear-gradient(to bottom, transparent, rgba(255, 90, 95, 0.15), rgba(255, 90, 95, 0.45))",
                        }}
                      />
                      {/* Core Laser Beam */}
                      <div className="h-1.5 w-full bg-[#FF5A5F] shadow-[0_0_16px_#FF5A5F,0_0_8px_#FFDE59]" />
                      <div className="h-0.5 w-full bg-white opacity-80" />
                    </motion.div>

                    {/* Scanning Grid Lines */}
                    <div
                      className="absolute inset-0 opacity-20"
                      style={{
                        backgroundImage:
                          "repeating-linear-gradient(0deg, #12100d 0, #12100d 1px, transparent 1px, transparent 12px)",
                      }}
                    />

                    {/* HUD Status Pill */}
                    <div className="absolute top-4 left-1/2 -translate-x-1/2 z-40 flex items-center gap-2 rounded-xl border-2 border-[#12100d] bg-[#FFDE59] px-3.5 py-1.5 font-friday text-xs uppercase tracking-wider text-[#12100d] shadow-[3px_3px_0px_#12100d]">
                      <Scan className="h-4 w-4 animate-spin text-[#12100d]" />
                      <span>SCANNING AVATAR TOPOLOGY ({done + 1}/{chosen.length})</span>
                    </div>

                    {/* Biometric Target Indicator */}
                    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-40 rounded-lg border border-[#12100d] bg-[#7FE06E] px-2.5 py-0.5 font-mono text-[0.62rem] font-black uppercase text-[#12100d] shadow-[2px_2px_0px_#12100d] animate-pulse">
                      ● DYE SYNTHESIS ACTIVE
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ── Error / Note Alert Banner ── */}
          {(note || error) && (
            <div
              role={error ? "alert" : undefined}
              className={`my-1.5 w-full rounded-xl border-2 border-[#12100d] p-2 text-center font-mono text-xs font-bold shadow-[2px_2px_0px_#12100d] ${
                error
                  ? "bg-[#FF5A5F] text-white"
                  : "bg-[#FFDE59] text-[#12100d]"
              }`}
            >
              {error ?? note}
            </div>
          )}

          {/* ── Bottom Controls: Swipe Button (Requires 100% drag to end) ── */}
          <div className="w-full space-y-2 pt-2 border-t-2 border-[#12100d]/15">
            <SwipeButton
              onSwipeComplete={build}
              disabled={building || chosen.length === 0}
              loading={building}
              stepText={`Scanning & Dyeing Layer ${done + 1} of ${chosen.length}...`}
              pieceCount={chosen.length}
            />

            {(chosen.length > 0 || render) && !building && (
              <div className="flex items-center justify-between px-1">
                <button
                  type="button"
                  onClick={() => {
                    setPicked({});
                    setRender(null);
                    setSteps({});
                    setError(null);
                    setNote(null);
                  }}
                  className="flex items-center gap-1 rounded-xl border-2 border-[#12100d] bg-white px-3 py-1 font-mono text-xs font-bold uppercase text-[#12100d] shadow-[2px_2px_0px_#12100d] hover:bg-[#FF5A5F] hover:text-white transition-colors cursor-pointer"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  <span>RESET</span>
                </button>

                <Link
                  href="/artifacts"
                  className="flex items-center gap-1 font-mono text-xs font-black uppercase text-[#12100d] underline decoration-[#FFDE59] decoration-2 underline-offset-2 hover:opacity-80"
                >
                  <span>PAST ARTIFACTS →</span>
                </Link>
              </div>
            )}
          </div>
        </div>

        {/* ── Right Deck: Closet / Your Wardrobe ── */}
        <Carousel3DDeck
          side="right"
          title="Your Wardrobe"
          emptyText="No wardrobe pieces uploaded"
          garments={right}
          openSlots={openSlots}
          onPick={put}
          disabled={building}
        />
      </div>

      {/* ── Celebratory Minted Artifact Reveal Modal ── */}
      <ArtifactModal
        artifact={mintedArtifact}
        isOpen={artifactModalOpen}
        onClose={() => setArtifactModalOpen(false)}
      />

      {/* ── Pull Tab to Wardrobe Closet ── */}
      <RoomTab
        side="right"
        tone="brass"
        label="Wardrobe"
        title={onBackToWardrobe ? "Slide back to the wardrobe" : "Go to the wardrobe"}
        {...(onBackToWardrobe ? { onClick: onBackToWardrobe } : { href: "/wardrobe" })}
      />
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
 *  BIGGER 5 Equip Slots Dock
 * ═══════════════════════════════════════════════════════════════════════════ */

function BiggerSlotDock({
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
    <div className="grid grid-cols-5 gap-2 sm:gap-2.5">
      {SLOTS.map((slot) => {
        const item = picked[slot.id];
        const isOpen = openSlots.has(slot.id);
        const state = steps[slot.id];

        return (
          <div key={slot.id} className="flex flex-col items-center gap-1">
            <div
              title={isOpen ? slot.hint : "Not in frame for this avatar"}
              className={`relative h-20 sm:h-24 w-full overflow-hidden rounded-2xl border-[2.5px] transition-all ${
                item
                  ? "border-[#12100d] bg-white shadow-[3px_3px_0px_#12100d]"
                  : isOpen
                    ? "border-dashed border-[#12100d]/50 bg-white/80 hover:bg-white hover:border-[#12100d]"
                    : "border-[#12100d]/20 bg-[#12100d]/10 opacity-50"
              }`}
            >
              {item ? (
                <>
                  <Image
                    src={item.imageUrl}
                    alt={item.name}
                    fill
                    sizes="100px"
                    className={`object-cover transition-opacity ${
                      state === "working" ? "opacity-35 saturate-50" : ""
                    }`}
                  />

                  {/* Remove Button */}
                  {!disabled && (
                    <button
                      type="button"
                      onClick={() => onClear(slot.id)}
                      aria-label={`Remove ${item.name}`}
                      className="absolute top-1 right-1 flex h-5 w-5 items-center justify-center rounded-lg border border-[#12100d] bg-white text-[#12100d] shadow-[1px_1px_0px_#12100d] hover:bg-[#FF5A5F] hover:text-white transition-colors cursor-pointer z-10"
                    >
                      <X className="h-3 w-3 stroke-[3.5]" />
                    </button>
                  )}

                  {/* Dye dot indicator */}
                  <div
                    className="absolute bottom-1 left-1 h-3 w-3 rounded-full border border-[#12100d] shadow-[1px_1px_0px_#12100d]"
                    style={{ backgroundColor: item.dye.hex }}
                    title={item.dye.name}
                  />

                  {/* Status Indicator */}
                  {state === "working" && (
                    <div className="absolute inset-0 flex items-center justify-center bg-[#FFDE59]/70">
                      <Loader2 className="h-5 w-5 animate-spin text-[#12100d]" />
                    </div>
                  )}
                  {state === "done" && (
                    <span className="absolute bottom-0 inset-x-0 bg-[#7FE06E] py-0.5 text-center font-mono text-[0.62rem] font-black text-[#12100d] border-t border-[#12100d]">
                      EQUIPPED ✓
                    </span>
                  )}
                </>
              ) : (
                <div className="flex h-full flex-col items-center justify-center p-1.5 text-center">
                  {isOpen ? (
                    <div className="flex h-6 w-6 items-center justify-center rounded-full border border-[#12100d]/30 bg-[#FFDE59]/40">
                      <Plus className="h-3.5 w-3.5 text-[#12100d]" />
                    </div>
                  ) : (
                    <Lock className="h-4 w-4 text-[#12100d]/50" />
                  )}
                  <span className="mt-1 font-mono text-[0.62rem] font-black uppercase tracking-wider text-[#12100d]">
                    {slot.label}
                  </span>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
 *  REDEFINED 3D Perspective Coverflow Carousel Deck
 * ═══════════════════════════════════════════════════════════════════════════ */

function Carousel3DDeck({
  side,
  title,
  emptyText,
  garments,
  openSlots,
  onPick,
  disabled,
}: {
  side: "left" | "right";
  title: string;
  emptyText: string;
  garments: Garment[];
  openSlots: Set<SlotId>;
  onPick: (g: Garment) => void;
  disabled: boolean;
}) {
  const [index, setIndex] = useState(0);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const isLeft = side === "left";

  const move = (by: number) => {
    if (!garments.length) return;
    setIndex((i) => (i + by + garments.length) % garments.length);
  };

  // 5 visible cards window around active index
  const visibleCards = useMemo(() => {
    if (!garments.length) return [];
    const len = garments.length;
    const cards: Array<{ garment: Garment; offset: number; indexInList: number }> = [];

    for (let offset = -2; offset <= 2; offset++) {
      const idx = (index + offset + len * 2) % len;
      cards.push({ garment: garments[idx], offset, indexInList: idx });
    }
    return cards;
  }, [garments, index]);

  return (
    <div className="relative hidden h-[26rem] w-[21rem] lg:w-[24rem] xl:w-[26rem] md:flex flex-col items-center justify-between shrink-0">
      {/* Deck Header Badge */}
      <div
        className={`z-30 flex w-full items-center justify-between px-2 ${
          isLeft ? "" : "flex-row-reverse"
        }`}
      >
        <div className="flex items-center gap-1.5 rounded-xl border-2 border-[#12100d] bg-white px-3 py-1 font-friday text-xs uppercase tracking-wider text-[#12100d] shadow-[2px_2px_0px_#12100d]">
          {isLeft ? <ShoppingBag className="h-3.5 w-3.5" /> : <Shirt className="h-3.5 w-3.5" />}
          <span>{title}</span>
        </div>

        {garments.length > 0 && (
          <span className="rounded-lg border border-[#12100d] bg-[#FFDE59] px-2.5 py-0.5 font-mono text-xs font-black text-[#12100d]">
            {String(index + 1).padStart(2, "0")} / {String(garments.length).padStart(2, "0")}
          </span>
        )}
      </div>

      {garments.length === 0 ? (
        <div className="my-auto w-[16rem] rounded-3xl border-[3px] border-dashed border-[#12100d]/40 bg-white/75 p-5 text-center shadow-[4px_4px_0px_#12100d]">
          <p className="font-friday text-base uppercase text-[#12100d]">{emptyText}</p>
          <p className="mt-1 font-mono text-xs text-[#12100d]/70">
            {isLeft
              ? "Use the Rangrez extension on shop pages to add pieces here."
              : "Upload items in the Wardrobe room to build your closet."}
          </p>
        </div>
      ) : (
        /* ── Redefined 3D Coverflow Container ── */
        <div className="relative h-[21rem] w-full flex items-center justify-center perspective-[1000px]">
          {visibleCards.map(({ garment, offset, indexInList }) => {
            const isCenter = offset === 0;
            const isHovered = hoveredId === garment.id;
            const slot = slotFor(garment);
            const blocked = slot !== null && !openSlots.has(slot);

            // Compute 3D translations & rotations
            const xOffset = offset * 70;
            const zOffset = -Math.abs(offset) * 65;
            const rotateY = -offset * 12;
            const scale = isCenter ? (isHovered ? 1.08 : 1) : 0.88 - Math.abs(offset) * 0.06;
            const zIndex = 20 - Math.abs(offset) * 2 + (isHovered ? 10 : 0);

            return (
              <motion.div
                key={`${garment.id}-${offset}`}
                animate={{
                  x: xOffset,
                  z: zOffset,
                  rotateY: rotateY,
                  scale: scale,
                  y: isHovered ? -24 : 0,
                }}
                transition={{ type: "spring", stiffness: 260, damping: 24 }}
                onMouseEnter={() => setHoveredId(garment.id)}
                onMouseLeave={() => setHoveredId(null)}
                onClick={() => {
                  if (isCenter) {
                    onPick(garment);
                  } else {
                    setIndex(indexInList);
                  }
                }}
                style={{
                  zIndex,
                  transformStyle: "preserve-3d",
                }}
                className="absolute w-[11.5rem] cursor-pointer select-none"
              >
                <div
                  className={`relative flex flex-col rounded-t-[2.85rem] rounded-b-2xl bg-white p-2 text-left transition-all overflow-hidden ${
                    isCenter
                      ? "shadow-[0_16px_36px_rgba(18,16,13,0.35),0_6px_0px_rgba(18,16,13,0.85)] scale-100"
                      : "shadow-[0_10px_24px_rgba(18,16,13,0.25),0_4px_0px_rgba(18,16,13,0.7)] opacity-90"
                  }`}
                >
                  {/* Plate Aspect View with Arch Top */}
                  <div className="relative aspect-[1063/1752] rounded-t-[2.5rem] rounded-b-xl overflow-hidden bg-[#FAF6EF]">
                    <GarmentPlate garment={garment} />

                    {/* Store Price / Material Badge */}
                    <div className="absolute top-3 left-3 flex flex-col gap-1 z-10">
                      {isLeft ? (
                        <span className="rounded-lg bg-[#FFDE59] px-2 py-0.5 font-mono text-[0.65rem] font-black text-[#12100d] shadow-[2px_2px_0px_rgba(0,0,0,0.4)]">
                          ₹{(ESTIMATED_ZONE_PRICES[garment.zone] || 2490).toLocaleString()}
                        </span>
                      ) : (
                        <span className="rounded-lg bg-[#7FE06E] px-2 py-0.5 font-mono text-[0.65rem] font-black text-[#12100d] shadow-[2px_2px_0px_rgba(0,0,0,0.4)]">
                          OWNED
                        </span>
                      )}
                    </div>

                    {blocked && (
                      <span className="absolute inset-0 z-20 flex items-center justify-center bg-[#12100d]/75 p-2 text-center backdrop-blur-sm">
                        <span className="font-friday text-xs text-white uppercase tracking-wider">
                          NOT IN FRAME
                        </span>
                      </span>
                    )}
                  </div>

                  {/* Card Title & Bottom Action */}
                  <div className="mt-2 px-1">
                    <p className="truncate font-friday text-sm uppercase text-[#12100d]">
                      {garment.name}
                    </p>
                    <span className="font-mono text-[0.65rem] font-bold text-[#12100d]/60 uppercase">
                      {garment.zone} · {garment.dye.name}
                    </span>
                  </div>

                  {/* Interactive Button */}
                  <button
                    type="button"
                    disabled={disabled}
                    onClick={(e) => {
                      e.stopPropagation();
                      onPick(garment);
                    }}
                    className={`mt-2 w-full rounded-xl py-2 font-friday text-xs uppercase tracking-wider transition-all cursor-pointer ${
                      blocked
                        ? "bg-[#FF5A5F] text-white cursor-not-allowed"
                        : "bg-[#FFDE59] text-[#12100d] shadow-[2px_2px_0px_rgba(0,0,0,0.3)] hover:bg-[#7FE06E] active:translate-x-[1px] active:translate-y-[1px]"
                    }`}
                  >
                    {blocked ? "CAN'T WEAR" : isCenter ? "EQUIP ➔" : "SELECT"}
                  </button>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* ── Carousel Step Controls ── */}
      {garments.length > 0 && (
        <div className="z-30 flex items-center gap-3">
          <button
            type="button"
            disabled={disabled}
            onClick={() => move(-1)}
            aria-label="Previous garment"
            className="flex h-10 w-10 items-center justify-center rounded-2xl border-[2.5px] border-[#12100d] bg-white text-[#12100d] shadow-[3px_3px_0px_#12100d] hover:bg-[#FFDE59] active:translate-x-[1px] active:translate-y-[1px] transition-all cursor-pointer disabled:opacity-40"
          >
            <ChevronLeft className="h-5 w-5 stroke-[3]" />
          </button>
          <span className="font-mono text-xs font-black uppercase text-[#12100d]">
            ROTATE CAROUSEL
          </span>
          <button
            type="button"
            disabled={disabled}
            onClick={() => move(1)}
            aria-label="Next garment"
            className="flex h-10 w-10 items-center justify-center rounded-2xl border-[2.5px] border-[#12100d] bg-white text-[#12100d] shadow-[3px_3px_0px_#12100d] hover:bg-[#FFDE59] active:translate-x-[1px] active:translate-y-[1px] transition-all cursor-pointer disabled:opacity-40"
          >
            <ChevronRight className="h-5 w-5 stroke-[3]" />
          </button>
        </div>
      )}
    </div>
  );
}

function split(garments: Garment[]): { left: Garment[]; right: Garment[] } {
  const left: Garment[] = [];
  const right: Garment[] = [];
  let seedFlip = false;

  for (const g of garments) {
    if (g.origin === "shop" || g.sourceUrl) left.push(g);
    else if (g.origin === "seed") {
      (seedFlip ? right : left).push(g);
      seedFlip = !seedFlip;
    } else {
      right.push(g);
    }
  }
  return { left, right };
}
