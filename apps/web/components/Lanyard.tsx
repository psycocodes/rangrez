"use client";

import React, { useEffect, useRef, useState } from "react";
import Image from "next/image";

interface LanyardProps {
  className?: string;
  position?: "top-right" | "top-left" | "relative";
}

export function Lanyard({ className = "", position = "top-right" }: LanyardProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  // Physics state
  const physicsRef = useRef({
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    angle: 0,
    vAngle: 0,
    restY: 150,
    dragStartX: 0,
    dragStartY: 0,
    cardStartX: 0,
    cardStartY: 0,
  });

  const cardRef = useRef<HTMLDivElement>(null);
  const svgPathRef = useRef<SVGPathElement>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const physics = physicsRef.current;
    physics.y = physics.restY;

    let animId: number;
    let lastTime = performance.now();

    const updatePhysics = (now: number) => {
      const dt = Math.min((now - lastTime) / 1000, 0.033);
      lastTime = now;

      const p = physicsRef.current;

      if (!isDragging) {
        // Natural ambient subtle sway
        const time = now * 0.0012;
        const ambientX = Math.sin(time) * 8 + Math.sin(time * 2.1) * 3;
        const ambientY = p.restY + Math.cos(time * 1.4) * 4;

        // Spring toward rest position
        const k = 36; // Spring stiffness
        const d = 0.89; // Damping

        const fx = -k * (p.x - ambientX);
        const fy = -k * (p.y - ambientY);

        p.vx = (p.vx + fx * dt) * d;
        p.vy = (p.vy + fy * dt) * d;

        p.x += p.vx * dt * 60;
        p.y += p.vy * dt * 60;

        // Angular physics
        const targetAngle = (p.x / p.restY) * 0.4;
        const fAngle = -28 * (p.angle - targetAngle);
        p.vAngle = (p.vAngle + fAngle * dt) * 0.86;
        p.angle += p.vAngle * dt * 60;
      }

      // Update Card DOM
      if (cardRef.current) {
        const tiltX = Math.max(-20, Math.min(20, -p.vy * 0.06));
        const tiltY = Math.max(-20, Math.min(20, p.vx * 0.06));
        const deg = (p.angle * 180) / Math.PI;

        cardRef.current.style.transform = `translate3d(${p.x}px, ${p.y}px, 0) rotate(${deg}deg) rotateX(${tiltX}deg) rotateY(${tiltY}deg)`;
      }

      // Update SVG Lanyard Cord
      if (svgPathRef.current) {
        const anchorX = 0;
        const anchorY = 0;
        const cardTopX = p.x;
        const cardTopY = p.y;

        const ctrlX1 = anchorX + p.x * 0.2;
        const ctrlY1 = anchorY + (cardTopY - anchorY) * 0.45;
        const ctrlX2 = cardTopX - Math.sin(p.angle) * 25;
        const ctrlY2 = cardTopY - Math.cos(p.angle) * 25;

        const d = `M ${anchorX} ${anchorY} C ${ctrlX1} ${ctrlY1}, ${ctrlX2} ${ctrlY2}, ${cardTopX} ${cardTopY}`;
        svgPathRef.current.setAttribute("d", d);
      }

      animId = requestAnimationFrame(updatePhysics);
    };

    animId = requestAnimationFrame(updatePhysics);
    return () => cancelAnimationFrame(animId);
  }, [isDragging]);

  const handlePointerDown = (e: React.PointerEvent) => {
    e.preventDefault();
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    setIsDragging(true);
    const p = physicsRef.current;
    p.dragStartX = e.clientX;
    p.dragStartY = e.clientY;
    p.cardStartX = p.x;
    p.cardStartY = p.y;
    p.vx = 0;
    p.vy = 0;
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging) return;
    const p = physicsRef.current;
    const dx = e.clientX - p.dragStartX;
    const dy = e.clientY - p.dragStartY;

    const newX = p.cardStartX + dx;
    const newY = Math.max(60, Math.min(260, p.cardStartY + dy));

    p.vx = (newX - p.x) * 12;
    p.vy = (newY - p.y) * 12;
    p.x = newX;
    p.y = newY;
    p.angle = (p.x / p.restY) * 0.5;
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    (e.target as HTMLElement).releasePointerCapture?.(e.pointerId);
    setIsDragging(false);
  };

  if (!mounted) return null;

  return (
    <div
      ref={containerRef}
      className={`pointer-events-none z-30 select-none ${
        position === "top-right"
          ? "absolute top-0 right-6 sm:right-12 md:right-16"
          : position === "top-left"
            ? "absolute top-0 left-6 sm:left-12"
            : "relative"
      } ${className}`}
      style={{ width: "1px", height: "1px" }}
    >
      {/* Anchor Point */}
      <div className="absolute -top-1 -left-2.5 h-2.5 w-5 rounded-b bg-[#1A1714] shadow-xs" />

      {/* Dynamic Lanyard Ribbon / Cord */}
      <svg
        className="pointer-events-none absolute -top-1 left-0 overflow-visible"
        style={{ width: "300px", height: "300px", transform: "translate(-150px, 0)" }}
      >
        <defs>
          <linearGradient id="strapGrad" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#1E293B" />
            <stop offset="30%" stopColor="#334155" />
            <stop offset="50%" stopColor="#64748B" />
            <stop offset="70%" stopColor="#334155" />
            <stop offset="100%" stopColor="#0F172A" />
          </linearGradient>
          <filter id="cordShadow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="1" dy="3" stdDeviation="2" floodColor="#000000" floodOpacity="0.2" />
          </filter>
        </defs>
        <g transform="translate(150, 0)">
          {/* Shadow line */}
          <path
            ref={svgPathRef}
            fill="none"
            stroke="url(#strapGrad)"
            strokeWidth="7"
            strokeLinecap="round"
            filter="url(#cordShadow)"
          />
          {/* Inner stitch highlight */}
          <path
            d={svgPathRef.current?.getAttribute("d") || ""}
            fill="none"
            stroke="#94A3B8"
            strokeWidth="1"
            strokeDasharray="3 2.5"
            strokeLinecap="round"
            opacity="0.7"
          />
        </g>
      </svg>

      {/* ID Badge Card */}
      <div
        ref={cardRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        className="pointer-events-auto absolute -top-2 -left-14 flex w-28 cursor-grab flex-col items-center active:cursor-grabbing sm:w-32 sm:-left-16"
        style={{
          transformOrigin: "top center",
          perspective: "600px",
          touchAction: "none",
        }}
      >
        {/* Metal Carabiner Clip */}
        <div className="relative z-10 flex flex-col items-center">
          <div className="h-3 w-3 rounded-t-full border border-[#475569] bg-[#94A3B8]" />
          <div className="h-1.5 w-5 rounded-xs border border-black/60 bg-[#CBD5E1] shadow-xs" />
        </div>

        {/* The Card Body */}
        <div className="relative mt-[-2px] w-full overflow-hidden rounded-lg border-[1.5px] border-[#14120E] bg-[#FAFAF8] p-2 text-[#14120E] shadow-[3px_4px_0px_#14120E] transition-shadow duration-200 hover:shadow-[4px_6px_0px_#14120E]">
          {/* Clip Hole Punch */}
          <div className="mx-auto mb-1.5 h-1 w-5 rounded-full bg-[#14120E]/20" />

          {/* Hologram Shimmer */}
          <div
            className="absolute -top-4 -right-4 h-12 w-12 rotate-45 opacity-30 mix-blend-color-dodge pointer-events-none"
            style={{
              background:
                "linear-gradient(135deg, rgba(255,0,128,0.5), rgba(0,255,255,0.5), rgba(255,255,0,0.5))",
            }}
          />

          {/* Card Header */}
          <div className="flex items-center justify-between border-b border-black/15 pb-1">
            <div className="flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span
                className="text-[7.5px] font-bold tracking-wider text-[#0C535E]"
                style={{ fontFamily: "var(--font-clash), sans-serif" }}
              >
                RANGREZ
              </span>
            </div>
            <span
              className="rounded bg-[#14120E] px-1 py-0.2 text-[6px] font-bold text-white"
              style={{ fontFamily: "var(--font-clash), sans-serif" }}
            >
              PASS
            </span>
          </div>

          {/* Avatar / Stylist Icon */}
          <div className="my-1.5 flex flex-col items-center justify-center rounded-md bg-[#EFE9DF] p-1.5 border border-black/10">
            <div className="relative h-8 w-8 overflow-hidden rounded-full border border-black/20 bg-white">
              <Image
                src="/assets/logos/rangrez-logo.png"
                alt="Rangrez"
                fill
                className="object-contain p-0.5"
                onError={(e) => {
                  (e.target as HTMLElement).style.display = "none";
                }}
              />
            </div>
            <p
              className="mt-0.5 text-[9px] font-bold text-[#14120E]"
              style={{ fontFamily: "var(--font-clash), sans-serif" }}
            >
              Stylist ID
            </p>
            <p
              className="text-[6.5px] text-[#6D6555]"
              style={{ fontFamily: "var(--font-instrument-sans), sans-serif" }}
            >
              #RGZ-2026-01
            </p>
          </div>

          {/* Barcode */}
          <div className="space-y-0.5">
            <div className="flex h-3 w-full items-center justify-between overflow-hidden opacity-75">
              {[2, 1, 3, 1, 2, 1, 3, 2, 1, 2, 1, 3, 1, 2].map((w, i) => (
                <div
                  key={i}
                  className="h-full bg-[#14120E]"
                  style={{ width: `${w}px` }}
                />
              ))}
            </div>
            <p
              className="text-center text-[5px] tracking-widest text-[#6D6555] uppercase"
              style={{ fontFamily: "var(--font-clash), sans-serif" }}
            >
              DYER OF CLOTH
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
