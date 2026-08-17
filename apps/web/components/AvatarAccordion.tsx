"use client";

import Image from "next/image";
import Link from "next/link";
import { useState, useTransition } from "react";
import { motion, AnimatePresence } from "framer-motion";

import { deleteAvatar, setActiveAvatar } from "@/app/actions/avatars";
import { FRAMING, MAX_AVATARS, type Avatar, type Measurements } from "@/lib/types";

export function AvatarAccordion({
  avatars,
  activeId,
  globalMeasurements,
}: {
  avatars: Avatar[];
  activeId?: string;
  globalMeasurements: Measurements;
}) {
  const [expandedId, setExpandedId] = useState<string>(
    activeId ?? avatars[0]?.id ?? "",
  );
  const [isPending, startTransition] = useTransition();

  const handleSetActive = (id: string) => {
    const fd = new FormData();
    fd.set("id", id);
    startTransition(() => {
      setActiveAvatar(fd);
    });
  };

  const handleDelete = (id: string, label: string) => {
    if (confirm(`Delete body plate "${label}"?`)) {
      const fd = new FormData();
      fd.set("id", id);
      startTransition(() => {
        deleteAvatar(fd);
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* ── Accordion Row ── */}
      <div className="flex flex-col lg:flex-row gap-4 items-stretch min-h-[480px]">
        {avatars.map((av, index) => {
          const isExpanded = av.id === expandedId;
          const isActive = av.id === activeId;
          const framingInfo = FRAMING[av.framing ?? "full"];
          const hasCustomMeasurements = Boolean(
            av.measurements && Object.keys(av.measurements).length > 2,
          );
          const effectiveMeasurements = av.measurements ?? globalMeasurements;

          return (
            <motion.div
              key={av.id}
              layout
              onClick={() => {
                if (!isExpanded) setExpandedId(av.id);
              }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
              className={`relative overflow-hidden rounded-3xl border-[3px] border-[#12100d] transition-all cursor-pointer ${
                isExpanded
                  ? "flex-[2.8] bg-white p-6 shadow-[8px_8px_0px_#12100d]"
                  : "flex-1 bg-[#F4EFE6] p-4 shadow-[4px_4px_0px_#12100d] hover:bg-[#EBE3D5] hover:shadow-[6px_6px_0px_#12100d]"
              } ${isActive ? "ring-2 ring-[#FFDE59]" : ""}`}
            >
              {/* Card Tag Badge */}
              <div className="flex items-center justify-between gap-2 mb-4">
                <span className="border-2 border-[#12100d] bg-[#FFDE59] px-2.5 py-0.5 font-mono text-[0.68rem] font-black uppercase text-[#12100d] shadow-[1px_1px_0px_#12100d]">
                  PLATE 0{index + 1}
                </span>

                {isActive && (
                  <span className="border-2 border-[#12100d] bg-[#12100d] px-2 py-0.5 font-mono text-[0.65rem] font-black uppercase text-white shadow-[1px_1px_0px_#12100d]">
                    ACTIVE
                  </span>
                )}
              </div>

              {/* ── EXPANDED CARD VIEW ── */}
              {isExpanded ? (
                <div className="flex flex-col md:flex-row gap-6 h-full">
                  {/* Left: Avatar Portrait */}
                  <div className="relative h-64 md:h-80 w-full md:w-56 shrink-0 overflow-hidden rounded-2xl border-2 border-[#12100d] bg-[#EBE3D5] shadow-[3px_3px_0px_#12100d]">
                    <Image
                      src={av.renderUrl}
                      alt={av.customization.label}
                      fill
                      priority
                      className="object-cover"
                    />
                    <span className="absolute bottom-2 left-2 border border-[#12100d] bg-white px-2 py-0.5 font-mono text-[0.62rem] font-black uppercase text-[#12100d]">
                      {framingInfo.label.toUpperCase()}
                    </span>
                  </div>

                  {/* Right: Plate Info, Specs & Actions */}
                  <div className="flex-1 flex flex-col justify-between space-y-4">
                    <div>
                      <h3 className="font-friday text-2xl uppercase tracking-wide text-[#12100d]">
                        {av.customization.label}
                      </h3>
                      <p className="font-mono text-xs text-[#12100d]/60 mt-0.5">
                        Framing: {framingInfo.label} · {framingInfo.note}
                      </p>

                      {/* Color Season */}
                      <div className="mt-3 flex items-center gap-2">
                        <span className="border border-[#12100d] bg-[#59C3C3] px-2 py-0.5 font-mono text-[0.65rem] font-black uppercase text-[#12100d]">
                          SEASON: {av.colorSeason?.name ?? "DEEP AUTUMN"}
                        </span>
                        <span className="border border-[#12100d] bg-[#FAF6EF] px-2 py-0.5 font-mono text-[0.65rem] font-bold text-[#12100d]/70">
                          {hasCustomMeasurements ? "CUSTOM MEASUREMENTS" : "GLOBAL MEASUREMENTS"}
                        </span>
                      </div>

                      {/* Measurements Breakdown */}
                      <div className="mt-4 rounded-2xl border-2 border-[#12100d] bg-[#F4EFE6] p-3.5 shadow-[2px_2px_0px_#12100d]">
                        <p className="font-mono text-[0.65rem] font-black uppercase text-[#12100d]/60 mb-2">
                          BODY PROFILE SPECS
                        </p>
                        <div className="grid grid-cols-3 gap-2 font-mono text-xs text-[#12100d]">
                          <div>
                            <span className="text-[0.62rem] text-[#12100d]/50 block uppercase">Height</span>
                            <b>{effectiveMeasurements.heightCm ?? 175} cm</b>
                          </div>
                          <div>
                            <span className="text-[0.62rem] text-[#12100d]/50 block uppercase">Chest</span>
                            <b>{effectiveMeasurements.chestCm ?? 96} cm</b>
                          </div>
                          <div>
                            <span className="text-[0.62rem] text-[#12100d]/50 block uppercase">Waist</span>
                            <b>{effectiveMeasurements.waistCm ?? 82} cm</b>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex flex-wrap items-center gap-2.5 pt-3 border-t border-[#12100d]/15">
                      {!isActive && (
                        <button
                          type="button"
                          disabled={isPending}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSetActive(av.id);
                          }}
                          className="flex-1 border-2 border-[#12100d] bg-[#FFDE59] py-2 px-3 font-friday text-xs uppercase tracking-wider text-[#12100d] shadow-[2px_2px_0px_#12100d] hover:bg-[#FFE57F] active:translate-x-[1px] active:translate-y-[1px] cursor-pointer"
                        >
                          USE THIS BODY ⚡
                        </button>
                      )}

                      <Link
                        href={`/avatars/new?replace=${av.id}`}
                        onClick={(e) => e.stopPropagation()}
                        className="border-2 border-[#12100d] bg-white py-2 px-3 font-friday text-xs uppercase tracking-wider text-[#12100d] shadow-[2px_2px_0px_#12100d] hover:bg-[#FAF6EF]"
                      >
                        RE-SHOOT ↺
                      </Link>

                      {avatars.length > 1 && (
                        <button
                          type="button"
                          disabled={isPending}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(av.id, av.customization.label);
                          }}
                          className="border-2 border-[#12100d] bg-[#FF5A5F] py-2 px-3 font-friday text-xs uppercase tracking-wider text-white shadow-[2px_2px_0px_#12100d] hover:bg-[#FF3B42] active:translate-x-[1px] active:translate-y-[1px] cursor-pointer"
                        >
                          DELETE ✕
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                /* ── COLLAPSED ACCORDION CARD ── */
                <div className="flex flex-col items-center justify-between h-full py-4 text-center">
                  <div className="relative aspect-[3/4] w-full max-w-[140px] overflow-hidden rounded-2xl border-2 border-[#12100d] bg-white shadow-[2px_2px_0px_#12100d]">
                    <Image
                      src={av.renderUrl}
                      alt={av.customization.label}
                      fill
                      className="object-cover"
                    />
                  </div>

                  <div className="mt-4">
                    <h4 className="font-friday text-base uppercase text-[#12100d] truncate max-w-[160px]">
                      {av.customization.label}
                    </h4>
                    <p className="font-mono text-[0.65rem] text-[#12100d]/60 mt-0.5">
                      {framingInfo.label}
                    </p>
                  </div>

                  <span className="mt-4 font-mono text-[0.65rem] font-bold text-[#12100d] bg-white border border-[#12100d] px-2 py-0.5 rounded-lg">
                    CLICK TO EXPAND →
                  </span>
                </div>
              )}
            </motion.div>
          );
        })}

        {/* Empty Slot Card if < 3 avatars */}
        {avatars.length < MAX_AVATARS && (
          <Link
            href="/avatars/new"
            className="flex-1 flex flex-col items-center justify-center p-8 rounded-3xl border-[3px] border-dashed border-[#12100d] bg-white/60 hover:bg-white text-center shadow-[4px_4px_0px_#12100d] hover:shadow-[6px_6px_0px_#12100d] transition-all group cursor-pointer min-h-[300px]"
          >
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl border-2 border-[#12100d] bg-[#FFDE59] text-2xl font-black text-[#12100d] shadow-[2px_2px_0px_#12100d] group-hover:scale-110 transition-transform">
              +
            </div>
            <h4 className="font-friday text-lg uppercase tracking-wide text-[#12100d] mt-4">
              Add Avatar Plate
            </h4>
            <p className="font-mono text-xs text-[#12100d]/60 mt-1 max-w-[20ch]">
              Shoot or upload your body model (Plate 0{avatars.length + 1})
            </p>
          </Link>
        )}
      </div>

      {/* Bottom Actions Row */}
      <div className="flex items-center justify-between pt-4">
        <p className="font-mono text-xs text-[#12100d]/60">
          Max {MAX_AVATARS} registered bodies. Active plate is used across Wardrobe & Trial Room.
        </p>

        {avatars.length < MAX_AVATARS && (
          <Link
            href="/avatars/new"
            className="border-[3px] border-[#12100d] bg-[#12100d] px-6 py-2.5 rounded-2xl font-friday text-xs uppercase tracking-wider text-white shadow-[4px_4px_0px_#FFDE59] hover:bg-[#FFDE59] hover:text-[#12100d] transition-all"
          >
            + ADD AVATAR
          </Link>
        )}
      </div>
    </div>
  );
}
