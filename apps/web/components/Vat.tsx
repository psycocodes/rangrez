"use client";

import { useEffect, useState } from "react";

import Image from "next/image";

import { Knot, Rangrez } from "./Wordmark";
import { ajrakh, cornerMotif, rays } from "@/lib/ornament";

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
      {/* The label's own furniture, over the dye: a sunburst from behind the
          wordmark and a jaali screen across the whole field. Rule 3 — the
          field is never empty — and it is what turns a coloured panel into a
          printed one. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          backgroundImage: `url("${rays("#FCF4E6", 0.09)}"), url("${ajrakh("#FCF4E6", 0.1, 78, "#D99B21")}")`,
          backgroundSize: "cover, auto",
          backgroundPosition: "center 22%, center",
          backgroundRepeat: "no-repeat, repeat",
        }}
      />

      {/* The double rule that closes a label, inset from the panel's edge. */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-4 -z-10 border border-leaf/25 lg:inset-6"
      />
      {[0, 90, 180, 270].map((deg, n) => (
        <span
          key={deg}
          aria-hidden
          className="pointer-events-none absolute z-10 h-[34px] w-[34px] bg-[length:34px_34px] bg-no-repeat"
          style={{
            backgroundImage: `url("${cornerMotif("#FCF4E6", 0.55)}")`,
            transform: `rotate(${deg}deg)`,
            top: n < 2 ? "1rem" : undefined,
            bottom: n >= 2 ? "1rem" : undefined,
            left: n === 0 || n === 3 ? "1rem" : undefined,
            right: n === 1 || n === 2 ? "1rem" : undefined,
          }}
        />
      ))}

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

      <div className="mt-8 lg:mt-10">
        {/* The peacock, with its cream ground keyed out so it sits *in* the
            dye rather than on a white card. `mix-blend-screen` was tried first
            and is the wrong tool — screening a cream image over any colour
            gives you cream. The alpha is baked into the file instead.

            The glow is what makes one asset work against five dyes: the mark
            is drawn in deep teal and gold, which has real contrast on Madder
            and almost none on Indigo, so it carries its own light with it. */}
        <Image
          src="/brand/rangrez-mark.png"
          alt="Rangrez"
          width={900}
          height={396}
          priority
          className="mb-4 w-full max-w-[23rem] drop-shadow-[0_0_18px_rgba(252,244,230,0.45)]"
        />
        <p className="mb-6 flex items-center gap-4 text-paper/85">
          <Rangrez className="block shrink-0 text-[2.4rem] leading-[0.75]" />
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
