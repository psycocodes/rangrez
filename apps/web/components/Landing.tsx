"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useState } from "react";

/**
 * ═══════════════════════════════════════════════════════════════════════════
 *  The landing page
 * ═══════════════════════════════════════════════════════════════════════════
 *
 *  A direct port of the `v0` frame, 1440 × 1778. Every number below — left,
 *  top, width, rotation, letter-spacing — is the one Figma reports, and none
 *  of them were rounded or "improved".
 *
 *  ── why it is a scaled canvas and not a fluid layout ────────────────────
 *
 *  The composition is a collage: nothing is in a row or a column, a dozen
 *  elements are rotated by fractions of a degree, and the overlaps are the
 *  design. Rebuilt as flexbox with breakpoints it would be a different poster
 *  at every width. So the page is laid out once at its true size and the whole
 *  canvas is scaled to the viewport, which keeps every relationship exactly as
 *  drawn at any width.
 *
 *  The scale is pure CSS — `calc(100vw / 1440)` — so there is no measure pass,
 *  no resize listener, and nothing to flash on first paint.
 * ═══════════════════════════════════════════════════════════════════════════
 */

/** The frame's own dimensions. Everything below is positioned inside these. */
const W = 1440;
const H = 1778;

/**
 * Where the drawn content actually stops.
 *
 * The frame is 1778 tall but everything below 1494 is a flat #f0ede5 band. The
 * vertical fit is measured against this instead, so the poster sizes itself to
 * what is on it rather than to empty paper.
 */
const CONTENT_H = 1494;

const A = "/assets/landing";

