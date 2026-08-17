"use client";

import Image from "next/image";
import { useState, useTransition } from "react";
import { motion, AnimatePresence } from "framer-motion";

import { GarmentPlate } from "./GarmentPlate";
import { tintOf } from "@/lib/tint";
import { ORIGIN_LABEL, type Avatar, type Garment } from "@/lib/types";

export function GarmentModal({
  garment: initialGarment,
  avatars,
  activeAvatarId,
  onClose,
  onUpdateGarment,
}: {
  garment: Garment;
  avatars: Avatar[];
  activeAvatarId?: string;
  onClose: () => void;
  onUpdateGarment?: (updated: Garment) => void;
}) {
  const [garment, setGarment] = useState<Garment>(initialGarment);
  const [selectedAvatarId, setSelectedAvatarId] = useState<string>(
    activeAvatarId ?? avatars[0]?.id ?? "",
  );
  const [viewMode, setViewMode] = useState<"garment" | "worn">(
    garment.tryOnUrl ? "worn" : "garment",
  );
  const [tryOnStageOpen, setTryOnStageOpen] = useState(false);
  const [isRendering, setIsRendering] = useState(false);
  const [renderError, setRenderError] = useState<string | null>(null);

  const selectedAvatar = avatars.find((a) => a.id === selectedAvatarId) ?? avatars[0];

  const handleRunTryOn = async () => {
    if (!selectedAvatar) {
      setRenderError("No avatar selected for try-on.");
      return;
    }

    setIsRendering(true);
    setRenderError(null);

    try {
      const res = await fetch("/api/wardrobe/render", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: garment.id,
          avatarId: selectedAvatar.id,
        }),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error ?? "Try-on fitting failed.");
      }

      if (json.tryOnUrl) {
        const updated = {
          ...garment,
          tryOnUrl: json.tryOnUrl,
          tryOnAvatarId: selectedAvatar.id,
          status: "rendered" as const,
        };
        setGarment(updated);
        setViewMode("worn");
        setTryOnStageOpen(false);
        onUpdateGarment?.(updated);
      }
    } catch (err) {
      setRenderError(err instanceof Error ? err.message : "Try-on failed.");
    } finally {
      setIsRendering(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal
      aria-label={garment.name}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#12100d]/75 backdrop-blur-md overflow-y-auto"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.94, y: 15, opacity: 0 }}
        animate={{ scale: 1, y: 0, opacity: 1 }}
        exit={{ scale: 0.94, y: 15, opacity: 0 }}
        transition={{ type: "spring", stiffness: 350, damping: 25 }}
        className="relative flex w-full max-w-4xl flex-col lg:flex-row overflow-hidden rounded-3xl border-[3px] border-[#12100d] bg-[#F4EFE6] shadow-[10px_10px_0px_#12100d] my-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Left Column: Preview Stage ── */}
        <div className="relative aspect-square w-full lg:w-1/2 bg-white border-b-2 lg:border-b-0 lg:border-r-[3px] border-[#12100d] p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between z-10">
            <span className="border-2 border-[#12100d] bg-[#FFDE59] px-2.5 py-0.5 font-mono text-[0.68rem] font-black uppercase text-[#12100d] shadow-[2px_2px_0px_#12100d]">
              {ORIGIN_LABEL[garment.origin].toUpperCase()}
            </span>

            {/* View Switcher: Flat Cutout vs Rendered on Body */}
            {garment.tryOnUrl && (
              <div className="flex gap-1 bg-[#F4EFE6] border-2 border-[#12100d] p-1 rounded-xl shadow-[2px_2px_0px_#12100d]">
                <button
                  type="button"
                  onClick={() => setViewMode("garment")}
                  className={`px-2.5 py-0.5 rounded-lg font-mono text-[0.62rem] font-black uppercase transition-all ${
                    viewMode === "garment"
                      ? "bg-[#12100d] text-white"
                      : "text-[#12100d]/70 hover:bg-white"
                  }`}
                >
                  Flat Cutout
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode("worn")}
                  className={`px-2.5 py-0.5 rounded-lg font-mono text-[0.62rem] font-black uppercase transition-all ${
                    viewMode === "worn"
                      ? "bg-[#FFDE59] text-[#12100d]"
                      : "text-[#12100d]/70 hover:bg-white"
                  }`}
                >
                  On Body ✦
                </button>
              </div>
            )}
          </div>

          {/* Main Visual Image */}
          <div className="relative flex-1 min-h-[280px] w-full flex items-center justify-center p-4">
            {viewMode === "worn" && garment.tryOnUrl ? (
              <div className="relative h-full w-full">
                <Image
                  src={garment.tryOnUrl}
                  alt={`${garment.name} rendered on avatar`}
                  fill
                  className="object-contain drop-shadow-[0_12px_24px_rgba(0,0,0,0.3)] rounded-2xl"
                />
                <span className="absolute bottom-2 left-2 border border-[#12100d] bg-[#59C3C3] px-2 py-0.5 font-mono text-[0.62rem] font-black uppercase text-[#12100d]">
                  VIRTUAL FIT RENDER
                </span>
              </div>
            ) : (
              <div className="relative h-full w-full">
                <GarmentPlate garment={garment} showName={false} />
              </div>
            )}
          </div>

          {/* Dye & Palette match */}
          <div className="flex items-center gap-2 z-10 border-t border-[#12100d]/10 pt-2">
            <span
              className="h-3.5 w-3.5 rounded-full border border-[#12100d]"
              style={{ backgroundColor: garment.dye.hex }}
            />
            <span className="font-mono text-xs font-bold text-[#12100d]">
              DYE: {garment.dye.name.toUpperCase()}
            </span>
          </div>
        </div>

        {/* ── Right Column: Specs & Try-On Pipeline ── */}
        <div className="flex min-w-0 flex-1 flex-col justify-between gap-6 p-6 sm:p-8">
          <div>
            <div className="flex items-center justify-between gap-2">
              <span className="border border-[#12100d] bg-[#59C3C3] px-2 py-0.5 font-mono text-[0.65rem] font-black uppercase text-[#12100d]">
                {garment.zone.toUpperCase()}
              </span>
              <button
                type="button"
                onClick={onClose}
                className="border-2 border-[#12100d] bg-[#FF5A5F] px-2.5 py-0.5 text-xs font-black text-white shadow-[2px_2px_0px_#12100d] hover:bg-[#FF3B42] active:translate-x-[1px] active:translate-y-[1px] cursor-pointer"
              >
                ✕
              </button>
            </div>

            <h2 className="font-friday text-3xl uppercase tracking-wide text-[#12100d] mt-3">
              {garment.name}
            </h2>
            <p className="font-mono text-xs text-[#12100d]/70 mt-1 leading-relaxed">
              Material: <b>{garment.material}</b>
            </p>

            {/* Spec Matrix Grid */}
            <div className="mt-5 grid grid-cols-2 gap-2.5 border-2 border-[#12100d] bg-white p-3 rounded-2xl shadow-[3px_3px_0px_#12100d]">
              <div>
                <span className="font-mono text-[0.62rem] text-[#12100d]/50 uppercase block">Size Label</span>
                <p className="font-mono text-xs font-black text-[#12100d] uppercase">{garment.sizeLabel ?? "STANDARD"}</p>
              </div>
              <div>
                <span className="font-mono text-[0.62rem] text-[#12100d]/50 uppercase block">Cut & Fit</span>
                <p className="font-mono text-xs font-black text-[#12100d] uppercase">{garment.fit?.cut ?? "REGULAR"}</p>
              </div>
              <div>
                <span className="font-mono text-[0.62rem] text-[#12100d]/50 uppercase block">Times Worn</span>
                <p className="font-mono text-xs font-black text-[#12100d] uppercase">{garment.wornCount}× IN STUDIO</p>
              </div>
              <div>
                <span className="font-mono text-[0.62rem] text-[#12100d]/50 uppercase block">Season Tag</span>
                <p className="font-mono text-xs font-black text-[#12100d] uppercase">{garment.season.toUpperCase()}</p>
              </div>
            </div>

            {/* ── LIVE RE-TRYON STAGE ACCORDION / DRAWER ── */}
            {tryOnStageOpen ? (
              <div className="mt-5 rounded-2xl border-2 border-[#12100d] bg-[#FFFBEA] p-4 shadow-[3px_3px_0px_#12100d] space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-friday text-sm uppercase text-[#12100d]">
                    ⚡ Virtual Fitting Stage
                  </span>
                  <button
                    type="button"
                    onClick={() => setTryOnStageOpen(false)}
                    className="font-mono text-[0.68rem] text-[#12100d]/60 hover:text-[#12100d]"
                  >
                    CANCEL
                  </button>
                </div>

                {/* Avatar Target Picker */}
                {avatars.length > 1 && (
                  <div>
                    <label className="font-mono text-[0.65rem] font-bold text-[#12100d]/60 uppercase block mb-1">
                      Choose Avatar Body Target:
                    </label>
                    <div className="flex gap-2">
                      {avatars.map((av) => (
                        <button
                          key={av.id}
                          type="button"
                          onClick={() => setSelectedAvatarId(av.id)}
                          className={`flex-1 border-2 border-[#12100d] p-1.5 rounded-xl font-mono text-[0.65rem] font-black uppercase shadow-[1px_1px_0px_#12100d] ${
                            av.id === selectedAvatarId
                              ? "bg-[#FFDE59] text-[#12100d]"
                              : "bg-white text-[#12100d]/70 hover:bg-[#FAF6EF]"
                          }`}
                        >
                          {av.customization.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {renderError && (
                  <p className="border border-[#12100d] bg-[#FF5A5F] p-2 rounded-lg font-mono text-xs text-white">
                    {renderError}
                  </p>
                )}

                <button
                  type="button"
                  disabled={isRendering}
                  onClick={handleRunTryOn}
                  className="w-full border-2 border-[#12100d] bg-[#12100d] py-2.5 rounded-xl font-friday text-xs uppercase tracking-wider text-white shadow-[3px_3px_0px_#FFDE59] hover:bg-[#FFDE59] hover:text-[#12100d] transition-all cursor-pointer disabled:opacity-50"
                >
                  {isRendering ? "RENDERING ON YOUR AVATAR BODY..." : "GENERATE TRY-ON FIT NOW ✦"}
                </button>
              </div>
            ) : null}
          </div>

          {/* Bottom Actions Row */}
          <div className="flex flex-wrap items-center gap-3 pt-3 border-t-2 border-[#12100d]/15">
            {!tryOnStageOpen && (
              <button
                type="button"
                onClick={() => setTryOnStageOpen(true)}
                className="flex-1 border-2 border-[#12100d] bg-[#FFDE59] py-3 rounded-2xl font-friday text-xs uppercase tracking-wider text-[#12100d] shadow-[3px_3px_0px_#12100d] hover:bg-[#FFE57F] active:translate-x-[1px] active:translate-y-[1px] transition-all cursor-pointer flex items-center justify-center gap-2"
              >
                <span>⚡ RE-TRYON ON AVATAR</span>
                <span>→</span>
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              className="border-2 border-[#12100d] bg-white py-3 px-6 rounded-2xl font-friday text-xs uppercase tracking-wider text-[#12100d] shadow-[2px_2px_0px_#12100d] hover:bg-[#FAF6EF] active:translate-x-[1px] active:translate-y-[1px] cursor-pointer"
            >
              CLOSE
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
