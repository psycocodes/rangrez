"use client";

import { useEffect, useState } from "react";

import { Knot } from "./Wordmark";

/**
 * The vat: the deep colour field on the left of the door.
 *
 * It slowly changes dye — a dyer's vat is never one colour for long, and it
 * makes a static sign-in page feel like a place rather than a form. Slow on
 * purpose (5s hold, 1.6s crossfade); anything faster reads as a bug.
 */

const VAT_DYES = [
  { name: "Indigo", hex: "#26356E", note: "Indigofera tinctoria · fermented ten days" },
  { name: "Madder", hex: "#8E3520", note: "Rubia cordifolia · root, ground and steeped" },
  { name: "Pomegranate", hex: "#6B2833", note: "Punica granatum · rind, with alum" },
  { name: "Catechu", hex: "#54331E", note: "Acacia catechu · heartwood extract" },
  { name: "Verdigris", hex: "#22574C", note: "Copper acetate · aged over vinegar" },
] as const;

export function Vat({ children }: { children: React.ReactNode }) {
  const [i, setI] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setI((n) => (n + 1) % VAT_DYES.length), 5000);
    return () => clearInterval(t);
  }, []);

  const dye = VAT_DYES[i];

  return (
    <div
      className="relative isolate flex flex-col justify-between overflow-hidden p-7 text-paper transition-[background-color] duration-[900ms] lg:p-10"
      style={{
        backgroundColor: dye.hex,
        transitionTimingFunction: "var(--ease-cloth)",
      }}
    >
      {/* light falling across the surface of the liquid */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 opacity-70"
        style={{
          background:
            "radial-gradient(80% 55% at 78% 8%, rgba(255,255,255,.22), transparent 62%), radial-gradient(70% 60% at 12% 96%, rgba(0,0,0,.42), transparent 60%)",
        }}
      />
      {/* the weave, showing through the dye */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 opacity-[0.14]"
        style={{
          backgroundImage:
            "repeating-linear-gradient(90deg,#fff 0 1px,transparent 1px 4px),repeating-linear-gradient(0deg,#fff 0 1px,transparent 1px 4px)",
        }}
      />

      {children}

      <div>
        {/* Keyed so the card fades with the vat rather than snapping to the
            new dye's name while the colour is still crossfading. */}
        <div key={dye.name} className="rise">
          <div className="mb-3 flex items-end justify-between gap-4 border-t border-paper/25 pt-3">
            <div>
              <div className="spec-sm mb-1.5 text-paper/55">In the vat today</div>
              <div className="tight text-[1.05rem] leading-none">{dye.name}</div>
            </div>
            <div className="spec-sm text-right text-paper/50">{dye.hex}</div>
          </div>
          <p className="aside text-[0.95rem] leading-snug text-paper/60">{dye.note}</p>
        </div>

        <div className="mt-5 flex gap-1" aria-hidden>
          {VAT_DYES.map((d, n) => (
            <span
              key={d.name}
              className="h-[3px] flex-1 transition-opacity duration-700"
              style={{
                backgroundColor: "currentColor",
                opacity: n === i ? 0.85 : 0.2,
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

export function VatMasthead() {
  return (
    <div>
      <div className="flex items-center justify-between">
        <span className="inline-flex items-center gap-2 text-paper/70">
          <Knot size={15} />
          <span className="spec !tracking-[0.34em]">RANGREZ</span>
        </span>
        <span className="spec-sm text-paper/45">EST. 2026 · HACKATHON BUILD</span>
      </div>

      <div className="mt-10 lg:mt-14">
        <p className="spec mb-5 text-paper/50">رنگریز · the dyer of cloth</p>
        <h1 className="display display-door">
          Every
          <br />
          garment
          <br />
          <span className="aside">you own,</span>
          <br />
          one body.
        </h1>
        <p className="mt-7 max-w-[38ch] text-[0.9rem] leading-relaxed text-paper/65">
          Photograph the clothes you already wear. Rangrez renders each piece onto
          your own avatar, so a shirt from your closet and a jacket from a shop page
          hang on the same shoulders, in the same light.
        </p>
      </div>
    </div>
  );
}
