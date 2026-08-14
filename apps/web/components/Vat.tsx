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

/**
 * "रंगरेज़", spelled for AMS Kartik.
 *
 * Kept as a named constant rather than inlined so nobody tidies it into
 * something that looks more like a word. It is nine characters and every one
 * of them matters; the trailing `‼` (U+203C) draws the nukta under ज़ and will
 * not survive being retyped by hand.
 */
const WORDMARK = "r/gareja\u203C";

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
      {/* Light falling across the surface of the liquid — pushed into the far
          corner, and much weaker than it was. The old bloom sat right where the
          masthead does and lifted the background enough to take body copy under
          4.5:1 on the warmer dyes. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 opacity-70"
        style={{
          background:
            "radial-gradient(55% 40% at 92% 4%, rgba(255,255,255,.13), transparent 60%), radial-gradient(80% 70% at 10% 100%, rgba(0,0,0,.5), transparent 62%)",
        }}
      />

      {/* A scrim under the type. Five dyes of different lightness can't each be
          trusted to carry white text on their own — Madder and Verdigris are
          the weak ones — so the field is darkened wherever words go, and the
          contrast becomes a property of the panel rather than of the dye. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background:
            "linear-gradient(100deg, rgba(0,0,0,.42) 0%, rgba(0,0,0,.28) 45%, rgba(0,0,0,.12) 100%)",
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
          <div className="mb-3 flex items-end justify-between gap-4 border-t border-paper/35 pt-3">
            <div>
              <div className="spec-sm mb-1.5 text-paper/80">In the vat today</div>
              <div className="tight text-[1.05rem] leading-none">{dye.name}</div>
            </div>
            <div className="spec-sm text-right text-paper/80">{dye.hex}</div>
          </div>
          <p className="aside text-[0.95rem] leading-snug text-paper/85">{dye.note}</p>
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
        <span className="inline-flex items-center gap-2 text-paper">
          <Knot size={15} />
          <span className="spec !tracking-[0.34em]">RANGREZ</span>
        </span>
        <span className="spec-sm text-paper/80">EST. 2026 · HACKATHON BUILD</span>
      </div>

      <div className="mt-10 lg:mt-14">
        <p className="mb-6 flex items-center gap-4 text-paper/85">
          {/* Renders as रंगरेज़. AMS Kartik is a legacy font with no Unicode
              Devanagari — every glyph sits on an ASCII slot — so the word has
              to be spelled in that font's own keyboard layout. Typing the
              actual Devanagari here would render nothing.
              The `‼` is U+203C and is load-bearing: it draws the ज़ nukta.
              aria-label carries the real word, since the markup is gibberish
              to anything that isn't this font. */}
          <span
            aria-label="Rangrez"
            role="img"
            className="block shrink-0 text-[2.9rem] leading-[0.75]"
            style={{ fontFamily: "var(--font-kartik)" }}
          >
            {WORDMARK}
          </span>
          <span className="spec">the dyer of cloth</span>
        </p>
        <h1 className="display display-door">
          Every
          <br />
          garment
          <br />
          <span className="aside">you own,</span>
          <br />
          one body.
        </h1>
        <p className="mt-7 max-w-[38ch] text-[0.95rem] leading-relaxed text-paper/90">
          Photograph the clothes you already wear. Rangrez renders each piece onto
          your own avatar, so a shirt from your closet and a jacket from a shop page
          hang on the same shoulders, in the same light.
        </p>
      </div>
    </div>
  );
}
