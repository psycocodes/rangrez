import Image from "next/image";

import { GarmentMenu, GarmentTryOn } from "./GarmentActions";
import { SEASON_LABEL, type Garment } from "@/lib/types";

/**
 * One piece in the catalog.
 *
 * `feature` cards span two columns with a landscape crop — because 8/5 across
 * two columns is exactly the height of 4/5 across one, the rows stay locked to
 * the same baseline no matter how the grid packs. That is what lets the layout
 * break rhythm without ever breaking alignment.
 *
 * The card holds up to two photographs of the same piece: the garment itself,
 * and the garment worn. Hover crossfades between them — which is the entire
 * product argument in one gesture, so it is worth the second image request.
 */
export function GarmentCard({
  garment,
  index,
  raw,
  feature = false,
  onEdit,
  canTryOn = false,
}: {
  garment: Garment;
  index: number;
  raw: boolean;
  feature?: boolean;
  onEdit: (garment: Garment) => void;
  /** There is an avatar to render against. */
  canTryOn?: boolean;
}) {
  const pending = garment.status === "queued" || garment.status === "processing";

  // The dye wash exists to make a bag of unrelated placeholder photos read as
  // one lookbook. A real VTO render is a photograph of the user wearing the
  // thing — dyeing that just tints their face. Only stand-ins get dipped.
  //
  // Drawn starter pieces are already in their own dye, so dipping them would
  // apply it twice. Keyed off the data URI rather than the origin so accounts
  // seeded before the artwork existed still get their photos dipped.
  const dyed = garment.origin === "seed" && !garment.imageUrl.startsWith("data:");

  const worn = garment.tryOnUrl;

  const sizes = feature
    ? "(max-width: 768px) 100vw, (max-width: 1280px) 66vw, 50vw"
    : "(max-width: 768px) 50vw, (max-width: 1280px) 33vw, 25vw";

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
          sizes={sizes}
          // The scale transition lives on `.dip img` in CSS; undyed renders
          // need it declared here so both paths animate identically.
          className={`z-[1] object-cover transition-transform duration-[900ms] [transition-timing-function:var(--ease-cloth)] group-hover:scale-[1.045] ${
            worn ? "transition-opacity group-hover:opacity-0" : ""
          }`}
          // Placeholder photography already arrives at exactly the card's
          // size. Running it through the optimizer only re-fetches it at 4K
          // and times out under a full grid's worth of parallel requests.
          // Real VTO renders (origin "closet"/"shop") still get optimized.
          unoptimized={garment.origin === "seed"}
        />

        {/* The same piece, worn. Sits directly under the flat shot — revealed
            by that one fading out, never cross-dissolved through the backdrop,
            which would flash the card's paper colour mid-transition. */}
        {worn && (
          <Image
            src={worn}
            alt={`${garment.name}, on your avatar`}
            fill
            sizes={sizes}
            loading="lazy"
            className="z-0 object-cover"
          />
        )}

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
        {garment.origin === "upload" && (
          <span className="spec-sm absolute left-0 top-7 z-[3] bg-ink px-2 py-1.5 text-paper">
            YOURS
          </span>
        )}

        {/* Says what the hover will do, before you hover. Without it the second
            photograph is a secret only mouse users ever find. */}
        {worn && !pending && (
          <span className="spec-sm absolute right-0 top-7 z-[3] flex items-center gap-1.5 bg-paper px-2 py-1.5 text-ink transition-opacity duration-500 group-hover:opacity-0">
            <span aria-hidden className="block h-1.5 w-1.5 rounded-full bg-madder" />
            ON YOU
          </span>
        )}

        {/* Apparel VTO is async — a piece can genuinely be mid-render. A bar
            rather than the full scrim this used to be: an upload already has a
            photograph of the garment worth looking at while it waits. */}
        {pending && (
          <div className="absolute inset-x-0 bottom-0 z-[3] bg-ink/85 px-3 py-2 text-paper">
            <span
              aria-hidden
              className="scan absolute inset-x-0 top-0 h-px bg-turmeric"
            />
            <span className="spec-sm">
              {garment.status === "queued" ? "QUEUED FOR THE BODY" : "RENDERING ON AVATAR"}
            </span>
          </div>
        )}

        {garment.status === "failed" && (
          <span className="spec-sm absolute inset-x-0 bottom-0 z-[3] bg-madder px-3 py-2 text-paper">
            RENDER FAILED
          </span>
        )}

        {/* Rises on hover. The whole promise of the product in one line. */}
        <GarmentTryOn garment={garment} canTryOn={canTryOn} />
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

          {/* The size, when the piece knows it. Printed rather than hidden in
              a menu: "which of my three white shirts is the M" is the question
              a wardrobe grid should be able to answer at a glance. */}
          {(garment.sizeLabel || garment.fit?.cut) && (
            <p className="spec-sm mb-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-ink-3">
              {garment.sizeLabel && (
                <span className="border border-ink/25 px-1.5 py-1 text-ink">
                  {garment.sizeLabel.toUpperCase()}
                </span>
              )}
              {garment.fit?.cut && <span>{garment.fit.cut.toUpperCase()} CUT</span>}
              {garment.fit?.chart && <span title="This piece carries the shop's size chart">· CHARTED</span>}
            </p>
          )}

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
