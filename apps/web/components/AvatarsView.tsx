"use client";

import Image from "next/image";
import Link from "next/link";
import { useState, useTransition } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  Zap,
  Pencil,
  Trash2,
  Plus,
  X,
  Maximize2,
  Minimize2,
} from "lucide-react";

import { deleteAvatar, setActiveAvatar, updateAvatarMeasurements } from "@/app/actions/avatars";
import { FRAMING, type Avatar, type User } from "@/lib/types";
import { Navbar } from "./Navbar";

export function AvatarsView({
  user,
  token,
  apiBase,
}: {
  user: User;
  token?: string;
  apiBase?: string;
}) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editingAvatar, setEditingAvatar] = useState<Avatar | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Avatar | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleSetActive = (id: string) => {
    const fd = new FormData();
    fd.set("id", id);
    startTransition(() => {
      setActiveAvatar(fd);
    });
  };

  const handleConfirmDelete = () => {
    if (!deleteTarget) return;
    const fd = new FormData();
    fd.set("id", deleteTarget.id);
    startTransition(() => {
      deleteAvatar(fd);
      setDeleteTarget(null);
      if (expandedId === deleteTarget.id) setExpandedId(null);
    });
  };

  const handleSaveMeasurements = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editingAvatar) return;
    const fd = new FormData(e.currentTarget);
    fd.set("id", editingAvatar.id);
    startTransition(() => {
      updateAvatarMeasurements(fd);
      setEditingAvatar(null);
    });
  };

  // Build fixed 3-slot array
  const slots: Array<{ index: number; avatar?: Avatar }> = [
    { index: 0, avatar: user.avatars[0] },
    { index: 1, avatar: user.avatars[1] },
    { index: 2, avatar: user.avatars[2] },
  ];

  return (
    <div className="flex h-full min-h-0 flex-col justify-between overflow-hidden bg-[#F4EFE6] text-[#12100d]">
      {/* ── Unified Floating Navbar ── */}
      <Navbar
        user={user}
        token={token}
        apiBase={apiBase}
        leftElement={
          <Link
            href="/wardrobe"
            className="flex items-center gap-1.5 rounded-xl border-2 border-[#12100d] bg-[#12100d] px-3.5 py-1.5 font-friday text-xs uppercase tracking-wider text-white shadow-[2px_2px_0px_#FFDE59] hover:bg-[#FFDE59] hover:text-[#12100d] active:translate-x-[1px] active:translate-y-[1px] transition-all cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Dashboard</span>
          </Link>
        }
      />

      {/* ── Center: Interactive Neobrutalist 3-Column Accordion Gallery ── */}
      <main className="flex-1 flex flex-col justify-center px-4 sm:px-8 py-4 sm:py-6 mt-1 min-h-0 overflow-hidden">
        <div className="w-full max-w-6xl mx-auto h-[calc(100vh-140px)] max-h-[580px] min-h-[420px] flex flex-col lg:flex-row gap-4 sm:gap-6 items-stretch">
          {slots.map(({ index, avatar }) => {
            if (!avatar) {
              // ── Empty Slot Card (with + button) ──
              return (
                <Link
                  key={`empty-${index}`}
                  href="/avatar-new"
                  className="flex-1 flex flex-col items-center justify-center p-6 rounded-[32px] border-[3.5px] border-dashed border-[#12100d] bg-white/60 hover:bg-white text-center shadow-[6px_6px_0px_#12100d] hover:translate-y-1.5 hover:shadow-[3px_3px_0px_#12100d] active:translate-y-2 active:shadow-[1px_1px_0px_#12100d] transition-all duration-200 group cursor-pointer"
                >
                  <div className="flex h-16 w-16 items-center justify-center rounded-2xl border-[2.5px] border-[#12100d] bg-[#FFDE59] text-3xl font-black text-[#12100d] shadow-[3px_3px_0px_#12100d] group-hover:scale-110 transition-transform">
                    <Plus className="w-8 h-8 text-[#12100d]" />
                  </div>
                  <h4 className="font-friday text-lg sm:text-xl uppercase tracking-wide text-[#12100d] mt-4">
                    Add Avatar Plate
                  </h4>
                  <p className="font-mono text-xs text-[#12100d]/60 mt-1 uppercase font-bold max-w-[18ch]">
                    Register body 0{index + 1}
                  </p>
                </Link>
              );
            }

            const isExpanded = avatar.id === expandedId;
            const isActive = avatar.id === user.activeAvatarId;
            const framingInfo = FRAMING[avatar.framing ?? "full"];
            const measurements = avatar.measurements ?? user.measurements;

            return (
              <motion.div
                key={avatar.id}
                layout
                onClick={() => {
                  setExpandedId(isExpanded ? null : avatar.id);
                }}
                transition={{ type: "spring", stiffness: 300, damping: 28 }}
                className={`relative overflow-hidden rounded-[32px] border-[3.5px] border-[#12100d] transition-all duration-200 cursor-pointer ${
                  isExpanded
                    ? isActive
                      ? "flex-[3.2] bg-[#FFDE59] p-5 sm:p-7 shadow-[8px_8px_0px_#12100d]"
                      : "flex-[3.2] bg-white p-5 sm:p-7 shadow-[8px_8px_0px_#12100d]"
                    : isActive
                      ? "flex-1 bg-[#FFDE59] p-5 shadow-[6px_6px_0px_#12100d] hover:translate-y-1.5 hover:shadow-[3px_3px_0px_#12100d]"
                      : "flex-1 bg-[#FAF6EF] p-5 shadow-[6px_6px_0px_#12100d] hover:bg-white hover:translate-y-1.5 hover:shadow-[3px_3px_0px_#12100d]"
                }`}
              >
                {/* ── EXPANDED ACCORDION VIEW ── */}
                {isExpanded ? (
                  <div className="flex flex-col md:flex-row gap-5 sm:gap-7 h-full justify-between overflow-hidden">
                    {/* Left: Avatar Portrait / Model Shot */}
                    <div className="relative h-48 md:h-full w-full md:w-56 lg:w-64 shrink-0 overflow-hidden rounded-2xl border-[2.5px] border-[#12100d] bg-white p-2.5 shadow-[4px_4px_0px_#12100d] flex items-center justify-center">
                      <div className="relative h-full w-full">
                        <Image
                          src={avatar.renderUrl}
                          alt={avatar.customization.label}
                          fill
                          priority
                          className="object-contain drop-shadow-[0_10px_16px_rgba(0,0,0,0.18)]"
                        />
                      </div>
                      <span className="absolute bottom-2 left-2 border-2 border-[#12100d] bg-[#FFDE59] px-2 py-0.5 font-mono text-[0.6rem] font-black uppercase text-[#12100d]">
                        {framingInfo.label.toUpperCase()}
                      </span>
                    </div>

                    {/* Right: Plate Info, Specs Matrix & Actions */}
                    <div className="flex-1 flex flex-col justify-between space-y-3 min-w-0">
                      <div>
                        {/* Top Badges & Close Expand */}
                        <div className="flex items-center justify-between gap-2 mb-1.5">
                          <div className="flex items-center gap-2">
                            <span className="border-2 border-[#12100d] bg-white px-2.5 py-0.5 font-mono text-[0.68rem] font-black uppercase text-[#12100d] shadow-[2px_2px_0px_#12100d]">
                              PLATE 0{index + 1}
                            </span>
                            {isActive && (
                              <span className="border-2 border-[#12100d] bg-[#12100d] px-2.5 py-0.5 font-mono text-[0.65rem] font-black uppercase text-white shadow-[2px_2px_0px_#12100d]">
                                ACTIVE BODY
                              </span>
                            )}
                          </div>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setExpandedId(null);
                            }}
                            className="flex items-center gap-1 rounded-lg border-2 border-[#12100d] bg-white px-2 py-0.5 font-mono text-[0.65rem] font-black uppercase hover:bg-[#FAF6EF] shadow-[1px_1px_0px_#12100d]"
                          >
                            <span>Collapse</span>
                            <X className="w-3 h-3" />
                          </button>
                        </div>

                        {/* Title */}
                        <h2 className="font-friday text-2xl sm:text-3xl uppercase tracking-wide text-[#12100d] truncate">
                          {avatar.customization.label}
                        </h2>

                        {/* Tags */}
                        <div className="mt-2 flex flex-wrap gap-2">
                          <span className="border-2 border-[#12100d] bg-[#7FE06E] px-2 py-0.5 font-mono text-[0.65rem] font-black uppercase text-[#12100d] shadow-[1px_1px_0px_#12100d]">
                            SEASON: {avatar.colorSeason?.name ?? "DEEP AUTUMN"}
                          </span>
                          <span className="border-2 border-[#12100d] bg-white px-2 py-0.5 font-mono text-[0.65rem] font-bold uppercase text-[#12100d] shadow-[1px_1px_0px_#12100d]">
                            {avatar.measurements ? "CUSTOM SPECS" : "GLOBAL SPECS"}
                          </span>
                        </div>

                        {/* Body Specs Grid */}
                        <div className="mt-3 rounded-2xl border-2 border-[#12100d] bg-white p-3 shadow-[3px_3px_0px_#12100d]">
                          <div className="flex items-center justify-between mb-1.5">
                            <span className="font-mono text-[0.62rem] font-black uppercase text-[#12100d]/60">
                              BODY PROFILE MEASUREMENTS
                            </span>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setEditingAvatar(avatar);
                              }}
                              className="flex items-center gap-1 font-mono text-[0.65rem] font-black uppercase text-[#12100d] underline hover:text-emerald-700 cursor-pointer"
                            >
                              <Pencil className="w-3 h-3" />
                              <span>Edit Specs</span>
                            </button>
                          </div>
                          <div className="grid grid-cols-4 gap-2 font-mono text-xs text-[#12100d]">
                            <div>
                              <span className="text-[0.6rem] text-[#12100d]/50 block uppercase font-bold">Height</span>
                              <b className="font-black">{measurements.heightCm ?? 175} cm</b>
                            </div>
                            <div>
                              <span className="text-[0.6rem] text-[#12100d]/50 block uppercase font-bold">Chest</span>
                              <b className="font-black">{measurements.chestCm ?? 96} cm</b>
                            </div>
                            <div>
                              <span className="text-[0.6rem] text-[#12100d]/50 block uppercase font-bold">Waist</span>
                              <b className="font-black">{measurements.waistCm ?? 82} cm</b>
                            </div>
                            <div>
                              <span className="text-[0.6rem] text-[#12100d]/50 block uppercase font-bold">Hips</span>
                              <b className="font-black">{measurements.hipCm ?? 98} cm</b>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Action Buttons Row (NO RE-UPLOAD BUTTON per prompt) */}
                      <div className="flex flex-wrap items-center gap-2 pt-2 border-t-2 border-[#12100d]/15">
                        {!isActive && (
                          <button
                            type="button"
                            disabled={isPending}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleSetActive(avatar.id);
                            }}
                            className="flex-1 flex items-center justify-center gap-1.5 rounded-xl border-[2.5px] border-[#12100d] bg-[#12100d] text-white py-2 px-3 font-friday text-xs uppercase tracking-wider shadow-[3px_3px_0px_#FFDE59] hover:bg-[#FFDE59] hover:text-[#12100d] active:translate-x-[1px] active:translate-y-[1px] transition-all cursor-pointer"
                          >
                            <Zap className="w-3.5 h-3.5 text-[#FFDE59]" />
                            <span>USE THIS BODY</span>
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingAvatar(avatar);
                          }}
                          className="flex items-center gap-1.5 rounded-xl border-[2.5px] border-[#12100d] bg-white py-2 px-3.5 font-friday text-xs uppercase tracking-wider text-[#12100d] shadow-[2px_2px_0px_#12100d] hover:bg-[#FAF6EF] active:translate-x-[1px] active:translate-y-[1px] cursor-pointer"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                          <span>EDIT MEASUREMENTS</span>
                        </button>

                        {user.avatars.length > 1 && (
                          <button
                            type="button"
                            disabled={isPending}
                            onClick={(e) => {
                              e.stopPropagation();
                              setDeleteTarget(avatar);
                            }}
                            className="flex items-center gap-1 rounded-xl border-[2.5px] border-[#12100d] bg-[#FF5A5F] py-2 px-3 font-friday text-xs uppercase tracking-wider text-white shadow-[2px_2px_0px_#12100d] hover:bg-[#FF3B42] active:translate-x-[1px] active:translate-y-[1px] cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>RETIRE</span>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ) : (
                  /* ── PERSISTENT IDLE / COLLAPSED ACCORDION CARD ── */
                  <div className="flex flex-col items-center justify-between h-full py-2 text-center select-none">
                    <div className="w-full flex items-center justify-between mb-2">
                      <span className="border-2 border-[#12100d] bg-white px-2 py-0.5 font-mono text-[0.62rem] font-black uppercase text-[#12100d] shadow-[1px_1px_0px_#12100d]">
                        PLATE 0{index + 1}
                      </span>
                      {isActive && (
                        <span className="rounded-full bg-[#12100d] px-2 py-0.5 font-mono text-[0.55rem] font-black text-[#FFDE59]">
                          ACTIVE
                        </span>
                      )}
                    </div>

                    <div className="relative aspect-[3/4] w-full max-w-[170px] my-auto overflow-hidden rounded-2xl border-2 border-[#12100d] bg-white p-2 shadow-[3px_3px_0px_#12100d]">
                      <Image
                        src={avatar.renderUrl}
                        alt={avatar.customization.label}
                        fill
                        className="object-contain drop-shadow-md"
                      />
                    </div>

                    <div className="mt-3 w-full">
                      <h4 className="font-friday text-lg sm:text-xl uppercase tracking-wide text-[#12100d] truncate">
                        {avatar.customization.label}
                      </h4>
                      <p className="font-mono text-[0.62rem] text-[#12100d]/60 mt-0.5 uppercase font-bold">
                        {framingInfo.label}
                      </p>
                    </div>

                    <span className="mt-3 flex items-center gap-1 border-2 border-[#12100d] bg-white px-3 py-1 font-mono text-[0.65rem] font-black uppercase text-[#12100d] shadow-[2px_2px_0px_#12100d] rounded-xl">
                      <span>EXPAND</span>
                      <Maximize2 className="w-3 h-3" />
                    </span>
                  </div>
                )}
              </motion.div>
            );
          })}
        </div>
      </main>

      {/* ── Edit Body Measurements Modal (Neobrutalism) ── */}
      <AnimatePresence>
        {editingAvatar && (
          <div
            className="fixed inset-0 z-[110] flex items-center justify-center bg-[#12100d]/75 p-4 backdrop-blur-sm"
            onClick={(e) => {
              if (e.target === e.currentTarget) setEditingAvatar(null);
            }}
          >
            <motion.div
              initial={{ scale: 0.92, opacity: 0, y: 12 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.92, opacity: 0, y: 12 }}
              transition={{ type: "spring", stiffness: 320, damping: 26 }}
              className="w-full max-w-md rounded-3xl border-[3.5px] border-[#12100d] bg-[#F4EFE6] p-6 shadow-[8px_8px_0px_#12100d]"
            >
              <div className="flex items-center justify-between border-b-[2.5px] border-[#12100d] pb-3 mb-4">
                <div>
                  <h3 className="font-friday text-xl uppercase tracking-wide text-[#12100d]">
                    Edit Body Measurements
                  </h3>
                  <p className="font-mono text-[0.68rem] text-[#12100d]/60 mt-0.5">
                    Plate: <b>{editingAvatar.customization.label}</b>
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setEditingAvatar(null)}
                  className="rounded-lg border-2 border-[#12100d] bg-white p-1 font-mono text-xs font-black text-[#12100d] shadow-[2px_2px_0px_#12100d] hover:bg-[#FF5A5F] hover:text-white transition-all cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleSaveMeasurements} className="space-y-4">
                <div className="grid grid-cols-2 gap-3 font-mono text-xs text-[#12100d]">
                  <div>
                    <label className="font-mono text-[0.65rem] font-black uppercase text-[#12100d]/60 block mb-1">
                      Height (cm)
                    </label>
                    <input
                      name="heightCm"
                      type="number"
                      defaultValue={editingAvatar.measurements?.heightCm ?? user.measurements.heightCm ?? 175}
                      required
                      min={100}
                      max={250}
                      className="w-full rounded-xl border-2 border-[#12100d] bg-white p-2 font-mono text-xs font-bold"
                    />
                  </div>
                  <div>
                    <label className="font-mono text-[0.65rem] font-black uppercase text-[#12100d]/60 block mb-1">
                      Chest (cm)
                    </label>
                    <input
                      name="chestCm"
                      type="number"
                      defaultValue={editingAvatar.measurements?.chestCm ?? user.measurements.chestCm ?? 96}
                      required
                      min={50}
                      max={180}
                      className="w-full rounded-xl border-2 border-[#12100d] bg-white p-2 font-mono text-xs font-bold"
                    />
                  </div>
                  <div>
                    <label className="font-mono text-[0.65rem] font-black uppercase text-[#12100d]/60 block mb-1">
                      Waist (cm)
                    </label>
                    <input
                      name="waistCm"
                      type="number"
                      defaultValue={editingAvatar.measurements?.waistCm ?? user.measurements.waistCm ?? 82}
                      required
                      min={40}
                      max={160}
                      className="w-full rounded-xl border-2 border-[#12100d] bg-white p-2 font-mono text-xs font-bold"
                    />
                  </div>
                  <div>
                    <label className="font-mono text-[0.65rem] font-black uppercase text-[#12100d]/60 block mb-1">
                      Hips (cm)
                    </label>
                    <input
                      name="hipCm"
                      type="number"
                      defaultValue={editingAvatar.measurements?.hipCm ?? user.measurements.hipCm ?? 98}
                      required
                      min={50}
                      max={180}
                      className="w-full rounded-xl border-2 border-[#12100d] bg-white p-2 font-mono text-xs font-bold"
                    />
                  </div>
                </div>

                <div className="flex gap-2 pt-2">
                  <button
                    type="submit"
                    disabled={isPending}
                    className="flex-1 rounded-xl border-2 border-[#12100d] bg-[#FFDE59] py-2.5 font-friday text-xs uppercase tracking-wider text-[#12100d] shadow-[3px_3px_0px_#12100d] hover:bg-[#FFE57F] active:translate-x-[1px] active:translate-y-[1px] transition-all cursor-pointer"
                  >
                    Save Measurements
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingAvatar(null)}
                    className="rounded-xl border-2 border-[#12100d] bg-white py-2.5 px-5 font-friday text-xs uppercase tracking-wider text-[#12100d] shadow-[2px_2px_0px_#12100d] hover:bg-[#FAF6EF] active:translate-x-[1px] active:translate-y-[1px] transition-all cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── Retire / Delete Confirmation Modal ── */}
      <AnimatePresence>
        {deleteTarget && (
          <div
            className="fixed inset-0 z-[110] flex items-center justify-center bg-[#12100d]/75 p-4 backdrop-blur-sm"
            onClick={(e) => {
              if (e.target === e.currentTarget) setDeleteTarget(null);
            }}
          >
            <motion.div
              initial={{ scale: 0.92, opacity: 0, y: 12 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.92, opacity: 0, y: 12 }}
              transition={{ type: "spring", stiffness: 320, damping: 26 }}
              className="w-full max-w-sm rounded-3xl border-[3.5px] border-[#12100d] bg-[#F4EFE6] p-6 shadow-[8px_8px_0px_#12100d] text-center"
            >
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl border-[2.5px] border-[#12100d] bg-[#FF5A5F] text-xl font-black text-white shadow-[3px_3px_0px_#12100d]">
                <Trash2 className="w-6 h-6 text-white" />
              </div>

              <h3 className="font-friday text-xl uppercase tracking-wide text-[#12100d]">
                Retire Avatar Plate?
              </h3>
              <p className="font-mono text-xs text-[#12100d]/70 mt-1 mb-5">
                Remove <b>{deleteTarget.customization.label}</b> from your registered body plates?
              </p>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setDeleteTarget(null)}
                  className="flex-1 rounded-2xl border-2 border-[#12100d] bg-white py-2 font-friday text-xs uppercase tracking-wider text-[#12100d] shadow-[2px_2px_0px_#12100d] hover:bg-[#FAF6EF] active:translate-x-[1px] active:translate-y-[1px] transition-all cursor-pointer"
                >
                  Cancel
                </button>

                <button
                  type="button"
                  disabled={isPending}
                  onClick={handleConfirmDelete}
                  className="flex-1 rounded-2xl border-2 border-[#12100d] bg-[#FF5A5F] py-2 font-friday text-xs uppercase tracking-wider text-white shadow-[2px_2px_0px_#12100d] hover:bg-[#FF3B42] active:translate-x-[1px] active:translate-y-[1px] transition-all cursor-pointer"
                >
                  Retire
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
