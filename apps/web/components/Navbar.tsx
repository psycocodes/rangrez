"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useSyncExternalStore, useTransition, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2, Sparkles, Check, Layers } from "lucide-react";

import { signOut } from "@/app/actions/auth";
import { profilePhoto } from "@/lib/profile-photo";
import type { Avatar, User } from "@/lib/types";

const HANDSHAKE_NODE_ID = "rangrez-ext-handshake";

function subscribeExtension(onChange: () => void) {
  const node = document.getElementById(HANDSHAKE_NODE_ID);
  if (!node) return () => {};
  const observer = new MutationObserver(onChange);
  observer.observe(node, { attributes: true, attributeFilter: ["data-paired"] });
  return () => observer.disconnect();
}

const checkIsPaired = () => {
  if (typeof document === "undefined") return false;
  return document.getElementById(HANDSHAKE_NODE_ID)?.dataset.paired === "1";
};

export interface NavbarProps {
  user: User;
  token?: string;
  apiBase?: string;
  leftElement?: React.ReactNode;
  centerElement?: React.ReactNode;
  showSearch?: boolean;
  onSearchClick?: () => void;
  tab?: "bought" | "wishlist";
  onTabChange?: (tab: "bought" | "wishlist") => void;
  trialroomBusy?: boolean;
  trialroomReady?: boolean;
}