export function Landing() {
  /* The demo at the top left. "loading" is a real wait with no request behind
     it — see `style()`. */
  const [phase, setPhase] = useState<"idle" | "loading" | "done">("idle");

  const style = useCallback(() => {
    if (phase !== "idle") return;
    setPhase("loading");
    /* A stand-in for the try-on call. The real one goes to YouCam through
       /api/wardrobe/render and takes about this long; the landing page shows
       what the answer looks like without spending a render on a visitor who
       has not signed up yet. */
    setTimeout(() => setPhase("done"), 1400);
  }, [phase]);

  return (
    <main
      className="relative min-h-dvh overflow-hidden bg-[#f0ede5]"
      style={{
        /* How much of the window one canvas pixel occupies — the *smaller* of
           what the width allows and what the height allows, so the poster is
           never taller than the screen it is on. Fitting width alone made a
           1440-wide window 1778 tall, which is a landing page you have to
           scroll to see, and a collage only reads whole.
           The height is measured against CONTENT rather than the frame: the
           last 284px of the frame is an empty band, and paying for it in the
           fit would shrink everything that matters to make room for nothing.
           The `px` on each divisor is load-bearing — length ÷ length is a
           *number*, which is what `scale()` takes, whereas `100vw / 1440` is a
           length and `scale()` rejects it, silently leaving the canvas at 1:1. */
        ["--s" as string]: `min(calc(100vw / ${W}px), calc(100dvh / ${CONTENT_H}px))`,
        height: `max(100dvh, calc(${H}px * var(--s)))`,
      }}
    >
      {/* Centred rather than pinned left: once the height is the constraint
          there is width to spare, and a poster floating against one edge reads
          as a mistake. `transform-origin: top center` is what keeps it centred
          as it scales — translating by a percentage would use the *unscaled*
          width and drift. */}
      <div
        className="absolute top-0"
        style={{
          width: W,
          height: H,
          left: "50%",
          marginLeft: -W / 2,
          transformOrigin: "top center",
          transform: "scale(var(--s))",
        }}
      >
        {/* ── the ground ──────────────────────────────────────────────────
            One image, laid twice and turned on its side, exactly as drawn. */}
        <div className="absolute left-0 top-[-21px] flex h-[829px] w-[1471px] items-center justify-center">
          <div className="flex-none -rotate-90">
            <div className="relative h-[1471px] w-[829px]">
              <Image src={`${A}/bg.png`} alt="" fill priority className="object-cover" sizes="1471px" />
            </div>
          </div>
        </div>
        <div className="absolute left-[-22px] top-[776px] flex h-[829px] w-[1471px] items-center justify-center">
          <div className="flex-none -rotate-90">
            <div className="relative h-[1471px] w-[829px]">
              <Image src={`${A}/bg.png`} alt="" fill className="object-cover" sizes="1471px" />
            </div>
          </div>
        </div>
        <div className="absolute left-0 top-[1494px] h-[284px] w-[1440px] bg-[#f0ede5]" />

        {/* ── see it in action ───────────────────────────────────────────── */}
        <Rot left={74} top={63} w={302.623} h={59.643} deg={-4.99}>
          <p className="clash h-[33.609px] w-[300.84px] text-[32.789px] tracking-[1.3116px] text-black">
            SEE IT IN ACTION
          </p>
        </Rot>

        <ShirtCard hidden={phase === "done"} />

        {/* the plus */}
        <div className="absolute left-[317px] top-[197px] size-[158px]">
          <Image src={`${A}/plus.svg`} alt="" width={158} height={158} className="size-full" />
        </div>

        <AvatarPlate hidden={phase === "done"} />

        {/* The answer, in the space the two inputs leave behind. */}
        {phase === "done" && (
          <div
            className="absolute left-[77px] top-[123px] h-[365px] w-[605px] overflow-hidden rounded-[20px] border border-black bg-white shadow-[3px_5px_0px_0px_black]"
            style={{ animation: "rz-reveal 620ms cubic-bezier(0.22,1,0.36,1) both" }}
          >
            <Image
              src={`${A}/styled-result.png`}
              alt="The shirt, worn"
              fill
              className="object-contain"
              sizes="605px"
            />
          </div>
        )}

        {/* ── click to style ─────────────────────────────────────────────── */}
        <button
          type="button"
          onClick={style}
          disabled={phase !== "idle"}
          className="group absolute left-[379px] top-[512px] h-[75px] w-[303px] cursor-pointer disabled:cursor-default"
          aria-label="Style the shirt onto the model"
        >
          <span
            className="clash absolute left-0 top-[12px] h-[42px] w-[169px] text-left text-[40px] tracking-[1.6px]"
            style={{ color: "transparent", WebkitTextStroke: "1.4px #12100d" }}
          >
            Click to
          </span>
          <span className="absolute left-[166px] top-[10px] h-[55px] w-[137px] rounded-[20px] border border-black bg-white shadow-[2px_3px_0px_0px_black] transition-[translate,box-shadow] duration-150 group-hover:-translate-y-[2px] group-hover:shadow-[3px_5px_0px_0px_black] group-active:translate-x-[2px] group-active:translate-y-[3px] group-active:shadow-none" />
          <span className="clash absolute left-[185px] top-[10px] h-[44.323px] w-[113.333px] text-left text-[40px] text-black">
            {phase === "loading" ? "…" : "style"}
          </span>
        </button>

        {/* ── meet rangrez ───────────────────────────────────────────────── */}
        <div className="absolute left-[700px] top-[113px] size-[242px]">
          <Image src={`${A}/star.svg`} alt="" width={242} height={242} className="size-full" />
        </div>

        <Rot left={989.8} top={271.91} w={362.903} h={120.931} deg={2.24}>
          <div className="h-[107px] w-[359px] bg-[#dc7b0c]" />
        </Rot>
        <Rot left={965} top={234} w={389.148} h={179.823} deg={2.24}>
          <p className="instrument h-[165px] w-[383px] text-[126.996px] italic leading-normal text-[#12197e]">
            rangrez
          </p>
        </Rot>
        <Rot left={799} top={132} w={332.215} h={120.362} deg={-5.77}>
          <p className="clash h-[88.121px] w-[325px] text-[92.129px] text-black">MEET</p>
        </Rot>
        <Rot left={1007} top={234} w={346.428} h={35.925} deg={2.3}>
          {/* SF Pro Display in the frame, which is the system face here. It is
              one line at that width in Figma, so it is pinned to one line —
              any substitute face is wider and wraps into the wordmark. */}
          <p
            className="h-[22.074px] w-[345.821px] whitespace-nowrap text-[29.053px] font-bold text-black"
            style={{ fontFamily: '-apple-system, "SF Pro Display", system-ui, sans-serif' }}
          >
            the stylist everyone needs
          </p>
        </Rot>

        {/* ── start styling ──────────────────────────────────────────────── */}
        <Link
          href="/enter"
          className="group absolute left-[784px] top-[433px] flex h-[108.721px] w-[559.977px] items-center justify-center"
          aria-label="Start styling — sign in"
        >
          <span className="flex-none rotate-[2.24deg]">
            <span className="relative block h-[87px] w-[557px] rounded-[37px] border border-black bg-white shadow-[3px_5px_0px_0px_black] transition-[translate,box-shadow] duration-200 group-hover:-translate-y-[3px] group-hover:shadow-[5px_8px_0px_0px_black] group-active:translate-x-[3px] group-active:translate-y-[5px] group-active:shadow-none" />
          </span>
        </Link>
        <Rot left={821} top={481} w={68} h={1} deg={0.84} className="pointer-events-none">
          <span className="relative block h-0 w-[68.007px]">
            <Image
              src={`${A}/arrow.svg`}
              alt=""
              width={68}
              height={38}
              className="absolute left-0 top-[-19px] block max-w-none"
            />
          </span>
        </Rot>
        <Rot left={907} top={441} w={422.635} h={40.099} deg={1.82} className="pointer-events-none">
          <p
            className="clash h-[26.682px] w-[422px] text-[64.69px]"
            style={{ color: "transparent", WebkitTextStroke: "1.6px #12100d" }}
          >
            start styling
          </p>
        </Rot>

        {/* ── the two tapes ──────────────────────────────────────────────── */}
        <Tape
          left={-121.46}
          top={659.25}
          w={1606.867}
          h={271.135}
          deg={-6.79}
          barW={1608.526}
          barH={81.439}
          className="bg-[#d9b790]"
          seconds={26}
        >
          <span className="clash whitespace-pre text-[63.866px] tracking-[2.5546px] text-[#979797]">
            RANGREZ NEVER LETS YOU STOP&nbsp;
          </span>
        </Tape>

        <Tape
          left={-36}
          top={712}
          w={1611.053}
          h={162.139}
          deg={2.45}
          barW={1608.526}
          barH={93.532}
          className="border border-black bg-white"
          seconds={22}
          reverse
        >
          <span className="instrument whitespace-pre text-[63.866px] italic tracking-[2.5546px] text-black">
            NEVER STOP STYLING&nbsp;
          </span>
        </Tape>

        {/* ── meet the team ──────────────────────────────────────────────── */}
        <div className="absolute left-[422px] top-[986px] flex size-[214.031px] items-center justify-center">
          <span className="flex-none rotate-[-70.01deg]">
            <Image src={`${A}/blob.svg`} alt="" width={167} height={167} className="block size-[167px]" />
          </span>
        </div>
        <Rot left={469.54} top={1042.75} w={271.267} h={155.267} deg={-2.62}>
          <p className="clash h-[143.316px] w-[265px] text-[55.176px] tracking-[2.207px] text-black">MEET </p>
        </Rot>
        <Rot left={520} top={1145} w={438.541} h={106.595} deg={1.66}>
          <div className="h-[94px] w-[436px] bg-[#d6a6ff]" />
        </Rot>
        <Rot left={541} top={1108} w={418.333} h={217.821} deg={2.16}>
          <p className="instrument h-[202.487px] w-[411px] text-[99.901px] tracking-[3.996px] text-black">
            THE TEAM
          </p>
        </Rot>
        <Rot left={528.75} top={1241.11} w={477.49} h={117.822} deg={1.43}>
          <p className="geist h-[106.041px] w-[475px] text-[39.676px] tracking-[-3.5709px] text-[#ffb56c]">
            rangrez wasnt built in a day
          </p>
        </Rot>

        <Member
          card={{ left: 81, top: 1019, w: 299.252, h: 381.595, deg: -4.27, bw: 273.043, bh: 362.276 }}
          cardClass="rounded-[37px] bg-[#867fed] shadow-[4px_5px_0px_0px_black]"
          photo={{ left: 103, top: 1040.3, w: 256.363, h: 298.855, deg: -4.09, skew: 0.52, bw: 234.189, bh: 283.069 }}
          src={`${A}/gantavya.png`}
          box={{ left: -212.81, top: -136.39, w: 688.285, h: 768.069 }}
          imgBox={{ w: 632, h: 724.805 }}
          innerDeg={4.09}
          innerSkew={-0.52}
          imgClass="h-[149.31%] left-[-22.91%] top-[-49.31%] w-[128.84%]"
          name={{ left: 125.97, top: 1329.64, w: 233.11, h: 68.885, deg: -5.18, skew: 0.53 }}
          who="GANTAVYA ROHILLA"
          nameSize={19.572}
          roleSize={12.47}
          track={0.7829}
        />

        <Member
          card={{ left: 1064.4, top: 1014.85, w: 288.083, h: 390.702, deg: 2.3, bw: 273.043, bh: 380.045 }}
          cardClass="rounded-[41px] border border-black bg-[#f0a000] shadow-[4px_5px_0px_0px_black]"
          photo={{ left: 1090.36, top: 1037.83, w: 238.316, h: 295.016, deg: 2.34, skew: 0, bw: 226.837, bh: 286 }}
          src={`${A}/mohikshit.png`}
          box={{ left: -32.22, top: -22.81, w: 292.299, h: 379.468 }}
          imgBox={{ w: 280.461, h: 370.592 }}
          innerDeg={-1.85}
          innerSkew={0}
          imgClass="h-[131.52%] left-[-15.26%] top-[-7.74%] w-[130.34%]"
          name={{ left: 1088.16, top: 1332.79, w: 227.824, h: 62.329, deg: 2.3, skew: 0 }}
          who="MOHIKSHIT GHORAI"
          nameSize={20.405}
          roleSize={13}
          track={0.8162}
        />
      </div>

      <style>{`
        .clash{font-family:var(--font-clash),system-ui,sans-serif;font-weight:700;line-height:normal}
        .instrument{font-family:var(--font-instrument),Georgia,serif;line-height:normal}
        .imbue{font-family:var(--font-imbue),Georgia,serif;line-height:normal}
        .geist{font-family:var(--font-geist),system-ui,sans-serif;line-height:normal}
        .friday{font-family:var(--font-friday),system-ui,sans-serif}
        .iosevka{font-family:var(--font-iosevka),ui-monospace,monospace}
        .identity{font-family:var(--font-identity),system-ui,sans-serif}

        /* The tapes. One copy of the text is repeated until it is wider than
           the tape, then the whole strip slides left by exactly the width of
           one repeat — at which point it is back where it started and the
           loop is invisible. */
        @keyframes rz-tape{from{transform:translateX(0)}to{transform:translateX(-50%)}}
        @keyframes rz-tape-rev{from{transform:translateX(-50%)}to{transform:translateX(0)}}
        @keyframes rz-reveal{from{opacity:0;transform:scale(.96)}to{opacity:1;transform:scale(1)}}

        @media (prefers-reduced-motion: reduce){
          .rz-marquee{animation:none !important}
        }
      `}</style>
    </main>
  );
}

