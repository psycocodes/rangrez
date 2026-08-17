"use client";

import Image from "next/image";
import Link from "next/link";
import { useState, useTransition } from "react";
import { motion, AnimatePresence } from "framer-motion";

import { setActiveAvatar } from "@/app/actions/avatars";
import type { Avatar, Garment } from "@/lib/types";
import type { BaseModelStatus } from "@/lib/base-models-server";
import { figureArt } from "@/lib/base-models";

export interface HistoryItem {
  id: string;
  type: "tryon" | "upload" | "look";
  title: string;
  subtitle: string;
  timestamp: string;
  imageUrl: string;
  colorHex?: string;
  seasonTag?: string;
  status: "completed" | "saved" | "active";
}

export function TrainRoomDrawer({
  isOpen,
  onClose,
  avatars,
  activeAvatarId,
  baseModels,
  garments,
  userName,
  colorSeason,
}: {
  isOpen: boolean;
  onClose: () => void;
  avatars: Avatar[];
  activeAvatarId?: string;
  baseModels: BaseModelStatus[];
  garments: Garment[];
  userName: string;
  colorSeason?: string;
}) {
  const [activeTab, setActiveTab] = useState<"plates" | "fitting" | "history">("plates");
  const [selectedGarment, setSelectedGarment] = useState<Garment | null>(garments[0] ?? null);
  const [isPending, startTransition] = useTransition();

  const activeAvatar = avatars.find((a) => a.id === activeAvatarId) ?? avatars[0];

  // Demo / Initial history items generated from user garments and tryons
  const historyItems: HistoryItem[] = [
    {
      id: "h-1",
      type: "tryon",
      title: "Striped Linen Overshirt",
      subtitle: "Rendered on " + (activeAvatar?.customization.label ?? "Primary Plate"),
      timestamp: "Today, 11:42 AM",
      imageUrl: garments[0]?.imageUrl ?? "/seed/raw-denim-straight.png",
      colorHex: "#FFDE59",
      seasonTag: colorSeason ?? "Deep Autumn",
      status: "completed",
    },
    {
      id: "h-2",
      type: "look",
      title: "Weekend Casual Ensemble",
      subtitle: "Top + Chinos + Oxford Loafers",
      timestamp: "Yesterday, 4:15 PM",
      imageUrl: garments[1]?.imageUrl ?? "/seed/raw-denim-straight.png",
      colorHex: "#59C3C3",
      seasonTag: "Match 96%",
      status: "saved",
    },
    {
      id: "h-3",
      type: "upload",
      title: "Navy Chore Coat",
      subtitle: "Digitized from Camera Roll",
      timestamp: "16 Aug, 6:30 PM",
      imageUrl: garments[2]?.imageUrl ?? "/seed/raw-denim-straight.png",
      colorHex: "#2B4C7E",
      seasonTag: "Wardrobe Add",
      status: "active",
    },
    {
      id: "h-4",
      type: "tryon",
      title: "Terracotta Pleated Trousers",
      subtitle: "Rendered against Studio Light",
      timestamp: "15 Aug, 2:10 PM",
      imageUrl: garments[3]?.imageUrl ?? "/seed/raw-denim-straight.png",
      colorHex: "#C86D51",
      seasonTag: colorSeason ?? "Deep Autumn",
      status: "completed",
    },
  ];

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 overflow-hidden">
          {/* Backdrop */}
          <motion.div
            className="absolute inset-0 bg-[#12100d]/60 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />

          {/* Right Sliding Window */}
          <motion.aside
            role="dialog"
            aria-label="Train Room & Studio"
            className="absolute right-0 top-0 bottom-0 flex w-full max-w-2xl flex-col border-l-[3px] border-[#12100d] bg-[#F4EFE6] shadow-[-8px_0px_0px_#12100d] z-50 text-[#12100d] overflow-hidden"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", stiffness: 280, damping: 28 }}
          >
            {/* ── Drawer Header ───────────────────────────────────────── */}
            <div className="flex shrink-0 items-center justify-between border-b-[3px] border-[#12100d] bg-white px-5 py-3.5 shadow-[0px_3px_0px_#12100d]">
              <div className="flex items-center gap-3">
                <span className="border-2 border-[#12100d] bg-[#FF5A5F] px-2.5 py-1 font-mono text-[0.75rem] font-black uppercase text-white shadow-[2px_2px_0px_#12100d]">
                  02 — STUDIO
                </span>
                <h2 className="font-friday text-xl uppercase tracking-wider text-[#12100d]">
                  TRAIN ROOM
                </h2>
              </div>

              <button
                type="button"
                onClick={onClose}
                className="border-2 border-[#12100d] bg-[#FF5A5F] px-3 py-1 text-xs font-black uppercase text-white shadow-[2px_2px_0px_#12100d] transition-all hover:bg-[#FF3B42] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none cursor-pointer"
              >
                CLOSE ✕
              </button>
            </div>

            {/* ── Tab Navigation Bar ──────────────────────────────────── */}
            <div className="flex shrink-0 items-center gap-2 border-b-[3px] border-[#12100d] bg-[#F4EFE6] p-3">
              {[
                { key: "plates", label: "✦ AVATARS & PLATES" },
                { key: "fitting", label: "⚡ TRY-ON FITTING" },
                { key: "history", label: "⏱ HISTORY & LOGS" },
              ].map((t) => (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => setActiveTab(t.key as any)}
                  className={`flex-1 border-2 border-[#12100d] py-2 text-center text-[0.75rem] font-black tracking-wider uppercase transition-all shadow-[2px_2px_0px_#12100d] active:translate-x-[1px] active:translate-y-[1px] ${
                    activeTab === t.key
                      ? "bg-[#FFDE59] text-[#12100d]"
                      : "bg-white text-[#12100d]/70 hover:bg-[#FAF6EF] hover:text-[#12100d]"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {/* ── Drawer Scrollable Content ───────────────────────────── */}
            <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6">
              {/* TAB 1: AVATARS & PLATES */}
              {activeTab === "plates" && (
                <div className="space-y-6">
                  {/* Current Active Plate Banner */}
                  <div className="rounded-2xl border-[3px] border-[#12100d] bg-white p-4 shadow-[4px_4px_0px_#12100d]">
                    <div className="flex items-start gap-4">
                      <div className="relative h-28 w-20 shrink-0 overflow-hidden rounded-xl border-2 border-[#12100d] bg-[#EBE3D5] shadow-[2px_2px_0px_#12100d]">
                        {activeAvatar ? (
                          <Image
                            src={activeAvatar.renderUrl}
                            alt={activeAvatar.customization.label}
                            fill
                            className="object-cover"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center font-mono text-xs text-[#12100d]/40">
                            NO AVATAR
                          </div>
                        )}
                        <span className="absolute bottom-0 inset-x-0 border-t border-[#12100d] bg-[#FFDE59] text-center font-mono text-[0.58rem] font-black uppercase text-[#12100d]">
                          ACTIVE BODY
                        </span>
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="border border-[#12100d] bg-[#59C3C3] px-2 py-0.5 font-mono text-[0.68rem] font-black uppercase text-[#12100d]">
                            IN USE
                          </span>
                          <span className="font-friday text-lg uppercase tracking-wide truncate">
                            {activeAvatar?.customization.label ?? "Primary Avatar"}
                          </span>
                        </div>

                        <p className="mt-1 text-xs text-[#12100d]/70 font-medium">
                          Framing: <b className="uppercase">{activeAvatar?.framing ?? "Full Length"}</b> · Body Plate
                        </p>

                        {colorSeason && (
                          <div className="mt-2.5 flex items-center gap-2">
                            <span className="border border-[#12100d] bg-[#FFDE59] px-2 py-0.5 font-mono text-[0.65rem] font-bold uppercase text-[#12100d]">
                              PALETTE: {colorSeason}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Your Bodies Shelf */}
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="font-friday text-sm uppercase tracking-wider text-[#12100d]">
                        YOUR REGISTERED PLATES ({avatars.length}/3)
                      </h3>
                      <Link
                        href="/atelier"
                        className="border-2 border-[#12100d] bg-[#FFDE59] px-2.5 py-1 font-mono text-[0.68rem] font-black uppercase text-[#12100d] shadow-[2px_2px_0px_#12100d] hover:bg-[#FFE57F]"
                      >
                        + SHOOT NEW
                      </Link>
                    </div>

                    <div className="grid grid-cols-3 gap-3">
                      {avatars.map((av) => {
                        const isCurrent = av.id === activeAvatarId;
                        return (
                          <div
                            key={av.id}
                            className={`flex flex-col rounded-xl border-2 border-[#12100d] bg-white p-2.5 shadow-[3px_3px_0px_#12100d] transition-all ${
                              isCurrent ? "ring-2 ring-[#FFDE59] bg-[#FFFBEA]" : ""
                            }`}
                          >
                            <div className="relative aspect-[3/4] w-full overflow-hidden rounded-lg border border-[#12100d] bg-[#EBE3D5]">
                              <Image
                                src={av.renderUrl}
                                alt={av.customization.label}
                                fill
                                className="object-cover"
                              />
                            </div>
                            <span className="mt-2 truncate font-friday text-xs uppercase">
                              {av.customization.label}
                            </span>
                            <form
                              action={(fd) => {
                                startTransition(() => {
                                  setActiveAvatar(fd);
                                });
                              }}
                              className="mt-2"
                            >
                              <input type="hidden" name="id" value={av.id} />
                              <button
                                type="submit"
                                disabled={isCurrent || isPending}
                                className={`w-full border border-[#12100d] py-1 font-mono text-[0.62rem] font-black uppercase shadow-[1px_1px_0px_#12100d] active:translate-x-[1px] active:translate-y-[1px] cursor-pointer ${
                                  isCurrent
                                    ? "bg-[#12100d] text-white cursor-default"
                                    : "bg-[#FFDE59] text-[#12100d] hover:bg-[#FFE57F]"
                                }`}
                              >
                                {isCurrent ? "SELECTED" : "SWITCH"}
                              </button>
                            </form>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Borrow Base Models */}
                  <div>
                    <h3 className="font-friday text-sm uppercase tracking-wider text-[#12100d] mb-3">
                      BORROW A BASE MODEL
                    </h3>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      {baseModels.map((m) => (
                        <div
                          key={m.id}
                          className="flex flex-col rounded-xl border-2 border-[#12100d] bg-white p-2.5 shadow-[3px_3px_0px_#12100d]"
                        >
                          <div className="relative aspect-[3/4] w-full overflow-hidden rounded-lg border border-[#12100d] bg-[#EBE3D5]">
                            {m.plateUrl ? (
                              <Image
                                src={m.plateUrl}
                                alt={m.label}
                                fill
                                className="object-cover"
                              />
                            ) : (
                              <Image
                                src={figureArt(m)}
                                alt={m.label}
                                fill
                                className="object-contain"
                              />
                            )}
                          </div>
                          <span className="mt-2 font-friday text-xs uppercase truncate">
                            {m.label}
                          </span>
                          <span className="text-[0.65rem] text-[#12100d]/60 font-mono truncate">
                            {m.note}
                          </span>
                          <Link
                            href={`/avatars`}
                            className="mt-2 border border-[#12100d] bg-[#59C3C3] py-1 text-center font-mono text-[0.62rem] font-black uppercase text-[#12100d] shadow-[1px_1px_0px_#12100d] hover:bg-[#48B3B3]"
                          >
                            BORROW BODY
                          </Link>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: LIVE TRY-ON FITTING */}
              {activeTab === "fitting" && (
                <div className="space-y-6">
                  {/* Fitting Mannequin Stage */}
                  <div className="rounded-2xl border-[3px] border-[#12100d] bg-white p-4 shadow-[4px_4px_0px_#12100d]">
                    <div className="flex flex-col sm:flex-row items-center gap-5">
                      {/* Mannequin / Avatar Body */}
                      <div className="relative h-64 w-44 shrink-0 overflow-hidden rounded-2xl border-2 border-[#12100d] bg-[#EBE3D5] shadow-[3px_3px_0px_#12100d]">
                        {activeAvatar ? (
                          <Image
                            src={activeAvatar.renderUrl}
                            alt={activeAvatar.customization.label}
                            fill
                            className="object-cover"
                          />
                        ) : null}

                        {/* Garment Overlay Cutout */}
                        {selectedGarment && (
                          <div className="absolute inset-0 z-10 flex items-center justify-center p-3 pointer-events-none">
                            <Image
                              src={selectedGarment.imageUrl}
                              alt={selectedGarment.name}
                              fill
                              className="object-contain drop-shadow-[0_8px_16px_rgba(0,0,0,0.5)] p-4"
                            />
                          </div>
                        )}

                        <span className="absolute top-2 left-2 z-20 border border-[#12100d] bg-[#FFDE59] px-1.5 py-0.5 font-mono text-[0.58rem] font-bold text-[#12100d]">
                          FITTING STAGE
                        </span>
                      </div>

                      {/* Selected Piece Details & Match */}
                      <div className="flex-1 space-y-3">
                        {selectedGarment ? (
                          <>
                            <span className="border-2 border-[#12100d] bg-[#59C3C3] px-2 py-0.5 font-mono text-[0.68rem] font-black uppercase text-[#12100d] shadow-[2px_2px_0px_#12100d]">
                              {selectedGarment.zone.toUpperCase()}
                            </span>
                            <h3 className="font-friday text-2xl uppercase leading-tight text-[#12100d]">
                              {selectedGarment.name}
                            </h3>
                            <p className="text-xs text-[#12100d]/70 font-medium">
                              Material: {selectedGarment.material} · Dye: <b>{selectedGarment.dye.name}</b>
                            </p>

                            <div className="rounded-xl border-2 border-[#12100d] bg-[#F4EFE6] p-3 shadow-[2px_2px_0px_#12100d]">
                              <div className="flex items-center justify-between font-mono text-[0.72rem] font-black text-[#12100d]">
                                <span>COLOR MATCH RATING</span>
                                <span className="text-[#FF5A5F]">94% SS SCORE</span>
                              </div>
                              <div className="mt-2 h-3 w-full border border-[#12100d] bg-white overflow-hidden">
                                <div
                                  className="h-full bg-[#FFDE59] border-r border-[#12100d]"
                                  style={{ width: "94%" }}
                                />
                              </div>
                            </div>

                            <div className="pt-2 flex gap-2">
                              <Link
                                href={`/look`}
                                className="flex-1 border-2 border-[#12100d] bg-[#FFDE59] py-2 text-center font-friday text-xs uppercase tracking-wider text-[#12100d] shadow-[2px_2px_0px_#12100d] hover:bg-[#FFE57F]"
                              >
                                FIT FULL LOOK →
                              </Link>
                            </div>
                          </>
                        ) : (
                          <p className="text-xs text-[#12100d]/60 font-mono">
                            Select any garment below to try on.
                          </p>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Wardrobe Garment Selector Carousel */}
                  <div>
                    <h3 className="font-friday text-sm uppercase tracking-wider text-[#12100d] mb-3">
                      SELECT FROM WARDROBE PIECES
                    </h3>
                    <div className="flex gap-3 overflow-x-auto pb-2 no-scrollbar">
                      {garments.map((g) => {
                        const isSelected = selectedGarment?.id === g.id;
                        return (
                          <button
                            key={g.id}
                            type="button"
                            onClick={() => setSelectedGarment(g)}
                            className={`relative h-32 w-28 shrink-0 rounded-xl border-2 border-[#12100d] bg-white p-2 text-left shadow-[2px_2px_0px_#12100d] transition-all hover:-translate-y-0.5 cursor-pointer ${
                              isSelected ? "ring-2 ring-[#FFDE59] bg-[#FFFBEA]" : ""
                            }`}
                          >
                            <div className="relative h-20 w-full overflow-hidden rounded-lg bg-[#FAF6EF]">
                              <Image
                                src={g.imageUrl}
                                alt={g.name}
                                fill
                                className="object-contain p-1"
                              />
                            </div>
                            <p className="mt-1 truncate font-friday text-[0.7rem] uppercase">
                              {g.name}
                            </p>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 3: HISTORY & ACTIVITY LOGS */}
              {activeTab === "history" && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="font-friday text-sm uppercase tracking-wider text-[#12100d]">
                      TRY-ON & WARDROBE ACTIVITY LOG
                    </h3>
                    <span className="font-mono text-[0.68rem] text-[#12100d]/60">
                      {historyItems.length} RECORDED
                    </span>
                  </div>

                  <div className="space-y-3">
                    {historyItems.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-center gap-4 rounded-xl border-2 border-[#12100d] bg-white p-3 shadow-[3px_3px_0px_#12100d] transition-all hover:shadow-[4px_4px_0px_#12100d]"
                      >
                        {/* Thumbnail */}
                        <div className="relative h-16 w-14 shrink-0 overflow-hidden rounded-lg border border-[#12100d] bg-[#FAF6EF]">
                          <Image
                            src={item.imageUrl}
                            alt={item.title}
                            fill
                            className="object-contain p-1"
                          />
                        </div>

                        {/* Details */}
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span
                              className="h-2.5 w-2.5 rounded-full border border-[#12100d]"
                              style={{ backgroundColor: item.colorHex ?? "#FFDE59" }}
                            />
                            <h4 className="font-friday text-sm uppercase truncate text-[#12100d]">
                              {item.title}
                            </h4>
                          </div>

                          <p className="mt-0.5 text-[0.72rem] text-[#12100d]/70 font-medium truncate">
                            {item.subtitle}
                          </p>

                          <div className="mt-1.5 flex items-center gap-2 font-mono text-[0.62rem]">
                            <span className="text-[#12100d]/50">{item.timestamp}</span>
                            {item.seasonTag && (
                              <span className="border border-[#12100d]/40 bg-[#F4EFE6] px-1.5 py-0.2 text-[#12100d]/80 font-bold uppercase">
                                {item.seasonTag}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Action */}
                        <button
                          type="button"
                          onClick={() => {
                            const found = garments.find((g) => g.name === item.title);
                            if (found) setSelectedGarment(found);
                            setActiveTab("fitting");
                          }}
                          className="border-2 border-[#12100d] bg-[#FFDE59] px-2.5 py-1 font-mono text-[0.65rem] font-black uppercase text-[#12100d] shadow-[2px_2px_0px_#12100d] hover:bg-[#FFE57F] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none cursor-pointer"
                        >
                          VIEW FIT
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* ── Drawer Footer ───────────────────────────────────────── */}
            <div className="flex shrink-0 items-center justify-between border-t-[3px] border-[#12100d] bg-white px-5 py-3 shadow-[0px_-2px_0px_#12100d]">
              <div className="flex items-center gap-2 font-mono text-[0.68rem] text-[#12100d]/60 font-bold uppercase">
                <span>RANGREZ ATELIER ENGINE</span>
              </div>
              <Link
                href="/profile"
                className="border border-[#12100d] bg-[#F4EFE6] px-3 py-1 font-mono text-[0.68rem] font-black uppercase text-[#12100d] hover:bg-[#EBE3D5]"
              >
                ACCOUNT SETTINGS →
              </Link>
            </div>
          </motion.aside>
        </div>
      )}
    </AnimatePresence>
  );
}
