"use client";


import { useMemo, useState } from "react";

import { AddClothesProvider, useDock } from "./AddClothes";
import { Closet } from "./Closet";
import { GarmentPlate } from "./GarmentPlate";
import { Ground } from "./Ornament";
import { INK } from "@/lib/ornament";
import { tintOf } from "@/lib/tint";
import { ORIGIN_LABEL, type Avatar, type Garment } from "@/lib/types";

/**
 * The wardrobe, as a room.
 *
 * Owns exactly one viewport and never scrolls: the masthead is fixed, the
 * racks fill what is left, and everything that moves moves sideways. That
 * constraint is the design — a cupboard you scroll past is a list of clothes,
 * and the whole point is that it should feel like standing in front of one.
 *
 * Two tabs, because a wardrobe holds two different kinds of thing and
 * conflating them is why most closet apps are useless: what you *own*, and
 * what you are still deciding about.
 */
export function ClosetRoom({
  garments,
  name,
  avatars,
  activeAvatarId,
}: {
  garments: Garment[];
  name: string;
  avatars: Avatar[];
  activeAvatarId?: string;
}) {
  // The upload dock used to hang off the old masthead, which this replaced.
  // Without it there is no way to put a garment into the wardrobe at all —
  // a closet you cannot add to is a catalogue.
  return (
    <AddClothesProvider avatars={avatars} activeAvatarId={activeAvatarId}>
      <Room garments={garments} name={name} />
    </AddClothesProvider>
  );
}