/* ── the two primitives the frame is built out of ─────────────────────── */

/**
 * Figma's rotation box.
 *
 * A rotated layer in Figma reports the bounding box of the *rotated* result,
 * with the unrotated content centred inside it. Reproducing that is exactly
 * this: an absolutely placed flex box at the reported size, centring a
 * `flex-none` child that carries the rotation.
 */
function Rot({
  left,
  top,
  w,
  h,
  deg,
  skew = 0,
  className = "",
  children,
}: {
  left: number;
  top: number;
  w: number;
  h: number;
  deg: number;
  skew?: number;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={`absolute flex items-center justify-center ${className}`}
      style={{ left, top, width: w, height: h }}
    >
      <div
        className="flex-none"
        style={{ transform: `rotate(${deg}deg)${skew ? ` skewX(${skew}deg)` : ""}` }}
      >
        {children}
      </div>
    </div>
  );
}

/** A tape: a rotated bar that clips an endlessly repeating line of text. */
function Tape({
  left,
  top,
  w,
  h,
  deg,
  barW,
  barH,
  className,
  seconds,
  reverse = false,
  children,
}: {
  left: number;
  top: number;
  w: number;
  h: number;
  deg: number;
  barW: number;
  barH: number;
  className: string;
  seconds: number;
  reverse?: boolean;
  children: React.ReactNode;
}) {
  /* Enough copies to cover twice the tape, so there is always a full screen
     of text queued behind the one leaving. */
  const copies = Array.from({ length: 8 });

  return (
    <Rot left={left} top={top} w={w} h={h} deg={deg}>
      <div className={`relative overflow-hidden ${className}`} style={{ width: barW, height: barH }}>
        <div
          className="rz-marquee absolute left-0 top-1/2 flex w-max -translate-y-1/2 items-center"
          style={{
            animation: `${reverse ? "rz-tape-rev" : "rz-tape"} ${seconds}s linear infinite`,
          }}
        >
          {/* Two identical halves: the strip travels exactly one half, so the
              frame it lands on is pixel-identical to the one it left. */}
          {[0, 1].map((half) => (
            <div key={half} className="flex items-center">
              {copies.map((_, i) => (
                <span key={i}>{children}</span>
              ))}
            </div>
          ))}
        </div>
      </div>
    </Rot>
  );
}

