"use client";

import Image from "next/image";
import Link from "next/link";
import { useState, useTransition } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Pencil, Check, User as UserIcon } from "lucide-react";

import { signOut } from "@/app/actions/auth";
import { saveMeasurements, updateProfilePhoto } from "@/app/actions/profile";
import { Navbar } from "./Navbar";
import type { Avatar, Garment, User, Zone } from "@/lib/types";
import { hasGooglePhoto, profilePhoto } from "@/lib/profile-photo";

const ESTIMATED_ZONE_PRICES: Record<Zone, number> = {
  top: 2490,
  bottom: 3990,
  outerwear: 7490,
  shoes: 4990,
  accessory: 1890,
};

export function ProfileView({
  user,
  garments,
  token,
  apiBase,
}: {
  user: User;
  garments: Garment[];
  token: string;
  apiBase: string;
}) {
  const [isGooglePhoto, setIsGooglePhoto] = useState(user.useGooglePhoto ?? true);
  const [editingMeasurements, setEditingMeasurements] = useState(false);
  const [isPending, startTransition] = useTransition();

  const activeAvatar = user.avatar;
  const ownedPieces = garments.filter((g) => g.origin !== "shop");
  const wishlistPieces = garments.filter((g) => g.origin === "shop");

  const piecesCount = ownedPieces.length;
  const wishlistCount = wishlistPieces.length;

  // Calculate total price valuation of wardrobe in ₹ INR
  const totalPrice = garments.reduce((sum, g) => {
    return sum + (ESTIMATED_ZONE_PRICES[g.zone] || 2500);
  }, 0);

  const formattedTotalPrice = new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(totalPrice);

  /* The real picture off the Google account, not a drawing seeded from the
     name. `isGooglePhoto` is local so the toggle responds before the server
     action lands, hence the override rather than calling profilePhoto(user). */
  const displayProfilePhoto = profilePhoto({ ...user, useGooglePhoto: isGooglePhoto });
  const googleAvailable = hasGooglePhoto(user);

  const handleToggleGoogle = () => {
    const nextVal = !isGooglePhoto;
    setIsGooglePhoto(nextVal);
    const fd = new FormData();
    if (nextVal) fd.set("useGoogle", "on");
    startTransition(() => {
      updateProfilePhoto(fd);
    });
  };

  const handleSaveGlobalMeasurements = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      await saveMeasurements(fd);
      setEditingMeasurements(false);
    });
  };

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

      {/* ── Main Profile Grid (Proper breathing room below floating navbar) ── */}
      <main className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 sm:py-6 mt-1 min-h-0 flex items-center justify-center">
        <div className="w-full max-w-5xl mx-auto my-auto grid grid-cols-1 lg:grid-cols-12 gap-5 sm:gap-6 items-stretch">
          {/* Left Column (5 cols): Profile Avatar & Identity Card */}
          <div className="lg:col-span-5 rounded-3xl border-[3.5px] border-[#12100d] bg-white p-5 sm:p-6 shadow-[6px_6px_0px_#12100d] flex flex-col items-center justify-between text-center">
            <div className="w-full flex items-center justify-between border-b-2 border-[#12100d]/15 pb-3">
              <span className="border-2 border-[#12100d] bg-[#7FE06E] px-2 py-0.5 font-mono text-[0.68rem] font-black uppercase text-[#12100d] shadow-[1px_1px_0px_#12100d]">
                IDENTITY
              </span>
              <button
                type="button"
                onClick={handleToggleGoogle}
                disabled={!googleAvailable}
                title={
                  googleAvailable
                    ? "Switch between your Google picture and your own"
                    : "This account did not sign in with Google, so there is no picture to use"
                }
                className="rounded-xl border-2 border-[#12100d] bg-[#FAF6EF] px-2 py-0.5 font-mono text-[0.65rem] font-bold text-[#12100d] shadow-[1px_1px_0px_#12100d] hover:bg-[#FFDE59] cursor-pointer disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:bg-[#FAF6EF]"
              >
                {/* It used to say "Notionist G", which was the drawing style's
                    own name — an accurate label for the wrong picture. */}
                {!googleAvailable ? "Photo: Custom" : isGooglePhoto ? "Photo: Google" : "Photo: Custom"}
              </button>
            </div>

            {/* Overlapping Profile Photo + Active Avatar Badge */}
            <div className="relative my-4">
              {/* Big Green Profile Circle */}
              <div className="relative h-36 w-36 sm:h-44 sm:w-44 rounded-full border-[3.5px] border-[#12100d] bg-[#7FE06E] shadow-[6px_6px_0px_#12100d] overflow-hidden flex items-center justify-center">
                <Image
                  src={displayProfilePhoto}
                  alt={user.name || "User"}
                  fill
                  priority
                  className="object-cover"
                  unoptimized={displayProfilePhoto.startsWith("https://unavatar.io") || displayProfilePhoto.includes("googleusercontent")}
                />
              </div>

              {/* Overlapping Yellow Avatar Badge */}
              <Link
                href="/avatar"
                title="Active Avatar Body (Click to manage)"
                className="absolute -bottom-1 -right-1 h-16 w-16 sm:h-20 sm:w-20 rounded-full border-[3px] border-[#12100d] bg-[#FFDE59] shadow-[3px_3px_0px_#12100d] overflow-hidden hover:scale-105 active:translate-x-[1px] active:translate-y-[1px] transition-all flex items-center justify-center cursor-pointer"
              >
                {activeAvatar ? (
                  <div className="relative h-full w-full">
                    <Image
                      src={activeAvatar.renderUrl}
                      alt={activeAvatar.customization.label}
                      fill
                      className="object-cover"
                    />
                    <span className="absolute bottom-0.5 right-0.5 rounded-full bg-[#12100d] px-1 py-0.2 font-mono text-[0.48rem] font-black text-[#FFDE59]">
                      BODY
                    </span>
                  </div>
                ) : (
                  <span className="font-mono text-[0.65rem] font-black text-[#12100d]">+BODY</span>
                )}
              </Link>
            </div>

            <div className="w-full">
              <h1 className="font-friday text-2xl sm:text-3xl text-[#12100d] uppercase tracking-wide truncate">
                {user.name}
              </h1>
              <p className="font-mono text-xs text-[#12100d]/60 mt-0.5 font-semibold truncate">
                {user.email}
              </p>

              <div className="mt-3 flex flex-wrap gap-2 justify-center">
                <span className="border-2 border-[#12100d] bg-[#FFDE59] px-2.5 py-0.5 font-mono text-[0.65rem] font-black uppercase text-[#12100d] shadow-[1px_1px_0px_#12100d]">
                  SEASON: {user.avatar?.colorSeason?.name ?? "YEAR ROUND"}
                </span>
                <span className="border-2 border-[#12100d] bg-[#FAF6EF] px-2.5 py-0.5 font-mono text-[0.65rem] font-bold uppercase text-[#12100d] shadow-[1px_1px_0px_#12100d]">
                  FIT: {user.preferences.fitPreference.toUpperCase()}
                </span>
              </div>
            </div>
          </div>

          {/* Right Column (7 cols): 3 Stats + Global Body Measurements */}
          <div className="lg:col-span-7 flex flex-col justify-between space-y-4">
            {/* 1. Neobrutalist 3 Stats Card */}
            <div className="rounded-3xl border-[3.5px] border-[#12100d] bg-white p-5 sm:p-6 shadow-[6px_6px_0px_#12100d]">
              <div className="flex items-center justify-between border-b-2 border-[#12100d]/15 pb-2.5 mb-3.5">
                <h2 className="font-friday text-xl sm:text-2xl text-[#12100d] uppercase tracking-wide">
                  Wardrobe Stats & Valuation
                </h2>
                <span className="border-2 border-[#12100d] bg-[#7FE06E] px-2 py-0.5 font-mono text-[0.65rem] font-black uppercase text-[#12100d] shadow-[1px_1px_0px_#12100d]">
                  LEDGER
                </span>
              </div>

              {/* 3 Core Stats Grid */}
              <div className="grid grid-cols-3 gap-3">
                {/* Stat 1: Owned Garments Count */}
                <div className="rounded-2xl border-2 border-[#12100d] bg-[#F4EFE6] p-3.5 text-center shadow-[3px_3px_0px_#12100d]">
                  <p className="font-mono text-[0.62rem] font-black uppercase text-[#12100d]/60">
                    OWNED PIECES
                  </p>
                  <p className="font-friday text-3xl sm:text-4xl text-[#12100d] mt-0.5">
                    {piecesCount}
                  </p>
                </div>

                {/* Stat 2: Wishlist Count */}
                <div className="rounded-2xl border-2 border-[#12100d] bg-[#FAF6EF] p-3.5 text-center shadow-[3px_3px_0px_#12100d]">
                  <p className="font-mono text-[0.62rem] font-black uppercase text-[#12100d]/60">
                    WISHLIST
                  </p>
                  <p className="font-friday text-3xl sm:text-4xl text-[#12100d] mt-0.5">
                    {wishlistCount}
                  </p>
                </div>

                {/* Stat 3: Total Price of Garments */}
                <div className="rounded-2xl border-2 border-[#12100d] bg-[#FFDE59] p-3.5 text-center shadow-[3px_3px_0px_#12100d]">
                  <p className="font-mono text-[0.62rem] font-black uppercase text-[#12100d]/80">
                    TOTAL VALUE
                  </p>
                  <p className="font-friday text-2xl sm:text-3xl text-[#12100d] mt-1 truncate">
                    {formattedTotalPrice}
                  </p>
                </div>
              </div>
            </div>

            {/* 2. Global Body Measurements Section */}
            <div className="rounded-3xl border-[3.5px] border-[#12100d] bg-white p-5 sm:p-6 shadow-[6px_6px_0px_#12100d]">
              <div className="flex items-center justify-between border-b-2 border-[#12100d]/15 pb-2.5 mb-3">
                <div className="flex items-center gap-2">
                  <span className="border-2 border-[#12100d] bg-[#FFDE59] px-2 py-0.5 font-mono text-[0.68rem] font-black uppercase text-[#12100d] shadow-[1px_1px_0px_#12100d]">
                    SPEC
                  </span>
                  <h3 className="font-friday text-xl sm:text-2xl text-[#12100d] uppercase tracking-wide">
                    Global Body Measurements
                  </h3>
                </div>

                <button
                  type="button"
                  onClick={() => setEditingMeasurements(!editingMeasurements)}
                  className="flex items-center gap-1.5 rounded-xl border-2 border-[#12100d] bg-[#FAF6EF] px-3 py-1 font-mono text-xs font-black uppercase text-[#12100d] shadow-[2px_2px_0px_#12100d] hover:bg-[#FFDE59] active:translate-x-[1px] active:translate-y-[1px] transition-all cursor-pointer"
                >
                  <Pencil className="w-3.5 h-3.5" />
                  <span>{editingMeasurements ? "Close Specs" : "Edit Global Specs"}</span>
                </button>
              </div>

              {/* Specs Values Display or Inline Form */}
              {editingMeasurements ? (
                <form onSubmit={handleSaveGlobalMeasurements} className="space-y-3 pt-1">
                  <div className="grid grid-cols-4 gap-2 font-mono text-xs text-[#12100d]">
                    <div>
                      <label className="font-mono text-[0.6rem] font-black uppercase text-[#12100d]/60 block mb-0.5">
                        Height (cm)
                      </label>
                      <input
                        name="heightCm"
                        type="number"
                        defaultValue={user.measurements.heightCm ?? 175}
                        required
                        className="w-full rounded-xl border-2 border-[#12100d] bg-[#FAF6EF] p-1.5 font-mono text-xs font-bold"
                      />
                    </div>
                    <div>
                      <label className="font-mono text-[0.6rem] font-black uppercase text-[#12100d]/60 block mb-0.5">
                        Chest (cm)
                      </label>
                      <input
                        name="chestCm"
                        type="number"
                        defaultValue={user.measurements.chestCm ?? 96}
                        required
                        className="w-full rounded-xl border-2 border-[#12100d] bg-[#FAF6EF] p-1.5 font-mono text-xs font-bold"
                      />
                    </div>
                    <div>
                      <label className="font-mono text-[0.6rem] font-black uppercase text-[#12100d]/60 block mb-0.5">
                        Waist (cm)
                      </label>
                      <input
                        name="waistCm"
                        type="number"
                        defaultValue={user.measurements.waistCm ?? 82}
                        required
                        className="w-full rounded-xl border-2 border-[#12100d] bg-[#FAF6EF] p-1.5 font-mono text-xs font-bold"
                      />
                    </div>
                    <div>
                      <label className="font-mono text-[0.6rem] font-black uppercase text-[#12100d]/60 block mb-0.5">
                        Hips (cm)
                      </label>
                      <input
                        name="hipCm"
                        type="number"
                        defaultValue={user.measurements.hipCm ?? 98}
                        required
                        className="w-full rounded-xl border-2 border-[#12100d] bg-[#FAF6EF] p-1.5 font-mono text-xs font-bold"
                      />
                    </div>
                  </div>

                  <div className="flex gap-2 pt-1">
                    <button
                      type="submit"
                      disabled={isPending}
                      className="flex-1 rounded-xl border-2 border-[#12100d] bg-[#FFDE59] py-2 font-friday text-xs uppercase tracking-wider text-[#12100d] shadow-[2px_2px_0px_#12100d] hover:bg-[#FFE57F] active:translate-x-[1px] active:translate-y-[1px] transition-all cursor-pointer"
                    >
                      Save Global Measurements
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingMeasurements(false)}
                      className="rounded-xl border-2 border-[#12100d] bg-white py-2 px-4 font-friday text-xs uppercase tracking-wider text-[#12100d] shadow-[2px_2px_0px_#12100d] hover:bg-[#FAF6EF] cursor-pointer"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              ) : (
                <div className="grid grid-cols-4 gap-2 font-mono text-xs text-[#12100d]">
                  <div className="rounded-xl border border-[#12100d]/30 bg-[#FAF6EF] p-2.5 text-center">
                    <span className="text-[0.6rem] text-[#12100d]/50 block uppercase font-bold">Height</span>
                    <b className="font-black text-sm">{user.measurements.heightCm ?? 175} cm</b>
                  </div>
                  <div className="rounded-xl border border-[#12100d]/30 bg-[#FAF6EF] p-2.5 text-center">
                    <span className="text-[0.6rem] text-[#12100d]/50 block uppercase font-bold">Chest</span>
                    <b className="font-black text-sm">{user.measurements.chestCm ?? 96} cm</b>
                  </div>
                  <div className="rounded-xl border border-[#12100d]/30 bg-[#FAF6EF] p-2.5 text-center">
                    <span className="text-[0.6rem] text-[#12100d]/50 block uppercase font-bold">Waist</span>
                    <b className="font-black text-sm">{user.measurements.waistCm ?? 82} cm</b>
                  </div>
                  <div className="rounded-xl border border-[#12100d]/30 bg-[#FAF6EF] p-2.5 text-center">
                    <span className="text-[0.6rem] text-[#12100d]/50 block uppercase font-bold">Hips</span>
                    <b className="font-black text-sm">{user.measurements.hipCm ?? 98} cm</b>
                  </div>
                </div>
              )}
              <p className="mt-2.5 font-mono text-[0.62rem] text-[#12100d]/60 leading-relaxed">
                * Note: Changes to global measurements automatically synchronize across all registered avatar bodies that use global specs.
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
