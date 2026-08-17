"use client";

import { motion, useMotionValue, useTransform, animate } from "framer-motion";
import { ArrowRight, Check, Loader2, Sparkles, ChevronsRight } from "lucide-react";
import { useEffect, useRef, useState } from "react";

interface SwipeButtonProps {
  onSwipeComplete: () => void;
  disabled?: boolean;
  loading?: boolean;
  stepText?: string;
  pieceCount?: number;
}

export function SwipeButton({
  onSwipeComplete,
  disabled = false,
  loading = false,
  stepText,
  pieceCount = 0,
}: SwipeButtonProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dragWidth, setDragWidth] = useState(240);
  const [completed, setCompleted] = useState(false);
  const x = useMotionValue(0);

  // Measure container width
  useEffect(() => {
    if (containerRef.current) {
      const handleWidth = 68;
      const totalWidth = containerRef.current.offsetWidth;
      setDragWidth(Math.max(100, totalWidth - handleWidth - 10));
    }
  }, []);

  // Update width on resize
  useEffect(() => {
    const onResize = () => {
      if (containerRef.current) {
        const handleWidth = 68;
        const totalWidth = containerRef.current.offsetWidth;
        setDragWidth(Math.max(100, totalWidth - handleWidth - 10));
      }
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // Reset completion state when loading finishes
  useEffect(() => {
    if (!loading) {
      setCompleted(false);
      animate(x, 0, { type: "spring", stiffness: 350, damping: 25 });
    }
  }, [loading, x]);

  // Progress fill based on drag position
  const progressWidth = useTransform(x, [0, dragWidth], [0, dragWidth + 68]);
  const textOpacity = useTransform(x, [0, dragWidth * 0.75], [1, 0.05]);

  // ONLY triggers when the handle reaches the absolute end of the slider!
  const handleDragEnd = () => {
    if (disabled || loading) return;
    const currentX = x.get();

    // Requires reaching at least 93% of the track (the very end)
    if (currentX >= dragWidth * 0.93) {
      setCompleted(true);
      animate(x, dragWidth, { type: "spring", stiffness: 400, damping: 28 });
      onSwipeComplete();
    } else {
      // Snaps completely back to beginning
      setCompleted(false);
      animate(x, 0, { type: "spring", stiffness: 350, damping: 22 });
    }
  };

  return (
    <div className="relative w-full select-none">
      {/* Outer Neobrutalist Slider Container */}
      <div
        ref={containerRef}
        className={`relative flex h-16 w-full items-center overflow-hidden rounded-2xl border-[3.5px] border-[#12100d] p-1.5 shadow-[5px_5px_0px_#12100d] transition-all ${
          disabled
            ? "cursor-not-allowed bg-[#E8E2D5] opacity-60"
            : loading
              ? "cursor-wait bg-[#FFDE59]"
              : "bg-[#F4EFE6]"
        }`}
      >
        {/* Dynamic Progress Fill with bold border */}
        {!disabled && !loading && (
          <motion.div
            className="absolute inset-y-0 left-0 bg-[#7FE06E] border-r-[3px] border-[#12100d]"
            style={{ width: progressWidth }}
          />
        )}

        {/* Animated Striped Pattern while loading */}
        {loading && (
          <div
            className="absolute inset-0 opacity-30"
            style={{
              backgroundImage:
                "repeating-linear-gradient(45deg, #12100d 0, #12100d 14px, transparent 14px, transparent 28px)",
              backgroundSize: "200% 200%",
              animation: "marquee 1s linear infinite",
            }}
          />
        )}

        {/* Center Prompt Text */}
        <motion.div
          style={{ opacity: textOpacity }}
          className="pointer-events-none absolute inset-0 flex items-center justify-center gap-2 pl-14 pr-4 text-center"
        >
          {loading ? (
            <div className="flex items-center gap-2 font-friday text-sm uppercase tracking-wider text-[#12100d]">
              <Loader2 className="h-4 w-4 animate-spin text-[#12100d]" />
              <span>{stepText || "Scanning Avatar & Composing..."}</span>
            </div>
          ) : disabled ? (
            <span className="font-mono text-xs font-black uppercase tracking-wider text-[#12100d]/50">
              {pieceCount === 0
                ? "Select Garments to Equip"
                : "Avatar Framing Limited"}
            </span>
          ) : (
            <div className="flex items-center gap-2">
              <span className="font-friday text-sm uppercase tracking-wider text-[#12100d]">
                SLIDE TO END TO DRESS
              </span>
              <ChevronsRight className="h-4 w-4 text-[#12100d]/70 animate-pulse" />
              <span className="rounded-md border border-[#12100d] bg-[#FFDE59] px-1.5 py-0.2 font-mono text-[0.65rem] font-black text-[#12100d]">
                {pieceCount} {pieceCount === 1 ? "PIECE" : "PIECES"}
              </span>
            </div>
          )}
        </motion.div>

        {/* Draggable Neobrutalist Slider Thumb */}
        {!disabled && !loading && (
          <motion.div
            drag="x"
            dragConstraints={{ left: 0, right: dragWidth }}
            dragElastic={0.05}
            dragMomentum={false}
            onDragEnd={handleDragEnd}
            style={{ x }}
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            className="relative z-10 flex h-12 w-16 items-center justify-center rounded-xl border-[3px] border-[#12100d] bg-[#FFDE59] shadow-[3px_3px_0px_#12100d] cursor-grab active:cursor-grabbing hover:bg-[#FFE57F] transition-colors"
          >
            {completed ? (
              <Check className="h-6 w-6 stroke-[3.5] text-[#12100d]" />
            ) : (
              <div className="flex items-center">
                <ArrowRight className="h-6 w-6 stroke-[3.5] text-[#12100d]" />
              </div>
            )}
          </motion.div>
        )}

        {/* Loading Spinner in handle spot */}
        {loading && (
          <div className="relative z-10 flex h-12 w-16 items-center justify-center rounded-xl border-[3px] border-[#12100d] bg-[#7FE06E] shadow-[3px_3px_0px_#12100d]">
            <Sparkles className="h-6 w-6 animate-spin text-[#12100d]" />
          </div>
        )}
      </div>

      {/* Helper Subtext */}
      <div className="mt-1.5 flex items-center justify-between px-1 font-mono text-[0.65rem] uppercase font-black text-[#12100d]/70">
        <span>◀ Drag handle completely across</span>
        <span>Must reach 100% to trigger ▶</span>
      </div>
    </div>
  );
}