/* ── the pieces ───────────────────────────────────────────────────────── */

function ShirtCard({ hidden }: { hidden: boolean }) {
  return (
    <div
      className="absolute left-[77px] top-[123px] flex h-[383.513px] w-[286.209px] items-center justify-center transition-[opacity,scale] duration-500"
      style={{ opacity: hidden ? 0 : 1, scale: hidden ? "0.94" : "1", pointerEvents: hidden ? "none" : undefined }}
    >
      <div className="group flex-none rotate-[-4.35deg] transition-transform duration-300 hover:scale-[1.04] hover:rotate-[-2.2deg]">
        <div className="relative h-[364.903px] w-[259.286px] overflow-clip rounded-t-[48.784px] border-[1.22px] border-black bg-[#e49894] shadow-[3.415px_4.147px_0px_0px_black] transition-shadow duration-300 group-hover:shadow-[6px_8px_0px_0px_black]">
          <div className="absolute left-[12.2px] top-[11.95px] h-[270.507px] w-[231.723px] overflow-clip rounded-t-[39.027px] bg-[#e5b7b6]">
            <p className="identity absolute left-[135.25px] top-[-10.98px] h-[352.451px] w-[305.631px] -translate-x-1/2 text-center text-[41.618px] leading-none tracking-[0.4162px] text-[rgba(22,25,114,0.6)] [word-break:break-word]">
              PINKSHIRTPINKSHIRTPINKSHIRTPINKSHIRTPINKSHIRTPINKSHIRTPINKSHIRT
            </p>
          </div>
          <div className="absolute left-[24.39px] top-[27.32px] h-[239.538px] w-[207.08px]">
            <div className="pointer-events-none absolute inset-0 overflow-hidden">
              <Image
                src={`${A}/pink-shirt.png`}
                alt="Pink shirt"
                width={480}
                height={320}
                priority
                className="absolute left-[-16.61%] top-[-18.43%] h-[133.6%] w-[231.97%] max-w-none"
              />
            </div>
          </div>
          <p className="iosevka absolute left-[33.66px] top-[289.53px] h-[11.708px] w-[69.761px] -translate-x-1/2 text-center text-[15.504px] leading-none tracking-[0.155px] text-[#9d5959]">
            SHIRTS
          </p>
          <p className="friday absolute left-[9.76px] top-[311.48px] h-[41.954px] w-[236.741px] text-[42.167px] leading-none text-white">
            PINK SHIRT
          </p>
        </div>
      </div>
    </div>
  );
}

