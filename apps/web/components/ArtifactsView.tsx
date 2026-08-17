"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ExternalLink,
  ShoppingBag,
  Sparkles,
  Layers,
  ArrowLeft,
  Trash2,
  Share2,
  Check,
  RotateCcw,
  Tag,
  Store,
  DollarSign,
  Shirt,
  X,
} from "lucide-react";

import { Navbar } from "./Navbar";
import { getLocalArtifacts, removeLocalArtifact, saveLocalArtifact } from "@/lib/artifacts-client";
import type { ArtifactItem, Garment, User, Zone } from "@/lib/types";

const ESTIMATED_ZONE_PRICES: Record<Zone, number> = {
  top: 2490,
  bottom: 3990,
  outerwear: 7490,
  shoes: 4990,
  accessory: 1890,
};

export function ArtifactsView({
  user,
  initialArtifacts,
  token,
  apiBase,
}: {
  user: User;
  initialArtifacts: ArtifactItem[];
  token: string;
  apiBase: string;
}) {
  const router = useRouter();
  const [artifacts, setArtifacts] = useState<ArtifactItem[]>(initialArtifacts);
  const [selectedArtifact, setSelectedArtifact] = useState<ArtifactItem | null>(null);
  const [copied, setCopied] = useState(false);
  const [tabsOpened, setTabsOpened] = useState(false);
  const [filterAvatarId, setFilterAvatarId] = useState<string>("all");

  // Sync with client localStorage
  useEffect(() => {
    const local = getLocalArtifacts();
    if (local.length > 0) {
      // Merge unique by ID
      const map = new Map<string, ArtifactItem>();
      initialArtifacts.forEach((a) => map.set(a.id, a));
      local.forEach((a) => map.set(a.id, a));
      setArtifacts(Array.from(map.values()));
    }

    const handleUpdate = (e: CustomEvent<ArtifactItem[]>) => {
      if (e.detail) setArtifacts(e.detail);
    };
    window.addEventListener("rangrez-artifacts-updated" as any, handleUpdate);
    return () => window.removeEventListener("rangrez-artifacts-updated" as any, handleUpdate);
  }, [initialArtifacts]);

  // Filtered artifacts
  const filtered = useMemo(() => {
    if (filterAvatarId === "all") return artifacts;
    return artifacts.filter((a) => a.avatarId === filterAvatarId);
  }, [artifacts, filterAvatarId]);

  // Aggregate stats
  const totalValuation = useMemo(() => {
    return artifacts.reduce((sum, a) => sum + (a.totalPrice || 0), 0);
  }, [artifacts]);

  const totalWishes = useMemo(() => {
    return artifacts.reduce((sum, a) => sum + (a.wishlistCount || 0), 0);
  }, [artifacts]);

  const formattedValuation = new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(totalValuation);

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this minted artifact?")) return;
    removeLocalArtifact(id);
    setArtifacts((prev) => prev.filter((a) => a.id !== id));
    if (selectedArtifact?.id === id) setSelectedArtifact(null);

    try {
      await fetch("/api/artifacts", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
    } catch (err) {
      console.error("Delete failed", err);
    }
  };

  const handleOpenAllTabs = (artifact: ArtifactItem) => {
    const wishlistItems = artifact.garments.filter((g) => g.origin === "shop" || g.sourceUrl);
    if (!wishlistItems.length) return;

    wishlistItems.forEach((item) => {
      const url = item.sourceUrl || `https://www.google.com/search?q=${encodeURIComponent(item.name + " buy online")}`;
      window.open(url, "_blank", "noopener,noreferrer");
    });
    setTabsOpened(true);
    setTimeout(() => setTabsOpened(false), 3000);
  };

  const handleShare = (artifact: ArtifactItem) => {
    if (typeof window !== "undefined") {
      navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="relative min-h-screen w-full flex-1 flex flex-col overflow-y-auto bg-[#F4EFE6] text-[#12100d] pb-28">
      {/* Background Texture */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 opacity-[0.4]"
        style={{
          backgroundImage:
            "radial-gradient(#12100d 1px, transparent 1px), repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(18,16,13,0.03) 3px, rgba(18,16,13,0.03) 4px)",
          backgroundSize: "24px 24px, 100% 4px",
        }}
      />

      {/* Floating Navbar */}
      <Navbar
        user={user}
        token={token}
        apiBase={apiBase}
        leftElement={
          <Link
            href="/trialroom"
            className="flex items-center gap-1.5 rounded-xl border-2 border-[#12100d] bg-white px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-[#12100d] shadow-[2px_2px_0px_#12100d] hover:bg-[#FFDE59] transition-colors"
            style={{ fontFamily: "var(--font-clash), sans-serif" }}
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>TRIAL ROOM</span>
          </Link>
        }
      />

      {/* Main Container */}
      <main className="relative z-10 flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 py-6 space-y-6">
        {/* Header Hero Section */}
        <section className="rounded-3xl border-[3.5px] border-[#12100d] bg-[#FFDE59] p-6 sm:p-8 shadow-[6px_6px_0px_#12100d]">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-xl border-2 border-[#12100d] bg-[#7FE06E] shadow-[2px_2px_0px_#12100d]">
                  <Layers className="h-5 w-5 text-[#12100d]" />
                </span>
                <span
                  className="text-xs font-bold uppercase tracking-widest text-[#12100d]/80"
                  style={{ fontFamily: "var(--font-clash), sans-serif" }}
                >
                  MINTED LOOKS COLLECTION
                </span>
              </div>
              <h1
                className="text-3xl sm:text-5xl font-black uppercase tracking-wide text-[#12100d]"
                style={{ fontFamily: "var(--font-clash), sans-serif" }}
              >
                ARTIFACTS GALLERY
              </h1>
              <p
                className="text-xs max-w-xl text-[#12100d]/80 leading-relaxed font-medium"
                style={{ fontFamily: "var(--font-instrument-sans), sans-serif" }}
              >
                Every outfit generation is minted into an archival artifact. Review compositions, inspect shop pricing, and launch wishlisted store carts with 1 click.
              </p>
            </div>

            {/* Quick Stats Grid */}
            <div className="grid grid-cols-3 gap-3 shrink-0">
              <div className="rounded-2xl border-2 border-[#12100d] bg-white p-3 shadow-[3px_3px_0px_#12100d] text-center min-w-[5.5rem]">
                <span className="font-mono text-[0.62rem] font-black uppercase text-[#12100d]/60">
                  Total Fits
                </span>
                <p className="font-friday text-2xl text-[#12100d]">{artifacts.length}</p>
              </div>

              <div className="rounded-2xl border-2 border-[#12100d] bg-white p-3 shadow-[3px_3px_0px_#12100d] text-center min-w-[5.5rem]">
                <span className="font-mono text-[0.62rem] font-black uppercase text-[#12100d]/60">
                  Shop Wishes
                </span>
                <p className="font-friday text-2xl text-[#FF5A5F]">{totalWishes}</p>
              </div>

              <div className="rounded-2xl border-2 border-[#12100d] bg-white p-3 shadow-[3px_3px_0px_#12100d] text-center min-w-[7rem]">
                <span className="font-mono text-[0.62rem] font-black uppercase text-[#12100d]/60">
                  Valuation
                </span>
                <p className="font-friday text-xl text-[#12100d] truncate">
                  {formattedValuation}
                </p>
              </div>
            </div>
          </div>

          {/* Filter Bar */}
          {user.avatars.length > 1 && (
            <div className="mt-6 flex items-center gap-2 pt-4 border-t-2 border-[#12100d]/20">
              <span className="font-mono text-[0.65rem] font-black uppercase text-[#12100d]/70">
                Avatar Filter:
              </span>
              <button
                type="button"
                onClick={() => setFilterAvatarId("all")}
                className={`rounded-xl border-2 border-[#12100d] px-3 py-1 font-mono text-[0.68rem] font-black uppercase transition-all cursor-pointer ${
                  filterAvatarId === "all"
                    ? "bg-[#12100d] text-[#FFDE59] shadow-[2px_2px_0px_rgba(0,0,0,0.3)]"
                    : "bg-white text-[#12100d] hover:bg-[#FAF6EF]"
                }`}
              >
                All Avatars
              </button>
              {user.avatars.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => setFilterAvatarId(a.id)}
                  className={`rounded-xl border-2 border-[#12100d] px-3 py-1 font-mono text-[0.68rem] font-black uppercase transition-all cursor-pointer ${
                    filterAvatarId === a.id
                      ? "bg-[#12100d] text-[#FFDE59] shadow-[2px_2px_0px_rgba(0,0,0,0.3)]"
                      : "bg-white text-[#12100d] hover:bg-[#FAF6EF]"
                  }`}
                >
                  {a.customization.label}
                </button>
              ))}
            </div>
          )}
        </section>

        {/* Artifacts Gallery Grid */}
        {filtered.length === 0 ? (
          <section className="rounded-3xl border-[3px] border-dashed border-[#12100d]/40 bg-white/60 p-12 text-center space-y-4">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border-[3px] border-[#12100d] bg-[#FFDE59] shadow-[4px_4px_0px_#12100d]">
              <Shirt className="h-8 w-8 text-[#12100d]" />
            </div>
            <h3 className="font-friday text-2xl uppercase text-[#12100d]">
              NO ARTIFACTS MINTED YET
            </h3>
            <p className="font-mono text-xs text-[#12100d]/70 max-w-md mx-auto">
              Head into the Trial Room, style an outfit across the 5 slots, and slide the generation button to create your first artifact.
            </p>
            <Link
              href="/trialroom"
              className="inline-flex items-center gap-2 rounded-2xl border-[3px] border-[#12100d] bg-[#7FE06E] px-6 py-3 font-friday text-sm uppercase tracking-wider text-[#12100d] shadow-[4px_4px_0px_#12100d] hover:bg-[#92E883] active:translate-x-[2px] active:translate-y-[2px] transition-all"
            >
              <span>GO TO TRIAL ROOM →</span>
            </Link>
          </section>
        ) : (
          <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filtered.map((artifact, i) => {
              const wishlistCount = artifact.garments.filter(
                (g) => g.origin === "shop" || g.sourceUrl,
              ).length;
              const formattedPrice = new Intl.NumberFormat("en-IN", {
                style: "currency",
                currency: "INR",
                maximumFractionDigits: 0,
              }).format(artifact.totalPrice);

              return (
                <motion.div
                  key={artifact.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  onClick={() => setSelectedArtifact(artifact)}
                  className="group relative flex flex-col rounded-3xl border-[3px] border-[#12100d] bg-white p-4 shadow-[5px_5px_0px_#12100d] hover:shadow-[7px_7px_0px_#12100d] hover:translate-x-[-2px] hover:translate-y-[-2px] transition-all cursor-pointer overflow-hidden"
                >
                  {/* Top Bar on Card */}
                  <div className="flex items-center justify-between pb-2 mb-2 border-b-2 border-[#12100d]/10">
                    <span className="font-mono text-[0.65rem] font-black uppercase text-[#12100d]/60">
                      {artifact.avatarLabel || "Active Avatar"}
                    </span>
                    <span className="font-mono text-[0.62rem] font-bold text-[#12100d]/50">
                      {new Date(artifact.createdAt).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                      })}
                    </span>
                  </div>

                  {/* Main Avatar Photo */}
                  <div className="relative aspect-[3/4] w-full overflow-hidden rounded-2xl border-2 border-[#12100d] bg-[#FAF6EF]">
                    <Image
                      src={artifact.renderUrl}
                      alt={artifact.name}
                      fill
                      className="object-contain transition-transform duration-300 group-hover:scale-105"
                      sizes="(max-width: 768px) 100vw, 300px"
                    />

                    {/* Quick Badge */}
                    <div className="absolute top-2 right-2 flex flex-col gap-1">
                      {wishlistCount > 0 && (
                        <span className="rounded-lg border border-[#12100d] bg-[#C0AEDE] px-2 py-0.5 font-mono text-[0.6rem] font-black text-[#12100d] shadow-[1px_1px_0px_#12100d]">
                          {wishlistCount} WISH{wishlistCount === 1 ? "" : "ES"}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Garment Thumbnails Strip */}
                  <div className="mt-3 flex items-center gap-1.5 overflow-x-auto py-1">
                    {artifact.garments.map((g) => (
                      <div
                        key={g.id}
                        title={`${g.name} (${g.zone})`}
                        className="relative h-8 w-8 rounded-lg border border-[#12100d] bg-[#FAF6EF] overflow-hidden shrink-0"
                      >
                        <Image
                          src={g.imageUrl}
                          alt={g.name}
                          fill
                          className="object-cover"
                        />
                      </div>
                    ))}
                  </div>

                  {/* Card Footer */}
                  <div className="mt-3 flex items-center justify-between pt-2 border-t-2 border-[#12100d]/10">
                    <div>
                      <h4
                        className="text-base font-bold uppercase text-[#12100d] truncate max-w-[10rem]"
                        style={{ fontFamily: "var(--font-clash), sans-serif" }}
                      >
                        {artifact.name}
                      </h4>
                      <span
                        className="text-[0.65rem] font-bold text-[#12100d]/70"
                        style={{ fontFamily: "var(--font-instrument-sans), sans-serif" }}
                      >
                        {formattedPrice}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedArtifact(artifact);
                      }}
                      className="rounded-xl border-2 border-[#12100d] bg-[#FFDE59] px-2.5 py-1 text-[0.7rem] font-bold uppercase tracking-wider text-[#12100d] shadow-[2px_2px_0px_#12100d] hover:bg-[#FFE57F]"
                      style={{ fontFamily: "var(--font-clash), sans-serif" }}
                    >
                      INSPECT →
                    </button>
                  </div>
                </motion.div>
              );
            })}
          </section>
        )}
      </main>

      {/* ── ARTIFACT DETAIL INSPECTOR MODAL ── */}
      <AnimatePresence>
        {selectedArtifact && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedArtifact(null)}
              className="fixed inset-0 bg-[#12100d]/75 backdrop-blur-md"
            />

            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              transition={{ type: "spring", stiffness: 320, damping: 26 }}
              className="relative z-10 w-full max-w-3xl overflow-hidden rounded-3xl border-[4px] border-[#12100d] bg-[#F4EFE6] shadow-[10px_10px_0px_#12100d]"
            >
              {/* Modal Top Bar */}
              <div className="flex items-center justify-between border-b-[3px] border-[#12100d] bg-[#FFDE59] px-6 py-3.5">
                <div className="flex items-center gap-2.5">
                  <span className="flex h-7 w-7 items-center justify-center rounded-lg border-2 border-[#12100d] bg-[#7FE06E] shadow-[1.5px_1.5px_0px_#12100d]">
                    <Sparkles className="h-4 w-4 text-[#12100d]" />
                  </span>
                  <span className="font-friday text-lg uppercase tracking-wider text-[#12100d]">
                    ARTIFACT INSPECTOR
                  </span>
                  <span className="rounded-full border border-[#12100d] bg-white px-2.5 py-0.5 font-mono text-xs font-black text-[#12100d]">
                    {selectedArtifact.avatarLabel || "Active Avatar"}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => setSelectedArtifact(null)}
                  className="flex h-8 w-8 items-center justify-center rounded-xl border-2 border-[#12100d] bg-white text-[#12100d] shadow-[2px_2px_0px_#12100d] hover:bg-[#FF5A5F] hover:text-white transition-colors cursor-pointer"
                >
                  <X className="h-4 w-4 stroke-[3]" />
                </button>
              </div>

              {/* Inspector Content */}
              <div className="p-6 grid grid-cols-1 md:grid-cols-[16rem_1fr] gap-6 max-h-[75vh] overflow-y-auto">
                {/* Left: Avatar Picture */}
                <div className="flex flex-col items-center">
                  <div className="relative w-full aspect-[3/4] rounded-2xl border-[3px] border-[#12100d] bg-white p-2 shadow-[4px_4px_0px_#12100d]">
                    <div className="relative h-full w-full rounded-xl bg-[#FAF6EF] overflow-hidden">
                      <Image
                        src={selectedArtifact.renderUrl}
                        alt={selectedArtifact.name}
                        fill
                        className="object-contain"
                      />
                    </div>
                  </div>

                  <div className="mt-3 flex w-full gap-2">
                    <a
                      href={selectedArtifact.renderUrl}
                      download={`rangrez-fit-${selectedArtifact.id.slice(0, 6)}.png`}
                      target="_blank"
                      rel="noreferrer"
                      className="flex-1 flex items-center justify-center gap-1.5 rounded-xl border-2 border-[#12100d] bg-white py-2 font-mono text-[0.68rem] font-black text-[#12100d] shadow-[2px_2px_0px_#12100d] hover:bg-[#FFDE59]"
                    >
                      DOWNLOAD
                    </a>
                    <button
                      type="button"
                      onClick={() => handleShare(selectedArtifact)}
                      className="flex items-center justify-center gap-1 rounded-xl border-2 border-[#12100d] bg-white px-3 py-2 font-mono text-[0.68rem] font-black text-[#12100d] shadow-[2px_2px_0px_#12100d] hover:bg-[#FFDE59] cursor-pointer"
                    >
                      {copied ? <Check className="h-3.5 w-3.5" /> : <Share2 className="h-3.5 w-3.5" />}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(selectedArtifact.id)}
                      title="Delete Artifact"
                      className="flex items-center justify-center rounded-xl border-2 border-[#12100d] bg-white px-3 py-2 text-[#FF5A5F] shadow-[2px_2px_0px_#12100d] hover:bg-[#FF5A5F] hover:text-white cursor-pointer"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                {/* Right: Outfit Breakdown & Multi-tab Button */}
                <div className="flex flex-col justify-between space-y-4">
                  <div className="space-y-3">
                    <div>
                      <h3
                        className="text-2xl font-black uppercase tracking-wide text-[#12100d]"
                        style={{ fontFamily: "var(--font-clash), sans-serif" }}
                      >
                        {selectedArtifact.name}
                      </h3>
                      <p
                        className="text-xs text-[#12100d]/70"
                        style={{ fontFamily: "var(--font-instrument-sans), sans-serif" }}
                      >
                        Minted on {new Date(selectedArtifact.createdAt).toLocaleString()}
                      </p>
                    </div>

                    {/* Total Price Card */}
                    <div className="flex items-center justify-between rounded-2xl border-2 border-[#12100d] bg-white p-3.5 shadow-[3px_3px_0px_#12100d]">
                      <div>
                        <span
                          className="text-[0.65rem] font-bold uppercase text-[#12100d]/60"
                          style={{ fontFamily: "var(--font-clash), sans-serif" }}
                        >
                          Total Fit Valuation
                        </span>
                        <p
                          className="text-2xl font-black text-[#12100d]"
                          style={{ fontFamily: "var(--font-clash), sans-serif" }}
                        >
                          {new Intl.NumberFormat("en-IN", {
                            style: "currency",
                            currency: "INR",
                            maximumFractionDigits: 0,
                          }).format(selectedArtifact.totalPrice)}
                        </p>
                      </div>

                      <div className="text-right">
                        <span
                          className="text-[0.65rem] font-bold uppercase text-[#12100d]/60"
                          style={{ fontFamily: "var(--font-clash), sans-serif" }}
                        >
                          Layers Worn
                        </span>
                        <p
                          className="text-lg font-bold text-[#12100d]"
                          style={{ fontFamily: "var(--font-clash), sans-serif" }}
                        >
                          {selectedArtifact.garments.length} Pieces
                        </p>
                      </div>
                    </div>

                    {/* Equiped Items List */}
                    <div className="space-y-2">
                      <span
                        className="text-[0.65rem] font-bold uppercase text-[#12100d]/60"
                        style={{ fontFamily: "var(--font-clash), sans-serif" }}
                      >
                        Itemized Garments & Shop Links:
                      </span>
                      <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                        {selectedArtifact.garments.map((g) => {
                          const isShop = g.origin === "shop" || Boolean(g.sourceUrl);
                          const storeName = isShop ? "Zara / Online Store" : "Personal Closet";
                          const priceVal = isShop ? (ESTIMATED_ZONE_PRICES[g.zone] || 2490) : 0;
                          const formattedItemPrice = isShop ? `₹${priceVal.toLocaleString()}` : "OWNED";

                          return (
                            <div
                              key={g.id}
                              className="flex items-center justify-between rounded-xl border-2 border-[#12100d] bg-[#FAF6EF] p-2.5 shadow-[2px_2px_0px_#12100d]"
                            >
                              <div className="flex items-center gap-3 min-w-0">
                                <div className="relative h-11 w-11 rounded-lg border border-[#12100d] bg-white overflow-hidden shrink-0">
                                  <Image
                                    src={g.imageUrl}
                                    alt={g.name}
                                    fill
                                    className="object-cover"
                                  />
                                </div>
                                <div className="min-w-0">
                                  <p
                                    className="truncate text-[0.75rem] font-bold text-[#12100d]"
                                    style={{ fontFamily: "var(--font-clash), sans-serif" }}
                                  >
                                    {g.name}
                                  </p>
                                  <div
                                    className="flex items-center gap-1.5 text-[0.62rem] text-[#12100d]/70 uppercase"
                                    style={{ fontFamily: "var(--font-instrument-sans), sans-serif" }}
                                  >
                                    <span className="font-bold text-[#12100d]">{g.zone}</span>
                                    <span>·</span>
                                    <span>{g.dye.name}</span>
                                    <span>·</span>
                                    <span className="text-[#FF5A5F]">{storeName}</span>
                                  </div>
                                </div>
                              </div>

                              <div className="flex items-center gap-2 shrink-0">
                                <span
                                  className={`rounded border border-[#12100d] px-2 py-0.5 text-[0.68rem] font-black ${
                                    isShop ? "bg-[#FFDE59] text-[#12100d]" : "bg-[#7FE06E] text-[#12100d]"
                                  }`}
                                  style={{ fontFamily: "var(--font-clash), sans-serif" }}
                                >
                                  {formattedItemPrice}
                                </span>

                                {isShop && (
                                  <a
                                    href={g.sourceUrl || `https://www.google.com/search?q=${encodeURIComponent(g.name + " buy online")}`}
                                    target="_blank"
                                    rel="noreferrer"
                                    title="Open Shop Product Page"
                                    className="flex h-7 w-7 items-center justify-center rounded-lg border border-[#12100d] bg-white text-[#12100d] hover:bg-[#FFDE59] transition-colors"
                                  >
                                    <ExternalLink className="h-3.5 w-3.5" />
                                  </a>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  {/* Open All Store Tabs CTA */}
                  <div className="pt-3 border-t-2 border-[#12100d]/15 space-y-2">
                    {selectedArtifact.garments.some((g) => g.origin === "shop" || g.sourceUrl) && (
                      <button
                        type="button"
                        onClick={() => handleOpenAllTabs(selectedArtifact)}
                        className="w-full flex items-center justify-center gap-2 rounded-2xl border-[3px] border-[#12100d] bg-[#7FE06E] py-3 text-sm font-black uppercase tracking-wider text-[#12100d] shadow-[4px_4px_0px_#12100d] hover:bg-[#92E883] active:translate-x-[2px] active:translate-y-[2px] transition-all cursor-pointer"
                        style={{ fontFamily: "var(--font-clash), sans-serif" }}
                      >
                        <ShoppingBag className="h-4 w-4" />
                        <span>
                          {tabsOpened
                            ? "✓ OPENED ALL SHOP TABS IN BROWSER!"
                            : "🛒 OPEN ALL WISHLISTED TABS AT ONCE"}
                        </span>
                      </button>
                    )}

                    <div className="flex gap-2">
                      <Link
                        href="/trialroom"
                        className="flex-1 flex items-center justify-center gap-2 rounded-2xl border-2 border-[#12100d] bg-[#FFDE59] py-2.5 text-xs font-bold uppercase tracking-wider text-[#12100d] shadow-[2px_2px_0px_#12100d] hover:bg-[#FFE57F]"
                        style={{ fontFamily: "var(--font-clash), sans-serif" }}
                      >
                        <RotateCcw className="h-3.5 w-3.5" />
                        <span>DRESS IN TRIAL ROOM</span>
                      </Link>

                      <button
                        type="button"
                        onClick={() => setSelectedArtifact(null)}
                        className="rounded-2xl border-2 border-[#12100d] bg-white px-5 py-2.5 text-xs font-bold uppercase tracking-wider text-[#12100d] shadow-[2px_2px_0px_#12100d] hover:bg-[#FAF6EF] cursor-pointer"
                        style={{ fontFamily: "var(--font-clash), sans-serif" }}
                      >
                        CLOSE
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
