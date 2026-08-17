"use client";

import React, { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Lanyard } from "@/components/Lanyard";
import { Rangrez, Knot } from "@/components/Wordmark";
import { ArrowRight, Sparkles } from "lucide-react";

export function LandingPage() {
  const [isStyled, setIsStyled] = useState(false);

  const handleStyleClick = () => {
    setIsStyled((prev) => !prev);
  };

  return (
    <div className="relative min-h-screen w-full overflow-x-hidden bg-[#EFEAE1] text-[#14120E]">
      {/* Organic Camouflage / Amoeba Background */}
      <div
        className="pointer-events-none absolute inset-0 z-0 opacity-80"
        style={{
          backgroundImage: "url('/assets/backgrounds/wardrobe-background.png')",
          backgroundRepeat: "repeat",
          backgroundSize: "780px auto",
        }}
      />

      {/* Subtle Interactive Physics Lanyard hanging at top right */}
      <Lanyard position="top-right" />

      {/* ══════════════════════════════════════════════════════════════════════
          HERO SECTION (Replication of Screenshot)
          ══════════════════════════════════════════════════════════════════════ */}
      <section className="relative z-10 mx-auto max-w-6xl px-4 pt-10 pb-12 sm:px-6 sm:pt-14 sm:pb-20 lg:px-8">
        <div className="grid grid-cols-1 items-center gap-10 lg:grid-cols-12 lg:gap-8">
          
          {/* LEFT SIDE: "SEE IT IN ACTION" + Pink Shirt Card + Connector + Avatar 01 Card */}
          <div className="flex flex-col items-center lg:col-span-7 lg:items-start">
            
            {/* "SEE IT IN ACTION" Rotated Header */}
            <div className="mb-3 self-start pl-2 sm:pl-4">
              <span
                className="inline-block -rotate-6 text-base font-bold tracking-tight uppercase text-[#14120E] sm:text-lg"
                style={{
                  fontFamily: "var(--font-clash), sans-serif",
                  fontWeight: 700,
                  letterSpacing: "0.02em",
                }}
              >
                SEE IT IN ACTION
              </span>
            </div>

            {/* Cards Showcase Row with Connector */}
            <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3 md:flex-nowrap">
              
              {/* CARD 1: Pink Shirt (Arched Tombstone Card) */}
              <div className="group relative flex w-[170px] flex-col overflow-hidden rounded-t-[75px] rounded-b-xl border-[2.5px] border-[#14120E] bg-[#E59E9E] shadow-[4px_4px_0px_#14120E] transition-all duration-300 hover:-translate-y-1 hover:shadow-[6px_6px_0px_#14120E] sm:w-[195px]">
                {/* Background Repeating Text Pattern */}
                <div
                  className="pointer-events-none absolute inset-0 select-none overflow-hidden opacity-25"
                  style={{
                    fontFamily: "var(--font-clash), sans-serif",
                    lineHeight: "1.1",
                    fontSize: "19px",
                    fontWeight: 700,
                    color: "#9C4444",
                    wordBreak: "break-all",
                    letterSpacing: "-0.02em",
                  }}
                >
                  PINK SHIRT PINK SHIRT PINK SHIRT PINK SHIRT PINK SHIRT PINK SHIRT PINK SHIRT PINK SHIRT PINK SHIRT PINK SHIRT PINK SHIRT PINK SHIRT PINK SHIRT PINK SHIRT PINK SHIRT
                </div>

                {/* Garment Image */}
                <div className="relative z-10 flex h-[210px] w-full items-center justify-center p-3 sm:h-[235px]">
                  <div className="relative h-full w-full transition-transform duration-300 group-hover:scale-105">
                    <Image
                      src="/seed/Pink Shirt.png"
                      alt="Pink Shirt"
                      fill
                      className="object-contain drop-shadow-[0_8px_12px_rgba(0,0,0,0.15)]"
                      priority
                    />
                  </div>
                </div>

                {/* Bottom Tag Banner */}
                <div className="relative z-10 border-t-[2px] border-[#14120E] bg-[#E59E9E] px-2.5 py-1.5 text-center">
                  <p
                    className="text-[9px] uppercase tracking-wider text-[#14120E]/80"
                    style={{
                      fontFamily: "var(--font-clash), sans-serif",
                      fontWeight: 600,
                    }}
                  >
                    SHIRTS
                  </p>
                  <p
                    className="text-base font-black tracking-tight text-[#14120E] sm:text-lg leading-tight"
                    style={{
                      fontFamily: "var(--font-clash), sans-serif",
                      fontWeight: 900,
                    }}
                  >
                    PINK SHIRT
                  </p>
                </div>
              </div>

              {/* CONNECTOR: Plus Symbol with Connecting Bracket */}
              <div className="flex flex-col items-center justify-center px-1">
                <div className="relative flex h-14 w-9 items-center justify-center sm:h-16 sm:w-11">
                  {/* Bracket Lines */}
                  <div className="absolute inset-y-2 left-0 w-2 border-y-2 border-l-2 border-[#1E3A8A]" />
                  <div className="absolute inset-y-2 right-0 w-2 border-y-2 border-r-2 border-[#1E3A8A]" />
                  {/* Center Plus Box */}
                  <div className="relative z-10 flex h-6 w-6 items-center justify-center rounded-xs border-2 border-[#14120E] bg-white font-mono text-xs font-bold text-[#14120E] shadow-[1px_1px_0px_#14120E]">
                    +
                  </div>
                </div>
              </div>

              {/* CARD 2: Avatar 01 (Model Card) */}
              <div className="group relative flex w-[170px] flex-col overflow-hidden rounded-xs border-[2.5px] border-[#3A352B] bg-[#9CA3AF] shadow-[4px_4px_0px_#14120E] transition-all duration-300 hover:-translate-y-1 hover:shadow-[6px_6px_0px_#14120E] sm:w-[195px]">
                {/* Background Repeating Watermark */}
                <div
                  className="pointer-events-none absolute inset-0 select-none overflow-hidden opacity-20"
                  style={{
                    fontFamily: "var(--font-clash), sans-serif",
                    lineHeight: "1.1",
                    fontSize: "22px",
                    fontWeight: 700,
                    color: "#374151",
                    wordBreak: "break-all",
                  }}
                >
                  MODEL MODEL MODEL MODEL MODEL MODEL MODEL MODEL MODEL MODEL MODEL MODEL MODEL MODEL MODEL
                </div>

                {/* Model Photo */}
                <div className="relative z-10 h-[210px] w-full overflow-hidden bg-[#78716C]/20 sm:h-[235px]">
                  <Image
                    src="/assets/avatar-01.jpg"
                    alt="Avatar 01"
                    fill
                    className={`object-cover object-top transition-all duration-500 ${
                      isStyled ? "brightness-105 contrast-105" : ""
                    }`}
                    priority
                  />
                  
                  {/* Interactive Styled Overlay Badge */}
                  {isStyled && (
                    <div className="absolute inset-x-0 bottom-0 bg-[#E59E9E]/90 py-1 text-center backdrop-blur-xs transition-all animate-in fade-in slide-in-from-bottom-2">
                      <span
                        className="text-[9px] font-bold text-[#14120E]"
                        style={{ fontFamily: "var(--font-clash), sans-serif" }}
                      >
                        ✦ FITTED WITH PINK SHIRT
                      </span>
                    </div>
                  )}
                </div>

                {/* Bottom Bar: "Avatar 01" */}
                <div className="relative z-10 border-t-[2px] border-[#3A352B] bg-[#9CA3AF] px-2.5 py-1 text-left">
                  <p
                    className="text-xs font-bold tracking-tight text-[#14120E] sm:text-sm"
                    style={{ fontFamily: "var(--font-clash), sans-serif" }}
                  >
                    Avatar 01
                  </p>
                </div>
              </div>
            </div>

            {/* "Click to style" Badge */}
            <div className="mt-4 flex items-center gap-2 self-center sm:self-center lg:self-start lg:pl-32">
              <span
                className="text-xs font-semibold text-[#14120E] sm:text-sm"
                style={{ fontFamily: "var(--font-clash), sans-serif" }}
              >
                Click to
              </span>
              <button
                type="button"
                onClick={handleStyleClick}
                className="group inline-flex items-center gap-1.5 rounded-full border-2 border-[#14120E] bg-white px-3.5 py-0.5 text-xs font-bold tracking-wide text-[#14120E] shadow-[2px_2px_0px_#14120E] transition-all hover:-translate-y-0.5 hover:bg-[#F4EFE6] active:translate-y-0.5 active:shadow-[1px_1px_0px_#14120E]"
                style={{ fontFamily: "var(--font-clash), sans-serif" }}
              >
                <span>style</span>
                <Sparkles className="h-3 w-3 text-[#D97706] transition-transform group-hover:rotate-12" />
              </button>
            </div>

          </div>

          {/* RIGHT SIDE: MEET Starburst + Copy + "rangrez" highlight + "-> start styling" Button */}
          <div className="flex flex-col items-center lg:col-span-5 lg:items-start">
            
            {/* MEET + Starburst Badge */}
            <div className="relative mb-1">
              {/* Pink Starburst SVG behind MEET */}
              <div className="pointer-events-none absolute -top-8 -left-8 -z-10 h-28 w-28 sm:-top-10 sm:-left-10 sm:h-36 sm:w-36">
                <svg viewBox="0 0 100 100" className="h-full w-full fill-[#F5CEF7] drop-shadow-xs">
                  <polygon points="50,0 62,35 98,35 68,57 79,91 50,70 21,91 32,57 2,35 38,35" />
                </svg>
              </div>

              {/* Large MEET Typography */}
              <h1
                className="inline-block -rotate-6 text-5xl font-black tracking-tight text-[#14120E] sm:text-6xl md:text-7xl"
                style={{
                  fontFamily: "var(--font-clash), sans-serif",
                  fontWeight: 900,
                }}
              >
                MEET
              </h1>
            </div>

            {/* "the stylist everyone needs" Subtitle */}
            <p
              className="mt-1 text-base font-semibold tracking-tight text-[#14120E] sm:text-lg md:text-xl"
              style={{
                fontFamily: "var(--font-clash), var(--font-instrument-sans), sans-serif",
                fontWeight: 600,
              }}
            >
              the stylist everyone needs
            </p>

            {/* "rangrez" in Navy Blue Cursive Script on Golden Orange Highlight Box */}
            <div className="mt-2.5 inline-block">
              <div className="rounded-xs bg-[#CA761E] px-6 py-1 shadow-[2px_2px_0px_#14120E] sm:px-8 sm:py-1.5">
                <span
                  className="block text-4xl italic text-[#1E3A8A] sm:text-5xl md:text-6xl"
                  style={{
                    fontFamily: "var(--font-instrument), serif",
                    fontWeight: 400,
                    letterSpacing: "-0.01em",
                  }}
                >
                  rangrez
                </span>
              </div>
            </div>

            {/* "-> start styling" Outlined Pill CTA Button */}
            <div className="mt-7">
              <Link
                href="/auth"
                className="group relative inline-flex items-center gap-3 rounded-full border-[2.5px] border-[#14120E] bg-white px-7 py-3 text-xl font-black text-[#14120E] shadow-[4px_4px_0px_#14120E] transition-all hover:-translate-y-1 hover:bg-[#FAF8F5] hover:shadow-[6px_6px_0px_#14120E] active:translate-y-0.5 active:shadow-[2px_2px_0px_#14120E] sm:px-9 sm:py-3.5 sm:text-2xl"
                style={{
                  fontFamily: "var(--font-clash), sans-serif",
                  fontWeight: 800,
                }}
              >
                <span
                  className="text-2xl transition-transform duration-200 group-hover:translate-x-1 sm:text-3xl"
                  style={{
                    color: "transparent",
                    WebkitTextStroke: "1.5px #14120E",
                  }}
                >
                  &rarr;
                </span>
                <span
                  className="tracking-tight"
                  style={{
                    color: "transparent",
                    WebkitTextStroke: "1.6px #14120E",
                    letterSpacing: "-0.01em",
                  }}
                >
                  start styling
                </span>
              </Link>
            </div>

          </div>

        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════════════
          ANIMATED TAPES SECTION (Marquee Tapes Across Screen)
          ══════════════════════════════════════════════════════════════════════ */}
      <section className="relative w-full overflow-hidden py-10 sm:py-14">
        {/* Tape 1: White Marquee Tape (Sliding Left, Angled Down) */}
        <div className="relative -mx-8 w-[120%] -rotate-2.5 bg-white py-2.5 shadow-md border-y-[2.5px] border-[#14120E] sm:py-3">
          <div className="flex w-max marquee-track whitespace-nowrap">
            {[...Array(6)].map((_, i) => (
              <span
                key={i}
                className="mx-4 text-xl font-black italic tracking-wider text-[#14120E] sm:text-2xl md:text-3xl"
                style={{
                  fontFamily: "var(--font-clash), sans-serif",
                  fontWeight: 800,
                }}
              >
                NEVER STOP STYLING NEVER STOP STYLING NEVER STOP STYLING NEVER STOP STYLING&nbsp;&nbsp;&nbsp;&nbsp;
              </span>
            ))}
          </div>
        </div>

        {/* Tape 2: Kraft / Tan Marquee Tape (Sliding Right, Angled Up) */}
        <div className="relative -mx-8 -mt-6 w-[120%] rotate-2 bg-[#CCA77D] py-2.5 shadow-sm border-y-[2px] border-[#14120E]/40 sm:-mt-7 sm:py-3">
          <div className="flex w-max marquee-track-reverse whitespace-nowrap">
            {[...Array(6)].map((_, i) => (
              <span
                key={i}
                className="mx-4 text-xl font-black tracking-wider text-[#475C73] sm:text-2xl md:text-3xl"
                style={{
                  fontFamily: "var(--font-clash), sans-serif",
                  fontWeight: 800,
                }}
              >
                RANGREZ NEVER STOP RANGREZ NEVER STOP RANGREZ NEVER STOP RANGREZ NEVER STOP&nbsp;&nbsp;&nbsp;&nbsp;
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════════════
          MEET THE TEAM SECTION (Replication of Screenshot)
          ══════════════════════════════════════════════════════════════════════ */}
      <section className="relative z-10 mx-auto max-w-5xl px-4 pt-6 pb-20 sm:px-6 sm:pb-28">
        
        {/* Centered "MEET THE TEAM" Header with Green Crescent + Purple Highlight */}
        <div className="flex flex-col items-center justify-center text-center">
          
          <div className="relative flex flex-col items-center">
            {/* Green Crescent SVG behind MEET */}
            <div className="pointer-events-none absolute -top-5 -left-8 -z-10 h-20 w-20 sm:-top-6 sm:-left-9 sm:h-22 sm:w-22">
              <svg viewBox="0 0 100 100" className="h-full w-full fill-[#A3E635]">
                <circle cx="50" cy="50" r="46" />
                <circle cx="34" cy="42" r="38" fill="#EFEAE1" />
              </svg>
            </div>

            {/* "MEET" Typography */}
            <h2
              className="text-3xl font-black tracking-tight text-[#14120E] sm:text-4xl md:text-5xl"
              style={{
                fontFamily: "var(--font-clash), sans-serif",
                fontWeight: 900,
              }}
            >
              MEET
            </h2>

            {/* "THE TEAM" in Purple Highlight Bar */}
            <div className="mt-1 inline-block rounded-xs bg-[#D8B4FE] px-6 py-1 shadow-[2px_2px_0px_#14120E] sm:px-8 sm:py-1.5">
              <span
                className="text-2xl font-black uppercase tracking-tight text-[#14120E] sm:text-3xl md:text-4xl"
                style={{
                  fontFamily: "var(--font-clash), sans-serif",
                  fontWeight: 800,
                  letterSpacing: "0.02em",
                }}
              >
                THE TEAM
              </span>
            </div>
          </div>

          {/* Subtitle: "rangrez wasnt build in a day" */}
          <p
            className="mt-2.5 text-sm font-bold tracking-tight text-[#D97706] sm:text-base md:text-lg"
            style={{
              fontFamily: "var(--font-clash), sans-serif",
              fontWeight: 600,
            }}
          >
            rangrez wasnt build in a day
          </p>
        </div>

        {/* Team Cards Grid: Gantavya Rohilla & Mohikshit Ghorai */}
        <div className="mt-10 flex flex-wrap items-center justify-center gap-8 sm:gap-14 md:gap-20">
          
          {/* TEAM CARD 1: Gantavya Rohilla (Solid Purple Card, Tilted Left) */}
          <div className="group relative flex w-[210px] flex-col overflow-hidden rounded-3xl border-[2.5px] border-[#14120E] bg-[#7C6EF6] p-3 shadow-[5px_6px_0px_#14120E] transition-all duration-300 -rotate-4 hover:rotate-0 hover:-translate-y-2 hover:shadow-[7px_9px_0px_#14120E] sm:w-[235px] sm:p-3.5">
            {/* Cutout Photo on Solid Purple Background */}
            <div className="relative h-[215px] w-full overflow-hidden sm:h-[245px]">
              <Image
                src="/assets/gantavya-rohilla=idcard.png"
                alt="Gantavya Rohilla"
                fill
                className="object-contain object-bottom transition-transform duration-300 group-hover:scale-105"
                priority
              />
            </div>

            {/* Bottom Info */}
            <div className="pt-2 pb-1 text-left">
              <h3
                className="text-sm font-black uppercase tracking-normal text-[#14120E] sm:text-base leading-tight"
                style={{
                  fontFamily: "var(--font-clash), sans-serif",
                  fontWeight: 900,
                }}
              >
                GANTAVYA&nbsp;&nbsp;ROHILLA
              </h3>
              <p
                className="text-[10px] font-bold uppercase tracking-wider text-[#1E3A8A] sm:text-xs"
                style={{
                  fontFamily: "var(--font-clash), sans-serif",
                  fontWeight: 700,
                }}
              >
                DEVELOPER
              </p>
            </div>
          </div>

          {/* TEAM CARD 2: Mohikshit Ghorai (Solid Golden/Orange Card, Tilted Right) */}
          <div className="group relative flex w-[210px] flex-col overflow-hidden rounded-3xl border-[2.5px] border-[#14120E] bg-[#F59E0B] p-3 shadow-[5px_6px_0px_#14120E] transition-all duration-300 rotate-4 hover:rotate-0 hover:-translate-y-2 hover:shadow-[7px_9px_0px_#14120E] sm:w-[235px] sm:p-3.5">
            {/* Cutout Photo on Solid Golden Background */}
            <div className="relative h-[215px] w-full overflow-hidden sm:h-[245px]">
              <Image
                src="/assets/mohikshit-ghorai-idcard.png"
                alt="Mohikshit Ghorai"
                fill
                className="object-contain object-bottom transition-transform duration-300 group-hover:scale-105"
                priority
              />
            </div>

            {/* Bottom Info */}
            <div className="pt-2 pb-1 text-left">
              <h3
                className="text-sm font-black uppercase tracking-normal text-[#14120E] sm:text-base leading-tight"
                style={{
                  fontFamily: "var(--font-clash), sans-serif",
                  fontWeight: 900,
                }}
              >
                MOHIKSHIT&nbsp;&nbsp;GHORAI
              </h3>
              <p
                className="text-[10px] font-bold uppercase tracking-wider text-[#1E3A8A] sm:text-xs"
                style={{
                  fontFamily: "var(--font-clash), sans-serif",
                  fontWeight: 700,
                }}
              >
                DEVELOPER
              </p>
            </div>
          </div>

        </div>

      </section>

      {/* ══════════════════════════════════════════════════════════════════════
          SUITABLE FOOTER SECTION (Neobrutalist, Editorial, Fully Integrated)
          ══════════════════════════════════════════════════════════════════════ */}
      <footer className="relative z-10 border-t-[2.5px] border-[#14120E] bg-[#EAE3D2] px-4 pt-12 pb-10 sm:px-6 sm:pt-14 sm:pb-12 lg:px-8">
        <div className="mx-auto max-w-6xl">
          
          <div className="grid grid-cols-1 gap-8 md:grid-cols-12 md:gap-8">
            
            {/* Column 1: Brand & Identity */}
            <div className="md:col-span-5">
              <div className="flex items-center gap-3">
                <div className="relative h-9 w-9 overflow-hidden rounded-full border-2 border-[#14120E] bg-white p-1">
                  <Image
                    src="/brand/rangrez-peacock.png"
                    alt="Rangrez Peacock"
                    fill
                    className="object-contain p-0.5"
                  />
                </div>
                <div className="flex flex-col">
                  <span
                    className="text-2xl font-bold tracking-tight text-[#14120E]"
                    style={{ fontFamily: "var(--font-instrument), serif" }}
                  >
                    Rangrez
                  </span>
                  <span
                    className="text-[10px] uppercase tracking-widest text-[#6D6555]"
                    style={{ fontFamily: "var(--font-clash), sans-serif" }}
                  >
                    the dyer of cloth
                  </span>
                </div>
              </div>

              <div className="mt-3">
                <Rangrez className="text-3xl text-[#0C535E]" />
              </div>

              <p
                className="mt-3 max-w-sm text-xs leading-relaxed text-[#3A352B] sm:text-sm"
                style={{ fontFamily: "var(--font-instrument-sans), sans-serif" }}
              >
                One avatar. Every garment you own, rendered on the same body. Rangrez turns photos of outfits into an intelligent editorial wardrobe.
              </p>

              <div className="mt-5 flex items-center gap-2">
                <span
                  className="inline-flex items-center gap-1.5 rounded-full border border-black/20 bg-white px-3 py-1 text-xs font-bold text-[#14120E]"
                  style={{ fontFamily: "var(--font-clash), sans-serif" }}
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Apparel VTO Engine Active
                </span>
              </div>
            </div>

            {/* Column 2: Navigation Links */}
            <div className="grid grid-cols-2 gap-6 sm:grid-cols-2 md:col-span-4">
              <div>
                <h4
                  className="text-xs font-bold uppercase tracking-wider text-[#6D6555]"
                  style={{ fontFamily: "var(--font-clash), sans-serif" }}
                >
                  Experience
                </h4>
                <ul
                  className="mt-3 space-y-2 text-sm font-semibold"
                  style={{ fontFamily: "var(--font-clash), sans-serif" }}
                >
                  <li>
                    <Link
                      href="/wardrobe"
                      className="inline-flex items-center gap-1 text-[#14120E] transition-colors hover:text-[#1E3A8A]"
                    >
                      Wardrobe Catalog
                    </Link>
                  </li>
                  <li>
                    <Link
                      href="/atelier"
                      className="inline-flex items-center gap-1 text-[#14120E] transition-colors hover:text-[#1E3A8A]"
                    >
                      Avatar Studio
                    </Link>
                  </li>
                  <li>
                    <Link
                      href="/trialroom"
                      className="inline-flex items-center gap-1 text-[#14120E] transition-colors hover:text-[#1E3A8A]"
                    >
                      Trial Room
                    </Link>
                  </li>
                  <li>
                    <Link
                      href="/auth"
                      className="inline-flex items-center gap-1 text-[#14120E] transition-colors hover:text-[#1E3A8A]"
                    >
                      Sign In / Door
                    </Link>
                  </li>
                </ul>
              </div>

              <div>
                <h4
                  className="text-xs font-bold uppercase tracking-wider text-[#6D6555]"
                  style={{ fontFamily: "var(--font-clash), sans-serif" }}
                >
                  Engine & Tech
                </h4>
                <ul
                  className="mt-3 space-y-2 text-xs text-[#3A352B] sm:text-sm"
                  style={{ fontFamily: "var(--font-instrument-sans), sans-serif" }}
                >
                  <li>Apparel VTO Fit</li>
                  <li>Colour Season Analysis</li>
                  <li>6 Natural Dye Palettes</li>
                  <li>Chrome Extension Bridge</li>
                </ul>
              </div>
            </div>

            {/* Column 3: Quick Action */}
            <div className="md:col-span-3">
              <div className="rounded-2xl border-2 border-[#14120E] bg-white p-4 shadow-[3px_3px_0px_#14120E]">
                <h4
                  className="text-base font-bold text-[#14120E]"
                  style={{ fontFamily: "var(--font-instrument), serif" }}
                >
                  Ready to style?
                </h4>
                <p
                  className="mt-1 text-xs text-[#6D6555]"
                  style={{ fontFamily: "var(--font-instrument-sans), sans-serif" }}
                >
                  Upload garments or use your avatar to preview fits in real-time.
                </p>
                <Link
                  href="/wardrobe"
                  className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-[#14120E] bg-[#14120E] px-4 py-2.5 text-xs font-bold text-white shadow-xs transition-transform hover:-translate-y-0.5 active:translate-y-0"
                  style={{ fontFamily: "var(--font-clash), sans-serif" }}
                >
                  <span>Open Wardrobe</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            </div>

          </div>

          {/* Bottom Bar */}
          <div
            className="mt-10 flex flex-col items-center justify-between gap-4 border-t border-black/15 pt-5 text-xs text-[#6D6555] sm:flex-row"
            style={{ fontFamily: "var(--font-clash), sans-serif" }}
          >
            <div className="flex items-center gap-2">
              <Knot size={12} />
              <span>Crafted with natural dyes and digital thread</span>
            </div>

            <div className="flex items-center gap-6">
              <span>Developers: Gantavya Rohilla & Mohikshit Ghorai</span>
              <span>&copy; 2026 Rangrez</span>
            </div>
          </div>

        </div>
      </footer>
    </div>
  );
}