function AvatarPlate({ hidden }: { hidden: boolean }) {
  return (
    <div
      className="absolute left-[433px] top-[122.78px] h-[360px] w-[249px] transition-[opacity,scale] duration-500"
      style={{ opacity: hidden ? 0 : 1, scale: hidden ? "0.94" : "1", pointerEvents: hidden ? "none" : undefined }}
    >
      <div className="absolute left-0 top-0 h-[359.388px] w-[249px] border-[0.783px] border-black bg-[#d9d9d9]" />
      <div className="absolute left-[5.02px] top-[7.62px] h-[297.797px] w-[238.965px] bg-[#8c8c8c]" />
      <div className="absolute left-[4px] top-[10.22px] h-[295px] w-[240px] overflow-clip">
        <p className="clash absolute left-0 top-[-21px] h-[355.688px] w-[271px] text-[56.593px] leading-none tracking-[-5.0934px] text-[#7b7b7b]">
          MODELMODELMODELMODELMODELMODELMODELMODEL
        </p>
        <div className="absolute left-[12px] top-[-17px] h-[329px] w-[215px]">
          <div className="pointer-events-none absolute inset-0 overflow-hidden">
            <Image
              src={`${A}/avatar-01.png`}
              alt="Avatar 01"
              width={420}
              height={420}
              priority
              className="absolute left-[-45.42%] top-0 h-[121.47%] w-[186.25%] max-w-none"
            />
          </div>
        </div>
      </div>
      <p className="imbue absolute left-[6.02px] top-[300.41px] h-[51.432px] w-[200.705px] text-[50.119px] text-black">
        Avatar 01
      </p>
    </div>
  );
}