export function Navbar({
  user,
  token,
  apiBase = "http://localhost:3000",
  leftElement,
  centerElement,
  showSearch = false,
  onSearchClick,
  tab,
  onTabChange,
  trialroomBusy: propBusy,
  trialroomReady: propReady,
}: NavbarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [logoutModalOpen, setLogoutModalOpen] = useState(false);
  const [extPopupOpen, setExtPopupOpen] = useState(false);
  const [isBusy, setIsBusy] = useState(propBusy ?? false);
  const [isReady, setIsReady] = useState(propReady ?? false);
  const [isPending, startTransition] = useTransition();

  const isExtPaired = useSyncExternalStore(subscribeExtension, checkIsPaired, () => false);

  const activeAvatar = user.avatars.find((a) => a.id === user.activeAvatarId) ?? user.avatars[0];
  // One decision, shared with the profile page — see lib/profile-photo.ts.
  const displayProfilePhoto = profilePhoto(user);

  const isAvatarPage = pathname.startsWith("/avatar");
  const isProfilePage = pathname.startsWith("/profile");
  const isArtifactsPage = pathname.startsWith("/artifacts");

  const extRef = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);

  // Sync prop changes
  useEffect(() => {
    if (propBusy !== undefined) setIsBusy(propBusy);
  }, [propBusy]);

  useEffect(() => {
    if (propReady !== undefined) setIsReady(propReady);
  }, [propReady]);

  // Global trialroom state listener
  useEffect(() => {
    const handleStatus = (e: CustomEvent<{ busy?: boolean; ready?: boolean }>) => {
      if (e.detail) {
        if (e.detail.busy !== undefined) setIsBusy(e.detail.busy);
        if (e.detail.ready !== undefined) setIsReady(e.detail.ready);
      }
    };
    window.addEventListener("rangrez-trialroom-status" as any, handleStatus);
    return () => window.removeEventListener("rangrez-trialroom-status" as any, handleStatus);
  }, []);

  // Close popup on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (extRef.current && !extRef.current.contains(e.target as Node)) {
        setExtPopupOpen(false);
      }
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setProfileMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Extension button status color: Green (connected), Yellow (connecting), Gray (not connected)
  const extStatus = isExtPaired ? "connected" : extPopupOpen ? "connecting" : "disconnected";
  const extBtnBg =
    extStatus === "connected"
      ? "bg-[#7FE06E] text-[#12100d]"
      : extStatus === "connecting"
        ? "bg-[#FFDE59] text-[#12100d]"
        : "bg-[#D6D0C5] text-[#12100d]/80 hover:bg-[#C9C2B6]";

  const extBtnText =
    extStatus === "connected"
      ? "PAIRED ✓"
      : extStatus === "connecting"
        ? "CONNECTING..."
        : "EXTENSION";

  return (
    <>
      {/* Hidden Handshake Node for Chrome/Firefox Extension */}
      {token && (
        <div
          id={HANDSHAKE_NODE_ID}
          data-token={token}
          data-api={apiBase}
          hidden
          suppressHydrationWarning
        />
      )}

      {/* ── Floating Unified Navbar ── */}
      <header className="relative z-50 w-full max-w-7xl mx-auto px-4 pt-3 pb-1 shrink-0">
        <nav
          aria-label="Main Navigation"
          className="relative flex items-center justify-between gap-3 rounded-2xl border-[3px] border-[#12100d] bg-[#F4EFE6]/95 p-2 sm:px-4 sm:py-2.5 shadow-[4px_4px_0px_#12100d] backdrop-blur-md transition-all"
        >
          {/* ── Left Side: Back button if present, otherwise Rangrez Logo ── */}
          <div className="flex items-center gap-3 shrink-0">
            {leftElement ? (
              leftElement
            ) : (
              <Link href="/wardrobe" className="flex items-center gap-2 text-[#12100d] hover:opacity-80 transition-opacity">
                <Image
                  src="/assets/logos/rangrez-logo.png"
                  alt="Rangrez Logo"
                  width={34}
                  height={34}
                  className="object-contain"
                  style={{
                    filter:
                      "drop-shadow(1.5px 1.5px 0px #12100d) drop-shadow(-1.5px -1.5px 0px #12100d) drop-shadow(1.5px -1.5px 0px #12100d) drop-shadow(-1.5px 1.5px 0px #12100d)",
                  }}
                />
                <span className="font-display font-bold text-lg tracking-[0.12em] uppercase">
                  Rangrez
                </span>
              </Link>
            )}
          </div>

          {/* ── Center: If back button is on left, Logo is in the middle. Otherwise search/toggle/status. ── */}
          <div className="flex flex-1 items-center justify-center min-w-0 px-2">
            {isBusy ? (
              <div className="flex items-center gap-2 rounded-xl border-2 border-[#12100d] bg-[#FF5A5F] px-3.5 py-1.5 font-friday text-xs uppercase tracking-wider text-white shadow-[2px_2px_0px_#12100d] animate-pulse">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                <span>TRIALROOM BUSY...</span>
              </div>
            ) : isReady ? (
              <Link
                href="/artifacts"
                className="flex items-center gap-2 rounded-xl border-2 border-[#12100d] bg-[#7FE06E] px-3.5 py-1.5 font-friday text-xs uppercase tracking-wider text-[#12100d] shadow-[2px_2px_0px_#12100d] hover:bg-[#92E883] transition-all cursor-pointer"
              >
                <Check className="h-4 w-4 stroke-[3]" />
                <span>FIT READY! (VIEW)</span>
              </Link>
            ) : centerElement ? (
              centerElement
            ) : leftElement ? (
              /* When there's a back button on the left, Rangrez logo sits in the middle */
              <Link href="/wardrobe" className="flex items-center gap-2 text-[#12100d] hover:opacity-80 transition-opacity">
                <Image
                  src="/assets/logos/rangrez-logo.png"
                  alt="Rangrez Logo"
                  width={34}
                  height={34}
                  className="object-contain"
                  style={{
                    filter:
                      "drop-shadow(1.5px 1.5px 0px #12100d) drop-shadow(-1.5px -1.5px 0px #12100d) drop-shadow(1.5px -1.5px 0px #12100d) drop-shadow(-1.5px 1.5px 0px #12100d)",
                  }}
                />
                <span className="font-display font-bold text-lg tracking-[0.12em] uppercase">
                  Rangrez
                </span>
              </Link>
            ) : showSearch ? (
              <div className="flex w-full max-w-lg items-center gap-2.5">
                <button
                  type="button"
                  onClick={onSearchClick}
                  className="relative flex-1 flex items-center justify-between rounded-xl border-2 border-[#12100d] bg-white px-3.5 py-1.5 font-mono text-[0.75rem] font-bold uppercase text-[#12100d]/50 shadow-[2px_2px_0px_#12100d] hover:text-[#12100d] hover:border-[#12100d] transition-all cursor-pointer text-left"
                >
                  <span className="truncate">SEARCH PIECES...</span>
                  <span className="font-mono text-[0.62rem] font-black border border-[#12100d]/20 bg-[#F4EFE6] px-1.5 py-0.5 rounded text-[#12100d]/60">
                    ⌘K
                  </span>
                </button>

                {tab && onTabChange && (
                  /* ── Segmented Toggle Switch for Bought & Wishlist ── */
                  <div className="inline-flex p-1 rounded-xl border-2 border-[#12100d] bg-white shadow-[2px_2px_0px_#12100d] shrink-0">
                    <button
                      type="button"
                      onClick={() => onTabChange("bought")}
                      className={`relative rounded-lg px-3 py-1 font-mono text-[0.68rem] font-black tracking-wider uppercase transition-all cursor-pointer ${
                        tab === "bought"
                          ? "bg-[#FFDE59] text-[#12100d] border border-[#12100d] shadow-[1px_1px_0px_#12100d]"
                          : "text-[#12100d]/60 hover:text-[#12100d] border border-transparent"
                      }`}
                    >
                      BOUGHT
                    </button>
                    <button
                      type="button"
                      onClick={() => onTabChange("wishlist")}
                      className={`relative rounded-lg px-3 py-1 font-mono text-[0.68rem] font-black tracking-wider uppercase transition-all cursor-pointer ${
                        tab === "wishlist"
                          ? "bg-[#FFDE59] text-[#12100d] border border-[#12100d] shadow-[1px_1px_0px_#12100d]"
                          : "text-[#12100d]/60 hover:text-[#12100d] border border-transparent"
                      }`}
                    >
                      WISHLIST
                    </button>
                  </div>
                )}
              </div>
            ) : null}
          </div>

          {/* ── Right Side: Artifacts + Extension + Avatar + Profile ── */}
          <div className="flex items-center gap-2.5 shrink-0">
            {/* Artifacts Link */}
            <Link
              href="/artifacts"
              title="Minted Artifacts Gallery"
              className={`flex h-10 items-center gap-1.5 rounded-xl border-[2.5px] border-[#12100d] px-3 font-friday text-[0.72rem] uppercase tracking-wider shadow-[2px_2px_0px_#12100d] transition-all active:translate-x-[1px] active:translate-y-[1px] cursor-pointer ${
                isArtifactsPage
                  ? "bg-[#12100d] text-[#FFDE59]"
                  : "bg-[#FFDE59] text-[#12100d] hover:bg-[#FFE57F]"
              }`}
            >
              <Layers className="h-4 w-4" />
              <span className="hidden sm:inline">ARTIFACTS</span>
            </Link>
            {/* Extension Pairing Button (Color represents status: Gray=Disconnected, Green=Connected, Yellow=Connecting) */}
            <div ref={extRef} className="relative">
              <button
                type="button"
                onClick={() => setExtPopupOpen((o) => !o)}
                title={`Browser Extension (${extStatus})`}
                className={`flex h-10 items-center justify-center rounded-xl border-[2.5px] border-[#12100d] px-3.5 py-2 font-mono text-[0.72rem] font-black uppercase shadow-[2px_2px_0px_#12100d] transition-all active:translate-x-[1px] active:translate-y-[1px] cursor-pointer ${extBtnBg}`}
              >
                <span>{extBtnText}</span>
              </button>

              {/* ── Extension Popup (Anchored directly under the button, NO full screen blur) ── */}
              <AnimatePresence>
                {extPopupOpen && (
                  <motion.div
                    initial={{ scale: 0.94, opacity: 0, y: 8 }}
                    animate={{ scale: 1, opacity: 1, y: 0 }}
                    exit={{ scale: 0.94, opacity: 0, y: 8 }}
                    transition={{ type: "spring", stiffness: 350, damping: 28 }}
                    className="absolute right-0 top-full mt-2.5 z-50 w-80 sm:w-96 rounded-2xl border-[3px] border-[#12100d] bg-[#F4EFE6] p-4 shadow-[6px_6px_0px_#12100d]"
                  >
                    <div className="flex items-center justify-between border-b-2 border-[#12100d]/15 pb-2.5 mb-3">
                      <div className="flex items-center gap-2">
                        <span className="border border-[#12100d] bg-[#7FE06E] px-1.5 py-0.2 font-mono text-[0.62rem] font-black uppercase text-[#12100d]">
                          HANDSHAKE
                        </span>
                        <h4 className="font-friday text-base uppercase tracking-wide text-[#12100d]">
                          Extension Pairing
                        </h4>
                      </div>
                      <button
                        type="button"
                        onClick={() => setExtPopupOpen(false)}
                        className="rounded-lg border border-[#12100d] bg-white px-2 py-0.5 font-mono text-xs font-black text-[#12100d] shadow-[1px_1px_0px_#12100d] hover:bg-[#FF5A5F] hover:text-white cursor-pointer"
                      >
                        ✕
                      </button>
                    </div>

                    <div className="space-y-3 font-mono text-xs text-[#12100d]">
                      <div
                        className={`rounded-xl border-2 border-[#12100d] p-3 text-center shadow-[2px_2px_0px_#12100d] ${
                          isExtPaired ? "bg-[#7FE06E]" : "bg-white"
                        }`}
                      >
                        <p className="font-friday text-sm uppercase tracking-wide">
                          {isExtPaired ? "PAIRED & ACTIVE ✓" : "WAITING FOR PAIRING..."}
                        </p>
                        <p className="font-mono text-[0.65rem] text-[#12100d]/70 mt-0.5">
                          {isExtPaired
                            ? "Connected! Try on garments from Zara, H&M, and Myntra in 1 click."
                            : "Ensure the Rangrez browser extension is installed."}
                        </p>
                      </div>

                      <div className="rounded-xl border-2 border-[#12100d] bg-[#FAF6EF] p-2.5 space-y-1">
                        <p className="font-mono text-[0.62rem] font-black uppercase text-[#12100d]/60">
                          Instructions:
                        </p>
                        <ol className="list-decimal list-inside space-y-0.5 font-mono text-[0.65rem] text-[#12100d]/80">
                          <li>Open this tab while the Rangrez Extension is active.</li>
                          <li>The extension reads the pairing handshake automatically.</li>
                          <li>Status turns green once paired.</li>
                        </ol>
                      </div>

                      <div className="flex gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => {
                            if (token) {
                              navigator.clipboard.writeText(token);
                              alert("Pairing token copied to clipboard!");
                            }
                          }}
                          className="flex-1 rounded-xl border-2 border-[#12100d] bg-[#FFDE59] py-2 font-friday text-xs uppercase tracking-wider text-[#12100d] shadow-[2px_2px_0px_#12100d] hover:bg-[#FFE57F] active:translate-x-[1px] active:translate-y-[1px] transition-all cursor-pointer"
                        >
                          Copy Token
                        </button>
                        <button
                          type="button"
                          onClick={() => setExtPopupOpen(false)}
                          className="rounded-xl border-2 border-[#12100d] bg-white py-2 px-4 font-friday text-xs uppercase tracking-wider text-[#12100d] shadow-[2px_2px_0px_#12100d] hover:bg-[#FAF6EF] cursor-pointer"
                        >
                          Done
                        </button>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Circular Active Avatar Button (Yellow Ball) */}
            {!isAvatarPage && (
              <Link
                href="/avatar"
                title="Active Avatar Body (Go to Avatars)"
                aria-label="Manage Avatar Bodies"
                className="relative h-10 w-10 overflow-hidden rounded-full border-2 border-[#12100d] bg-[#FFDE59] shadow-[2px_2px_0px_#12100d] hover:scale-105 active:translate-x-[1px] active:translate-y-[1px] transition-all flex items-center justify-center cursor-pointer shrink-0"
              >
                {activeAvatar ? (
                  <Image
                    src={activeAvatar.renderUrl}
                    alt={activeAvatar.customization.label}
                    fill
                    className="object-cover"
                  />
                ) : (
                  <span className="font-mono text-[0.6rem] font-black text-[#12100d]">AV</span>
                )}
              </Link>
            )}

            {/* Circular Profile Button (Green Ball with Dropdown) */}
            {!isProfilePage && (
              <div ref={profileRef} className="relative">
                <button
                  type="button"
                  onClick={() => setProfileMenuOpen((o) => !o)}
                  title="Profile & Account"
                  aria-label="Profile and sign out menu"
                  className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-[#12100d] bg-[#7FE06E] shadow-[2px_2px_0px_#12100d] hover:scale-105 active:translate-x-[1px] active:translate-y-[1px] transition-all overflow-hidden cursor-pointer shrink-0"
                >
                  <div className="relative h-full w-full">
                    <Image
                      src={displayProfilePhoto}
                      alt={user.name || "Profile"}
                      fill
                      className="object-cover"
                      unoptimized={displayProfilePhoto.startsWith("https://unavatar.io") || displayProfilePhoto.includes("googleusercontent")}
                    />
                  </div>
                </button>

                {/* Profile Popover Dropdown */}
                <AnimatePresence>
                  {profileMenuOpen && (
                    <motion.div
                      initial={{ scale: 0.94, opacity: 0, y: 8 }}
                      animate={{ scale: 1, opacity: 1, y: 0 }}
                      exit={{ scale: 0.94, opacity: 0, y: 8 }}
                      transition={{ type: "spring", stiffness: 350, damping: 28 }}
                      className="absolute right-0 top-full mt-2.5 z-50 w-56 rounded-2xl border-[3px] border-[#12100d] bg-white p-3 shadow-[5px_5px_0px_#12100d] text-[#12100d]"
                    >
                      <div className="border-b-2 border-[#12100d]/15 pb-2 mb-2">
                        <p className="font-friday text-sm uppercase truncate">{user.name}</p>
                        <p className="font-mono text-[0.65rem] text-[#12100d]/60 truncate">
                          {user.email}
                        </p>
                      </div>

                      <div className="space-y-1.5">
                        <Link
                          href="/profile"
                          onClick={() => setProfileMenuOpen(false)}
                          className="block w-full rounded-xl border-2 border-[#12100d] bg-[#F4EFE6] py-1.5 px-3 text-center font-mono text-[0.7rem] font-black uppercase text-[#12100d] shadow-[2px_2px_0px_#12100d] hover:bg-[#FFDE59] transition-all"
                        >
                          VIEW PROFILE 👤
                        </Link>

                        <button
                          type="button"
                          onClick={() => {
                            setProfileMenuOpen(false);
                            setLogoutModalOpen(true);
                          }}
                          className="w-full rounded-xl border-2 border-[#12100d] bg-[#FF5A5F] py-1.5 px-3 text-center font-mono text-[0.7rem] font-black uppercase text-white shadow-[2px_2px_0px_#12100d] hover:bg-[#FF3B42] cursor-pointer transition-all"
                        >
                          LOGOUT ✕
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}
          </div>
        </nav>
      </header>

      {/* ── Logout Confirmation Modal (Neobrutalism) ── */}
      <AnimatePresence>
        {logoutModalOpen && (
          <div
            className="fixed inset-0 z-[110] flex items-center justify-center bg-[#12100d]/75 p-4 backdrop-blur-sm"
            onClick={(e) => {
              if (e.target === e.currentTarget) setLogoutModalOpen(false);
            }}
          >
            <motion.div
              initial={{ scale: 0.92, opacity: 0, y: 12 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.92, opacity: 0, y: 12 }}
              transition={{ type: "spring", stiffness: 320, damping: 26 }}
              className="w-full max-w-sm rounded-3xl border-[3.5px] border-[#12100d] bg-[#F4EFE6] p-6 shadow-[8px_8px_0px_#12100d] text-center"
            >
              <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl border-[2.5px] border-[#12100d] bg-[#FF5A5F] text-2xl font-black text-white shadow-[3px_3px_0px_#12100d]">
                ✕
              </div>

              <h3 className="font-friday text-2xl uppercase tracking-wide text-[#12100d]">
                Confirm Logout
              </h3>
              <p className="font-mono text-xs text-[#12100d]/70 mt-1 mb-5">
                Are you sure you want to exit your Rangrez session?
              </p>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setLogoutModalOpen(false)}
                  className="flex-1 rounded-2xl border-2 border-[#12100d] bg-white py-2.5 font-friday text-xs uppercase tracking-wider text-[#12100d] shadow-[3px_3px_0px_#12100d] hover:bg-[#FAF6EF] active:translate-x-[1px] active:translate-y-[1px] transition-all cursor-pointer"
                >
                  Cancel
                </button>

                <form action={signOut} className="flex-1">
                  <button
                    type="submit"
                    disabled={isPending}
                    className="w-full rounded-2xl border-2 border-[#12100d] bg-[#FF5A5F] py-2.5 font-friday text-xs uppercase tracking-wider text-white shadow-[3px_3px_0px_#12100d] hover:bg-[#FF3B42] active:translate-x-[1px] active:translate-y-[1px] transition-all cursor-pointer"
                  >
                    Yes, Logout ✕
                  </button>
                </form>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
