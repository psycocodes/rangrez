"use client";

import Image from "next/image";
import Link from "next/link";
import { useState, useTransition } from "react";
import { signOut } from "@/app/actions/auth";
import { updateProfilePhoto } from "@/app/actions/profile";
import type { Avatar, User } from "@/lib/types";

export function ProfileHeaderCard({
  user,
  activeAvatar,
  piecesCount,
  wishlistCount,
  renderedCount,
}: {
  user: User;
  activeAvatar?: Avatar;
  piecesCount: number;
  wishlistCount: number;
  renderedCount: number;
}) {
  const [isGooglePhoto, setIsGooglePhoto] = useState(user.useGooglePhoto ?? true);
  const [photoPickerOpen, setPhotoPickerOpen] = useState(false);
  const [customPhotoUrl, setCustomPhotoUrl] = useState(user.profilePhotoUrl ?? "");
  const [isPending, startTransition] = useTransition();

  // Generated Google-style default avatar or custom
  const googleAvatarUrl = `https://api.dicebear.com/7.x/notionists/svg?seed=${encodeURIComponent(
    user.name || "User",
  )}&backgroundColor=b6e3f4,c0aede,d1d4f9,ffd5dc,ffdfbf`;

  const displayProfilePhoto = isGooglePhoto
    ? googleAvatarUrl
    : customPhotoUrl || googleAvatarUrl;

  const handleToggleGoogle = () => {
    const nextVal = !isGooglePhoto;
    setIsGooglePhoto(nextVal);
    const fd = new FormData();
    if (nextVal) fd.set("useGoogle", "on");
    fd.set("photoUrl", customPhotoUrl);
    startTransition(() => {
      updateProfilePhoto(fd);
    });
  };

  return (
    <div className="relative overflow-hidden rounded-3xl border-[3px] border-[#12100d] bg-white p-6 sm:p-8 shadow-[8px_8px_0px_#12100d]">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        {/* Left: Profile Photo with Overlapping Yellow Avatar Badge */}
        <div className="flex items-center gap-5 sm:gap-6">
          <div className="relative shrink-0">
            {/* Main Profile Circle */}
            <div className="relative h-24 w-24 sm:h-28 sm:w-28 overflow-hidden rounded-full border-[3px] border-[#12100d] bg-[#59C3C3] shadow-[4px_4px_0px_#12100d]">
              <Image
                src={displayProfilePhoto}
                alt={user.name}
                fill
                className="object-cover"
              />
            </div>

            {/* Google Badge Switcher */}
            <button
              type="button"
              onClick={handleToggleGoogle}
              title={isGooglePhoto ? "Using Google Photo (Click to switch)" : "Using Custom Photo (Click for Google)"}
              className="absolute -top-1 -left-1 flex h-7 w-7 items-center justify-center rounded-full border-2 border-[#12100d] bg-white font-black text-xs text-[#12100d] shadow-[2px_2px_0px_#12100d] hover:bg-[#FFDE59] transition-all cursor-pointer"
            >
              G
            </button>

            {/* Overlapping Yellow Active Avatar Badge */}
            {activeAvatar ? (
              <Link
                href="/avatars"
                title="Active Avatar Body (Click to manage avatars)"
                className="absolute -bottom-1 -right-1 flex h-12 w-12 sm:h-14 sm:w-14 items-center justify-center overflow-hidden rounded-full border-[3px] border-[#12100d] bg-[#FFDE59] shadow-[3px_3px_0px_#12100d] transition-all hover:scale-105 hover:bg-[#FFE57F] active:translate-x-[1px] active:translate-y-[1px]"
              >
                <div className="relative h-full w-full">
                  <Image
                    src={activeAvatar.renderUrl}
                    alt={activeAvatar.customization.label}
                    fill
                    className="object-cover"
                  />
                </div>
              </Link>
            ) : (
              <Link
                href="/avatars/new"
                title="Create an avatar body"
                className="absolute -bottom-1 -right-1 flex h-10 w-10 items-center justify-center rounded-full border-2 border-[#12100d] bg-[#FFDE59] font-mono text-[0.65rem] font-black text-[#12100d] shadow-[2px_2px_0px_#12100d] hover:bg-[#FFE57F]"
              >
                +BODY
              </Link>
            )}
          </div>

          {/* User Info */}
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-friday text-2xl sm:text-3xl uppercase tracking-wide text-[#12100d]">
                {user.name}
              </h1>
            </div>
            <p className="font-mono text-xs text-[#12100d]/60 mt-0.5">{user.email}</p>
            <div className="mt-2.5 flex flex-wrap items-center gap-2">
              <span className="border border-[#12100d] bg-[#FFDE59] px-2 py-0.5 font-mono text-[0.65rem] font-black uppercase text-[#12100d]">
                PALETTE: {user.avatar?.colorSeason?.name ?? "YEAR ROUND"}
              </span>
              <span className="border border-[#12100d] bg-[#F4EFE6] px-2 py-0.5 font-mono text-[0.65rem] font-bold text-[#12100d]/70">
                FIT: {user.preferences.fitPreference.toUpperCase()}
              </span>
            </div>
          </div>
        </div>

        {/* Right: Logout Button */}
        <div className="flex shrink-0 items-center gap-3">
          <form action={signOut}>
            <button
              type="submit"
              className="border-2 border-[#12100d] bg-[#FF5A5F] px-5 py-2 font-friday text-xs uppercase tracking-wider text-white shadow-[3px_3px_0px_#12100d] transition-all hover:bg-[#FF3B42] hover:shadow-[4px_4px_0px_#12100d] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none cursor-pointer"
            >
              LOGOUT ✕
            </button>
          </form>
        </div>
      </div>

      {/* Stats Ribbon */}
      <div className="mt-6 grid grid-cols-2 gap-3 border-t-2 border-[#12100d]/15 pt-5 sm:grid-cols-4">
        <div className="rounded-2xl border-2 border-[#12100d] bg-[#F4EFE6] p-3 text-center shadow-[2px_2px_0px_#12100d]">
          <p className="font-mono text-[0.65rem] font-black uppercase text-[#12100d]/60">PIECES OWNED</p>
          <p className="font-friday text-2xl text-[#12100d] mt-0.5">{piecesCount}</p>
        </div>

        <div className="rounded-2xl border-2 border-[#12100d] bg-[#F4EFE6] p-3 text-center shadow-[2px_2px_0px_#12100d]">
          <p className="font-mono text-[0.65rem] font-black uppercase text-[#12100d]/60">WISHLIST SAVED</p>
          <p className="font-friday text-2xl text-[#12100d] mt-0.5">{wishlistCount}</p>
        </div>

        <div className="rounded-2xl border-2 border-[#12100d] bg-[#F4EFE6] p-3 text-center shadow-[2px_2px_0px_#12100d]">
          <p className="font-mono text-[0.65rem] font-black uppercase text-[#12100d]/60">FITS RENDERED</p>
          <p className="font-friday text-2xl text-[#12100d] mt-0.5">{renderedCount}</p>
        </div>

        <div className="rounded-2xl border-2 border-[#12100d] bg-[#FFDE59] p-3 text-center shadow-[2px_2px_0px_#12100d]">
          <p className="font-mono text-[0.65rem] font-black uppercase text-[#12100d]/80">ACTIVE BODIES</p>
          <p className="font-friday text-2xl text-[#12100d] mt-0.5">{user.avatars.length} / 3</p>
        </div>
      </div>
    </div>
  );
}