function Member({
  card,
  cardClass,
  photo,
  src,
  box,
  imgBox,
  innerDeg,
  innerSkew,
  imgClass,
  name,
  who,
  nameSize,
  roleSize,
  track,
}: {
  card: { left: number; top: number; w: number; h: number; deg: number; bw: number; bh: number };
  cardClass: string;
  photo: { left: number; top: number; w: number; h: number; deg: number; skew: number; bw: number; bh: number };
  src: string;
  /** The rotation box the photograph sits in, inside the clipped frame. */
  box: { left: number; top: number; w: number; h: number };
  /** The photograph's own box — a separate node in the frame, and the one
      that gives the <img> percentages something to be a percentage *of*. */
  imgBox: { w: number; h: number };
  innerDeg: number;
  innerSkew: number;
  imgClass: string;
  name: { left: number; top: number; w: number; h: number; deg: number; skew: number };
  who: string;
  nameSize: number;
  roleSize: number;
  track: number;
}) {
  return (
    <>
      <Rot left={card.left} top={card.top} w={card.w} h={card.h} deg={card.deg}>
        <div
          className={`${cardClass} transition-[translate,box-shadow] duration-300`}
          style={{ width: card.bw, height: card.bh }}
        />
      </Rot>

      {/* The photograph is its own layer in the frame, sitting on the card
          rather than inside it — so the hover lifts this and the card stays
          put, which is what gives the lift its depth. */}
      <div
        className="group absolute z-[2] flex items-center justify-center"
        style={{ left: photo.left, top: photo.top, width: photo.w, height: photo.h }}
      >
        <div
          className="flex-none transition-transform duration-300 group-hover:scale-[1.05]"
          style={{ transform: `rotate(${photo.deg}deg)${photo.skew ? ` skewX(${photo.skew}deg)` : ""}` }}
        >
          <div
            className="relative overflow-hidden rounded-[20px] border border-black transition-shadow duration-300 group-hover:shadow-[5px_7px_0px_0px_black]"
            style={{ width: photo.bw, height: photo.bh }}
          >
            <div
              className="absolute flex items-center justify-center"
              style={{ left: box.left, top: box.top, width: box.w, height: box.h }}
            >
              <div
                className="flex-none"
                style={{
                  transform: `rotate(${innerDeg}deg)${innerSkew ? ` skewX(${innerSkew}deg)` : ""}`,
                }}
              >
                <div className="relative" style={{ width: imgBox.w, height: imgBox.h }}>
                  <div className="pointer-events-none absolute inset-0 overflow-hidden">
                    <Image
                      src={src}
                      alt={who}
                      width={900}
                      height={1100}
                      className={`absolute max-w-none ${imgClass}`}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <Rot left={name.left} top={name.top} w={name.w} h={name.h} deg={name.deg} skew={name.skew}>
        <div className="clash" style={{ letterSpacing: `${track}px` }}>
          <p className="mb-0 text-black" style={{ fontSize: nameSize }}>
            {who}
          </p>
          <p className="text-[#0017ac]" style={{ fontSize: roleSize }}>
            DEVELOPER
          </p>
        </div>
      </Rot>
    </>
  );
}