function Room({ garments, name }: { garments: Garment[]; name: string }) {
  const [tab, setTab] = useState<"bought" | "wishlist">("bought");
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState<Garment | null>(null);

  const shown = useMemo(() => {
    // A shop save is a thing you were looking at; everything else is a thing
    // you have. That is the honest split, and it needs no extra column.
    const owned = tab === "bought"
      ? garments.filter((g) => g.origin !== "shop")
      : garments.filter((g) => g.origin === "shop");

    const q = query.trim().toLowerCase();
    if (!q) return owned;

    // Matched across everything the card can show, so searching for a colour
    // or a season works as readily as searching for a name.
    return owned.filter((g) =>
      [g.name, g.dye.name, g.material, g.zone, g.sizeLabel, ORIGIN_LABEL[g.origin]]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(q),
    );
  }, [garments, tab, query]);

  return (
    // Cream ground, saturated ink — which is what a matchbox label actually
    // is. An earlier pass went dark because pale cards dissolved into a pale
    // room, but the real fault was that the cards had no keyline. Give every
    // card a heavy rule (rule 5 of the grammar) and it reads on anything, and
    // the room gets to stay the colour of paper.
    <Ground
      kind="phool"
      tone={INK.peacock}
      accent={INK.madder}
      base={INK.leaf}
      // Denser and fainter. At 104px the rosettes were large enough to read as
      // individual motifs — snowflakes scattered behind the rail — rather than
      // as the weave of the cloth the rail is standing against. A block print
      // is a *texture* at arm's length; it only resolves into flowers up close.
      scale={74}
      opacity={0.075}
      className="page text-abyss"
    >
      {/* ── masthead ──────────────────────────────────────────────────── */}
      <header className="relative z-10 flex shrink-0 flex-wrap items-center gap-x-4 gap-y-2.5 border-b-2 border-abyss bg-leaf/85 px-4 py-2.5 backdrop-blur-sm lg:px-8">
        <span className="spec shrink-0 text-madder">The cupboard</span>

        <label className="relative min-w-0 flex-1 md:max-w-sm">
          <span className="sr-only">Search your wardrobe</span>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search — colour, cloth, name…"
            className="w-full border-2 border-abyss/30 bg-leaf px-3 py-1.5 text-[0.85rem] text-abyss outline-none transition-colors placeholder:text-abyss/35 focus:border-brass"
          />
        </label>

        <div className="flex shrink-0 items-center">
          {(["bought", "wishlist"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              aria-pressed={tab === t}
              className={`spec border-y border-l px-3 py-2 transition-colors duration-300 last:border-r ${
                tab === t
                  ? "border-abyss bg-brass text-abyss"
                  : "border-abyss/30 text-abyss/55 hover:text-abyss"
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        <AddButton />

        <span className="spec-sm hidden text-abyss/45 lg:block">
          {name.toUpperCase()}
        </span>
      </header>

      {/* ── the cupboard ──────────────────────────────────────────────── */}
      {shown.length === 0 ? (
        <div className="flex min-h-0 flex-1 items-center justify-center px-6 text-center">
          <div>
            <p className="display text-[clamp(1.8rem,4vw,3rem)] text-abyss">
              {query ? (
                <>
                  Nothing matches <span className="aside">“{query}”.</span>
                </>
              ) : tab === "wishlist" ? (
                <>
                  Nothing on the <span className="aside">wishlist.</span>
                </>
              ) : (
                <>
                  The rail is <span className="aside">bare.</span>
                </>
              )}
            </p>
            <p className="mt-4 text-[0.9rem] text-abyss/60">
              {tab === "wishlist"
                ? "Pieces you try on from a shop page land here."
                : "Upload a few things and they will be hanging in seconds."}
            </p>
          </div>
        </div>
      ) : (
        <Closet garments={shown} onOpen={setOpen} />
      )}

      {open && <Lightbox garment={open} onClose={() => setOpen(null)} />}
    </Ground>
  );
}

/** Put something new on the rail. */
function AddButton() {
  const dock = useDock();
  if (!dock) return null;
  return (
    <button
      type="button"
      onClick={dock.open}
      className="spec flex shrink-0 items-center gap-2 border border-brass bg-brass px-3 py-2 text-abyss transition-colors duration-300 hover:bg-brass-light"
    >
      <span aria-hidden>+</span>
      <span className="hidden sm:inline">Hang something</span>
    </button>
  );
}

/**
 * One piece, held up to the light.
 *
 * Takes its whole palette from the garment, like the card does — so opening a
 * piece doesn't drop you into a grey modal, it fills the screen with that
 * garment's own colour.
 */
function Lightbox({
  garment,
  onClose,
}: {
  garment: Garment;
  onClose: () => void;
}) {
  const t = tintOf(garment.dye.hex);
  const worn = garment.tryOnUrl;

  return (
    <div
      role="dialog"
      aria-modal
      aria-label={garment.name}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-md lg:p-10"
      style={{ background: `${t.ink}e6` }}
      onClick={onClose}
    >
      <div
        className="relative flex max-h-full w-full max-w-4xl flex-col overflow-hidden lg:flex-row"
        style={{ background: t.card }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative aspect-square w-full lg:w-1/2">
          <GarmentPlate garment={garment} showName={false} />
        </div>

        <div className="flex min-w-0 flex-1 flex-col justify-between gap-6 p-6 lg:p-8">
          <div>
            <p className="spec-sm" style={{ color: t.edge }}>
              {ORIGIN_LABEL[garment.origin].toUpperCase()} · {garment.zone.toUpperCase()}
            </p>
            <h2
              className="display mt-3 text-[clamp(1.7rem,3.4vw,2.8rem)]"
              style={{ color: t.ink }}
            >
              {garment.name}
            </h2>
            <p className="mt-4 text-[0.9rem] leading-relaxed" style={{ color: t.ink }}>
              {garment.material}
            </p>

            <dl className="mt-6 grid grid-cols-2 gap-px" style={{ background: t.edge }}>
              {[
                ["Dye", garment.dye.name],
                ["Size", garment.sizeLabel ?? "—"],
                ["Cut", garment.fit?.cut ?? "—"],
                ["Worn", `${garment.wornCount}×`],
              ].map(([k, v]) => (
                <div key={k} className="px-3 py-2.5" style={{ background: t.card }}>
                  <dt className="spec-sm" style={{ color: t.edge }}>
                    {k.toUpperCase()}
                  </dt>
                  <dd className="tight mt-1.5 text-[0.9rem] capitalize" style={{ color: t.ink }}>
                    {v}
                  </dd>
                </div>
              ))}
            </dl>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {worn && (
              <span className="spec-sm px-2 py-1.5" style={{ background: t.ink, color: t.card }}>
                RENDERED ON YOU
              </span>
            )}
            <button
              type="button"
              onClick={onClose}
              className="spec ml-auto border px-3 py-2 transition-colors"
              style={{ borderColor: t.edge, color: t.ink }}
            >
              Close ×
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
