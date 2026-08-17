"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ExternalLink,
  Sparkles,
  ShoppingBag,
  ArrowRight,
  Download,
  Share2,
  Check,
  Layers,
  X,
} from "lucide-react";

import type { ArtifactItem, Garment } from "@/lib/types";

interface ArtifactModalProps {
  artifact: ArtifactItem | null;
  isOpen: boolean;
  onClose: () => void;
  onNavigateToArtifacts?: () => void;
}

export function ArtifactModal({
  artifact,
  isOpen,
  onClose,
  onNavigateToArtifacts,
}: ArtifactModalProps) {
  const [copied, setCopied] = useState(false);
  const [tabsOpened, setTabsOpened] = useState(false);

  if (!artifact) return null;

  const wishlistItems = artifact.garments.filter((g) => g.origin === "shop" || g.sourceUrl);
  const ownedItems = artifact.garments.filter((g) => g.origin !== "shop" && !g.sourceUrl);

  const formattedPrice = new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(artifact.totalPrice);

  const handleOpenAllTabs = () => {
    if (!wishlistItems.length) return;
    wishlistItems.forEach((item) => {
      const url = item.sourceUrl || `https://www.google.com/search?q=${encodeURIComponent(item.name + " buy online")}`;
      window.open(url, "_blank", "noopener,noreferrer");
    });
    setTabsOpened(true);
    setTimeout(() => setTabsOpened(false), 3000);
  };

  const handleShare = () => {
    if (typeof window !== "undefined") {
      navigator.clipboard.writeText(window.location.origin + "/artifacts");
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-[#12100d]/75 backdrop-blur-md"
          />

          {/* Neobrutalist Modal Box */}
          <motion.div
            initial={{ scale: 0.85, opacity: 0, rotate: -2, y: 30 }}
            animate={{ scale: 1, opacity: 1, rotate: 0, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
            transition={{ type: "spring", stiffness: 300, damping: 24 }}
            className="relative z-10 w-full max-w-2xl overflow-hidden rounded-3xl border-[4px] border-[#12100d] bg-[#F4EFE6] shadow-[10px_10px_0px_#12100d]"
          >
            {/* Header Banner */}
            <div className="flex items-center justify-between border-b-[3px] border-[#12100d] bg-[#FFDE59] px-5 py-3">
              <div className="flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg border-2 border-[#12100d] bg-[#7FE06E] shadow-[1.5px_1.5px_0px_#12100d]">
                  <Sparkles className="h-4 w-4 text-[#12100d]" />
                </span>
                <span className="font-friday text-lg uppercase tracking-wider text-[#12100d]">
                  ARTIFACT MINTED!
                </span>
                <span className="rounded-full border border-[#12100d] bg-white px-2 py-0.5 font-mono text-[0.65rem] font-black text-[#12100d]">
                  {artifact.avatarLabel || "Active Avatar"}
                </span>
              </div>

              <button
                type="button"
                onClick={onClose}
                aria-label="Close modal"
                className="flex h-8 w-8 items-center justify-center rounded-xl border-2 border-[#12100d] bg-white text-[#12100d] shadow-[2px_2px_0px_#12100d] hover:bg-[#FF5A5F] hover:text-white transition-colors cursor-pointer"
              >
                <X className="h-4 w-4 stroke-[3]" />
              </button>
            </div>

            {/* Modal Body: Split View (Avatar Photo Left / Details Right) */}
            <div className="p-5 sm:p-6 grid grid-cols-1 md:grid-cols-[13rem_1fr] gap-6">
              {/* Left Column: Avatar Polaroid Card */}
              <div className="flex flex-col items-center">
                <div className="relative w-full aspect-[3/4] rounded-2xl border-[3px] border-[#12100d] bg-white p-2 shadow-[4px_4px_0px_#12100d] overflow-hidden group">
                  <div className="relative h-full w-full overflow-hidden rounded-xl bg-[#FAF6EF]">
                    <Image
                      src={artifact.renderUrl}
                      alt={artifact.name}
                      fill
                      className="object-contain"
                      sizes="(max-width: 768px) 100vw, 240px"
                    />
                  </div>

                  {/* Stamp Badge */}
                  <div className="absolute bottom-3 right-3 rotate-[-6deg] rounded-lg border-2 border-[#12100d] bg-[#7FE06E] px-2 py-0.5 font-friday text-[0.65rem] uppercase tracking-wider text-[#12100d] shadow-[2px_2px_0px_#12100d]">
                    VERIFIED FIT ✓
                  </div>
                </div>

                <div className="mt-3 flex w-full gap-2">
                  <a
                    href={artifact.renderUrl}
                    download={`rangrez-${artifact.name.toLowerCase().replace(/\s+/g, "-")}.png`}
                    target="_blank"
                    rel="noreferrer"
                    className="flex-1 flex items-center justify-center gap-1.5 rounded-xl border-2 border-[#12100d] bg-white py-1.5 font-mono text-[0.68rem] font-bold text-[#12100d] shadow-[2px_2px_0px_#12100d] hover:bg-[#FFDE59] transition-colors"
                  >
                    <Download className="h-3.5 w-3.5" />
                    <span>SAVE</span>
                  </a>
                  <button
                    type="button"
                    onClick={handleShare}
                    className="flex items-center justify-center gap-1.5 rounded-xl border-2 border-[#12100d] bg-white px-3 py-1.5 font-mono text-[0.68rem] font-bold text-[#12100d] shadow-[2px_2px_0px_#12100d] hover:bg-[#FFDE59] transition-colors cursor-pointer"
                  >
                    {copied ? <Check className="h-3.5 w-3.5" /> : <Share2 className="h-3.5 w-3.5" />}
                  </button>
                </div>
              </div>

              {/* Right Column: Garments & Prices Breakdown */}
              <div className="flex flex-col justify-between">
                <div className="space-y-3">
                  <div>
                    <h3 className="font-friday text-xl uppercase tracking-wide text-[#12100d]">
                      {artifact.name}
                    </h3>
                    <p className="font-mono text-xs text-[#12100d]/70">
                      Outfit composed of {artifact.garments.length} layer{artifact.garments.length === 1 ? "" : "s"}.
                    </p>
                  </div>

                  {/* Summary Metric Badge */}
                  <div className="flex items-center justify-between rounded-xl border-2 border-[#12100d] bg-white p-3 shadow-[3px_3px_0px_#12100d]">
                    <div>
                      <span className="font-mono text-[0.65rem] font-bold uppercase text-[#12100d]/60">
                        Total Outfit Valuation
                      </span>
                      <p className="font-friday text-lg text-[#12100d]">
                        {formattedPrice}
                      </p>
                    </div>
                    {wishlistItems.length > 0 && (
                      <span className="rounded-lg border border-[#12100d] bg-[#C0AEDE] px-2.5 py-1 font-mono text-[0.68rem] font-black text-[#12100d]">
                        {wishlistItems.length} SHOP {wishlistItems.length === 1 ? "PIECE" : "PIECES"}
                      </span>
                    )}
                  </div>

                  {/* Piece Strip */}
                  <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                    <span className="font-mono text-[0.65rem] font-black uppercase text-[#12100d]/60">
                      Equipped Garments:
                    </span>
                    {artifact.garments.map((g) => {
                      const isWishlist = g.origin === "shop" || Boolean(g.sourceUrl);
                      const estimatedPrice = isWishlist ? "₹2,490" : "OWNED";

                      return (
                        <div
                          key={g.id}
                          className="flex items-center justify-between rounded-xl border border-[#12100d] bg-[#FAF6EF] p-2"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className="relative h-9 w-9 rounded-lg border border-[#12100d] bg-white overflow-hidden shrink-0">
                              <Image
                                src={g.imageUrl}
                                alt={g.name}
                                fill
                                className="object-cover"
                              />
                            </div>
                            <div className="min-w-0">
                              <p className="truncate font-mono text-[0.72rem] font-bold text-[#12100d]">
                                {g.name}
                              </p>
                              <span className="font-mono text-[0.6rem] font-semibold text-[#12100d]/60 uppercase">
                                {g.zone} · {g.dye.name}
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            {isWishlist ? (
                              <span className="rounded border border-[#12100d] bg-[#FFDE59] px-1.5 py-0.5 font-mono text-[0.62rem] font-black text-[#12100d]">
                                {estimatedPrice}
                              </span>
                            ) : (
                              <span className="rounded border border-[#12100d] bg-[#7FE06E] px-1.5 py-0.5 font-mono text-[0.62rem] font-black text-[#12100d]">
                                IN CLOSET
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Bottom Action CTAs */}
                <div className="mt-5 space-y-2 pt-2 border-t-2 border-[#12100d]/15">
                  {wishlistItems.length > 0 && (
                    <button
                      type="button"
                      onClick={handleOpenAllTabs}
                      className="w-full flex items-center justify-center gap-2 rounded-2xl border-[3px] border-[#12100d] bg-[#7FE06E] py-2.5 font-friday text-sm uppercase tracking-wider text-[#12100d] shadow-[3px_3px_0px_#12100d] hover:bg-[#92E883] active:translate-x-[1px] active:translate-y-[1px] transition-all cursor-pointer"
                    >
                      <ShoppingBag className="h-4 w-4" />
                      <span>
                        {tabsOpened
                          ? "✓ OPENED IN NEW TABS!"
                          : `OPEN ALL ${wishlistItems.length} SHOP TABS AT ONCE`}
                      </span>
                    </button>
                  )}

                  <div className="flex gap-2">
                    <Link
                      href="/artifacts"
                      onClick={onClose}
                      className="flex-1 flex items-center justify-center gap-2 rounded-2xl border-[3px] border-[#12100d] bg-[#FFDE59] py-2.5 font-friday text-xs uppercase tracking-wider text-[#12100d] shadow-[3px_3px_0px_#12100d] hover:bg-[#FFE57F] active:translate-x-[1px] active:translate-y-[1px] transition-all"
                    >
                      <Layers className="h-4 w-4" />
                      <span>GO TO ARTIFACTS GALLERY →</span>
                    </Link>

                    <button
                      type="button"
                      onClick={onClose}
                      className="rounded-2xl border-2 border-[#12100d] bg-white px-4 py-2.5 font-friday text-xs uppercase tracking-wider text-[#12100d] shadow-[2px_2px_0px_#12100d] hover:bg-[#FAF6EF] cursor-pointer"
                    >
                      CONTINUE DRESSING
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
