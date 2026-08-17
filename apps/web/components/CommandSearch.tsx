"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

import type { Garment } from "@/lib/types";
import { ORIGIN_LABEL } from "@/lib/types";

export function CommandSearch({
  isOpen,
  onClose,
  garments,
  onSelect,
}: {
  isOpen: boolean;
  onClose: () => void;
  garments: Garment[];
  onSelect: (garment: Garment) => void;
}) {
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  // Keydown listener for Ctrl+K/Cmd+K and Esc
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
    } else {
      setQuery("");
    }
  }, [isOpen]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return garments.slice(0, 5); // Default list when empty

    return garments.filter((g) =>
      [g.name, g.dye.name, g.material, g.zone, g.sizeLabel, ORIGIN_LABEL[g.origin]]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(q),
    );
  }, [garments, query]);

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <motion.div
            className="absolute inset-0 bg-[#12100d]/75 backdrop-blur-md"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />

          {/* Modal Container */}
          <motion.div
            role="dialog"
            aria-label="Search Garments"
            className="relative w-full max-w-lg border-[3px] border-[#12100d] bg-[#F4EFE6] p-5 shadow-[8px_8px_0px_#12100d] rounded-3xl flex flex-col max-h-[75vh] z-50 overflow-hidden"
            initial={{ scale: 0.95, y: 15, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.95, y: 15, opacity: 0 }}
            transition={{ type: "spring", stiffness: 350, damping: 25 }}
          >
            {/* Search Input Area */}
            <div className="relative flex items-center mb-4">
              <span className="absolute left-4 text-[#12100d]/50 pointer-events-none select-none">
                <svg
                  className="h-5 w-5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  viewBox="0 0 24 24"
                >
                  <circle cx="11" cy="11" r="8" />
                  <path d="M21 21l-4.35-4.35" />
                </svg>
              </span>
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="SEARCH PIECES, DYES, MATERIALS..."
                className="w-full pl-11 pr-16 py-3 border-2 border-[#12100d] rounded-2xl bg-white font-mono text-xs font-black uppercase text-[#12100d] outline-none shadow-[2px_2px_0px_#12100d] transition-all placeholder:text-[#12100d]/35 focus:shadow-[4px_4px_0px_#12100d]"
              />
              <span className="absolute right-4 font-mono text-[0.62rem] font-bold border border-[#12100d]/20 bg-[#F4EFE6] px-1.5 py-0.5 rounded text-[#12100d]/60 select-none pointer-events-none">
                ESC
              </span>
            </div>

            {/* Results Title */}
            <div className="flex justify-between items-center px-1 mb-2 font-mono text-[0.68rem] font-black text-[#12100d]/55 uppercase">
              <span>{query ? "SEARCH RESULTS" : "RECENTLY ADDED"}</span>
              <span>{filtered.length} FOUND</span>
            </div>

            {/* Scrollable Results List */}
            <div className="flex-1 overflow-y-auto pr-1 space-y-2.5 max-h-[48vh] custom-scrollbar">
              {filtered.length === 0 ? (
                <div className="py-8 text-center">
                  <p className="font-friday text-sm uppercase text-[#12100d]/50">
                    No matching pieces found.
                  </p>
                  <p className="font-mono text-[0.65rem] text-[#12100d]/40 mt-1">
                    Try searching by zones, dyes, or fabrics.
                  </p>
                </div>
              ) : (
                filtered.map((g) => (
                  <button
                    key={g.id}
                    type="button"
                    onClick={() => {
                      onSelect(g);
                      onClose();
                    }}
                    className="w-full flex items-center justify-between gap-3.5 border-2 border-[#12100d] bg-white p-3 rounded-2xl shadow-[3px_3px_0px_#12100d] hover:shadow-[4px_4px_0px_#12100d] hover:bg-[#FFDE59] transition-all cursor-pointer text-left group"
                  >
                    {/* Thumbnail */}
                    <div className="relative h-14 w-12 shrink-0 overflow-hidden rounded-xl border border-[#12100d]/15 bg-[#FAF6EF] group-hover:border-[#12100d]">
                      <Image
                        src={g.imageUrl}
                        alt={g.name}
                        fill
                        className="object-contain p-1"
                      />
                    </div>

                    {/* Details */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span
                          className="h-2 w-2 rounded-full border border-[#12100d]/20"
                          style={{ backgroundColor: g.dye.hex }}
                        />
                        <h4 className="font-friday text-sm uppercase tracking-wide truncate text-[#12100d]">
                          {g.name}
                        </h4>
                      </div>
                      <p className="font-mono text-[0.65rem] text-[#12100d]/60 mt-0.5 truncate uppercase">
                        {g.material} · {g.zone} · {ORIGIN_LABEL[g.origin]}
                      </p>
                    </div>

                    {/* Up-Right Arrow Icon */}
                    <div className="text-[#12100d] shrink-0 transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform">
                      <svg
                        className="h-6 w-6 stroke-current"
                        fill="none"
                        strokeWidth="2.5"
                        viewBox="0 0 24 24"
                      >
                        <path d="M7 17L17 7M17 7H7M17 7V17" />
                      </svg>
                    </div>
                  </button>
                ))
              )}
            </div>

            {/* Footer tips */}
            <div className="mt-4 pt-3 border-t border-[#12100d]/10 flex items-center justify-between font-mono text-[0.6rem] text-[#12100d]/40 uppercase select-none">
              <span>Press ↑↓ to navigate</span>
              <span>RANGREZ ATELIER SEARCH</span>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
