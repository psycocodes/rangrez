import Image from "next/image";

import { GarmentMenu } from "./GarmentActions";
import { SEASON_LABEL, type Garment } from "@/lib/types";

/**
 * One piece in the catalog.
 *
 * `feature` cards span two columns with a landscape crop — because 8/5 across
 * two columns is exactly the height of 4/5 across one, the rows stay locked to
 * the same baseline no matter how the grid packs. That is what lets the layout
 * break rhythm without ever breaking alignment.
 */
export function GarmentCard({
  garment,
  index,
  raw,
  feature = false,
  onEdit,
}: {
  garment: Garment;
  index: number;
  raw: boolean;
  feature?: boolean;
  onEdit: (garment: Garment) => void;
}) {
  const pending = garment.status !== "rendered";

  // The dye wash exists to make a bag of unrelated placeholder photos read as
  // one lookbook. A real VTO render is a photograph of the user wearing the
  // thing — dyeing that just tints their face. Only stand-ins get dipped.
  const dyed = garment.origin === "seed";

  return (
    <article
      className={`group relative flex flex-col bg-paper ${
        feature ? "col-span-2" : ""
      }`}
    >
      <GarmentMenu garment={garment} onEdit={() => onEdit(garment)} />
      <div
        className={`relative overflow-hidden ${dyed ? "dip" : "bg-paper-3"} ${
          dyed && raw ? "raw" : ""
        } ${feature ? "aspect-[8/5]" : "aspect-[4/5]"}`}
        style={{ "--dye": garment.dye.hex } as React.CSSProperties}
      >
        <Image
          src={garment.imageUrl}
          alt={garment.name}
          fill
          sizes={
            feature
              ? "(max-width: 768px) 100vw, (max-width: 1280px) 66vw, 50vw"
              : "(max-width: 768px) 50vw, (max-width: 1280px) 33vw, 25vw"
          }
          // The scale transition lives on `.dip img` in CSS; undyed renders
          // need it declared here so both paths animate identically.
          className="object-cover transition-transform duration-[900ms] [transition-timing-function:var(--ease-cloth)] group-hover:scale-[1.045]"
          // Placeholder photography already arrives at exactly the card's
          // size. Running it through the optimizer only re-fetches it at 4K
          // and times out under a full grid's worth of parallel requests.
          // Real VTO renders (origin "closet"/"shop") still get optimized.
          unoptimized={garment.origin === "seed"}
        />

        {/* index, printed on the plate like a contact sheet */}
        <span className="spec-sm absolute left-0 top-0 z-[3] bg-paper px-2 py-1.5 text-ink">
          {String(index + 1).padStart(2, "0")}
        </span>

        {/* Sits bottom-left rather than top-right: the ⋯ menu owns that corner
            now, and the hover bar rises from the bottom-right. */}
        {garment.inPalette && !raw && (
          <span className="spec-sm absolute bottom-0 left-0 z-[3] flex items-center gap-1.5 bg-turmeric px-2 py-1.5 text-ink transition-transform duration-500 [transition-timing-function:var(--ease-cloth)] group-hover:-translate-y-10">
            <span aria-hidden className="block h-1.5 w-1.5 rounded-full bg-ink" />
            IN PALETTE
          </span>
        )}

        {garment.origin === "shop" && (
          <span className="spec-sm absolute left-0 top-7 z-[3] bg-indigo px-2 py-1.5 text-paper">
            FROM A SHOP
          </span>
        )}

        {/* Apparel VTO is async — a piece can genuinely be mid-render. */}
        {pending && (
          <div className="absolute inset-0 z-[3] flex items-end bg-ink/55 p-3">
            <span
              aria-hidden
              className="scan absolute inset-x-0 top-0 h-px bg-turmeric"
            />
            <span className="spec-sm text-paper">
              {garment.status === "failed" ? "RENDER FAILED" : "RENDERING ON AVATAR"}
            </span>
          </div>
        )}

        {/* Rises on hover. The whole promise of the product in one line. */}
        <div className="absolute inset-x-0 bottom-0 z-[3] translate-y-full bg-ink text-paper transition-transform duration-500 [transition-timing-function:var(--ease-cloth)] group-hover:translate-y-0">
          <button
            type="button"
            className="flex w-full items-center justify-between px-3 py-2.5"
          >
            <span className="spec">Try on avatar</span>
            <span aria-hidden className="spec">
              →
            </span>
          </button>
        </div>
      </div>

      <div className="flex flex-1 flex-col justify-between gap-3 px-3 py-3">
        <div>
          <h3 className="tight text-[0.9rem] leading-snug transition-colors duration-300 group-hover:text-madder">
            {garment.name}
          </h3>
          <p className="spec-sm mt-1.5 text-ink-3">
            {garment.zone} · {garment.dye.name} · {SEASON_LABEL[garment.season]}
          </p>
        </div>

        <div>
          <p className="aside mb-2 text-[0.82rem] leading-tight text-ink-3">
            {garment.material}
          </p>
          <div className="flex items-center gap-2">
            <span className="relative h-px flex-1 bg-ink/15">
              <span
                className="absolute inset-y-0 left-0 bg-ink"
                style={{
                  width: `${Math.min(garment.wornCount / 50, 1) * 100}%`,
                  height: "1px",
                }}
              />
            </span>
            <span className="spec-sm text-ink-3">{garment.wornCount}× WORN</span>
          </div>
        </div>
      </div>
    </article>
  );
}

/**
 * Editorial break. Sits in the grid at the exact footprint of a card so the
 * rhythm never stutters — the reader just hits a page of text instead of a
 * page of clothes.
 */
export function Interstitial({
  kicker,
  line,
  tone,
}: {
  kicker: string;
  line: string;
  tone: "vat" | "madder" | "turmeric";
}) {
  const skin =
    tone === "turmeric"
      ? "bg-turmeric text-ink"
      : tone === "madder"
        ? "bg-madder text-paper"
        : "bg-vat text-paper";
  const muted = tone === "turmeric" ? "text-ink/55" : "text-paper/55";

  return (
    <aside className={`relative flex flex-col justify-between p-4 ${skin}`}>
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.13]"
        style={{
          backgroundImage:
            "repeating-linear-gradient(0deg,currentColor 0 1px,transparent 1px 5px)",
        }}
      />
      <span className={`spec-sm relative ${muted}`}>{kicker}</span>
      <p className="display display-md relative mt-8 text-balance">{line}</p>
      <span className={`spec-sm relative mt-8 ${muted}`}>RANGREZ — ✦</span>
    </aside>
  );
}
