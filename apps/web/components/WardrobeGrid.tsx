"use client";

import { useMemo, useState } from "react";

import { useDock } from "./AddClothes";
import { GarmentEditor } from "./GarmentActions";
import { GarmentCard, Interstitial } from "./GarmentCard";
import { GRID_INTERSTITIALS } from "@/lib/seed";
import {
  ORIGIN_LABEL,
  ZONE_LABEL,
  ZONES,
  type Garment,
  type Origin,
  type Zone,
} from "@/lib/types";

type Filter = Zone | "all";
type Sort = "recent" | "worn" | "dye";
type Source = Origin | "all";

/** Source chips, in the order they're offered. Only shown if non-empty. */
const SOURCES: Origin[] = ["upload", "shop", "closet", "seed"];

export function WardrobeGrid({
  garments,
  hasAvatar,
}: {
  garments: Garment[];
  /** There is a plate to render against, so cards can offer a try-on. */
  hasAvatar: boolean;
}) {
  const dock = useDock();

  const [zone, setZone] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const [paletteOnly, setPaletteOnly] = useState(false);
  const [raw, setRaw] = useState(false);
  const [sort, setSort] = useState<Sort>("recent");
  const [source, setSource] = useState<Source>("all");
  const [editing, setEditing] = useState<Garment | null>(null);

  const bySource = useMemo(() => {
    const map = {} as Record<Origin, number>;
    for (const o of SOURCES) map[o] = garments.filter((g) => g.origin === o).length;
    return map;
  }, [garments]);

  const counts = useMemo(() => {
    const map = { all: garments.length } as Record<Filter, number>;
    for (const z of ZONES) map[z] = garments.filter((g) => g.zone === z).length;
    return map;
  }, [garments]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = garments.filter((g) => {
      if (zone !== "all" && g.zone !== zone) return false;
      if (source !== "all" && g.origin !== source) return false;
      if (paletteOnly && !g.inPalette) return false;
      if (!q) return true;
      return (
        g.name.toLowerCase().includes(q) ||
        g.dye.name.toLowerCase().includes(q) ||
        g.material.toLowerCase().includes(q)
      );
    });

    const sorted = [...list];
    if (sort === "worn") sorted.sort((a, b) => b.wornCount - a.wornCount);
    if (sort === "dye") sorted.sort((a, b) => a.dye.name.localeCompare(b.dye.name));
    return sorted;
  }, [garments, zone, query, paletteOnly, sort, source]);

  const filtered =
    zone !== "all" || source !== "all" || paletteOnly || query.trim() !== "";

  return (
    <section>
      <FilterBar
        counts={counts}
        zone={zone}
        setZone={setZone}
        query={query}
        setQuery={setQuery}
        paletteOnly={paletteOnly}
        setPaletteOnly={setPaletteOnly}
        raw={raw}
        setRaw={setRaw}
        sort={sort}
        setSort={setSort}
        source={source}
        setSource={setSource}
        bySource={bySource}
        shown={visible.length}
        onAdd={() => dock?.open()}
      />

      {visible.length === 0 ? (
        <Empty
          filtered={filtered}
          onAdd={() => dock?.open()}
          onReset={() => {
            setZone("all");
            setQuery("");
            setPaletteOnly(false);
            setSource("all");
          }}
        />
      ) : (
        // gap-px over an ink field: the gutters *are* the hairline rules.
        <div className="grid grid-cols-2 gap-px bg-ink/15 md:grid-cols-3 xl:grid-cols-4 [grid-auto-flow:dense]">
          {interleave(visible).map((cell) =>
            cell.kind === "garment" ? (
              <GarmentCard
                key={cell.garment.id}
                garment={cell.garment}
                index={cell.index}
                raw={raw}
                feature={cell.feature}
                onEdit={setEditing}
                canTryOn={hasAvatar}
              />
            ) : (
              <Interstitial key={cell.key} {...cell.copy} />
            ),
          )}
        </div>
      )}

      {/* One editor for the whole grid rather than one per card. */}
      {editing && (
        <GarmentEditor garment={editing} onClose={() => setEditing(null)} />
      )}
    </section>
  );
}

/* ── layout rhythm ──────────────────────────────────────────────────────── */

type Cell =
  | { kind: "garment"; garment: Garment; index: number; feature: boolean }
  | { kind: "note"; key: string; copy: (typeof GRID_INTERSTITIALS)[number] };

/**
 * Breaks the catalog's rhythm on a fixed cadence: every 6th piece runs wide,
 * and an editorial note lands every 11 cells. Both occupy whole-card
 * footprints so rows stay aligned — see the note in GarmentCard.
 */
function interleave(list: Garment[]): Cell[] {
  const out: Cell[] = [];
  let notes = 0;

  list.forEach((garment, i) => {
    out.push({ kind: "garment", garment, index: i, feature: i > 0 && i % 6 === 0 });
    if ((i + 1) % 11 === 0 && notes < GRID_INTERSTITIALS.length) {
      out.push({
        kind: "note",
        key: `note-${notes}`,
        copy: GRID_INTERSTITIALS[notes],
      });
      notes++;
    }
  });

  return out;
}

/* ── controls ───────────────────────────────────────────────────────────── */

function FilterBar({
  counts,
  zone,
  setZone,
  query,
  setQuery,
  paletteOnly,
  setPaletteOnly,
  raw,
  setRaw,
  sort,
  setSort,
  source,
  setSource,
  bySource,
  shown,
  onAdd,
}: {
  counts: Record<Filter, number>;
  zone: Filter;
  setZone: (z: Filter) => void;
  query: string;
  setQuery: (q: string) => void;
  paletteOnly: boolean;
  setPaletteOnly: (v: boolean) => void;
  raw: boolean;
  setRaw: (v: boolean) => void;
  sort: Sort;
  setSort: (s: Sort) => void;
  source: Source;
  setSource: (s: Source) => void;
  bySource: Record<Origin, number>;
  shown: number;
  onAdd: () => void;
}) {
  // Only offer a source filter once there is more than one source to tell
  // apart — a wardrobe entirely of uploads doesn't need a chip saying so.
  const sources = SOURCES.filter((s) => bySource[s] > 0);

  return (
    // top-shell-top, not a hand-tuned rem: this bar and the header it hangs
    // under read the same token, so the seam can't reopen.
    <div className="sticky top-shell-top z-40 border-y border-ink/15 bg-paper/92 backdrop-blur-md">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2.5 px-4 py-2.5 lg:px-6">
        {/* The one thing you came here to do, in the one bar that follows you
            down the page. First position, filled, never scrolls away. */}
        <button
          type="button"
          onClick={onAdd}
          className="flex shrink-0 items-center gap-2 bg-ink px-3 py-2 text-paper transition-colors duration-300 hover:bg-madder"
        >
          <span aria-hidden className="spec">+</span>
          <span className="spec">Add clothes</span>
        </button>

        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
          <Chip on={zone === "all"} onClick={() => setZone("all")}>
            <span className="spec">Everything</span>
            <span className="spec-sm opacity-55">{counts.all}</span>
          </Chip>
          {ZONES.map((z) => (
            <Chip key={z} on={zone === z} onClick={() => setZone(z)}>
              <span className="spec">{ZONE_LABEL[z]}</span>
              <span className="spec-sm opacity-55">{counts[z]}</span>
            </Chip>
          ))}
        </div>

        <div className="ml-auto flex flex-wrap items-center gap-x-4 gap-y-2.5">
          <label className="flex items-baseline gap-2">
            <span className="spec-sm text-ink-3">FIND</span>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="linen, indigo, trouser…"
              className="field !w-44 !py-1 !text-[0.82rem]"
            />
          </label>

          {sources.length > 1 && (
            <div className="flex items-center gap-1.5">
              <span className="spec-sm text-ink-3">SOURCE</span>
              <Chip on={source === "all"} onClick={() => setSource("all")}>
                <span className="spec">Any</span>
              </Chip>
              {sources.map((s) => (
                <Chip
                  key={s}
                  on={source === s}
                  onClick={() => setSource(source === s ? "all" : s)}
                >
                  <span className="spec">{ORIGIN_LABEL[s]}</span>
                  <span className="spec-sm opacity-55">{bySource[s]}</span>
                </Chip>
              ))}
            </div>
          )}

          <Chip on={paletteOnly} onClick={() => setPaletteOnly(!paletteOnly)}>
            <span
              aria-hidden
              className="block h-1.5 w-1.5 self-center rounded-full bg-turmeric"
            />
            <span className="spec">My palette</span>
          </Chip>

          {/* Little joke, real feature: see the cloth before it went in the vat. */}
          <Chip on={raw} onClick={() => setRaw(!raw)}>
            <span className="spec">{raw ? "Raw cloth" : "Dyed"}</span>
          </Chip>

          <label className="flex items-baseline gap-2">
            <span className="spec-sm text-ink-3">ORDER</span>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as Sort)}
              className="spec cursor-pointer border-b border-ink/25 bg-transparent py-1 pr-1 outline-none"
            >
              <option value="recent">NEWEST</option>
              <option value="worn">MOST WORN</option>
              <option value="dye">BY DYE</option>
            </select>
          </label>

          <span className="spec-sm border-l border-ink/20 pl-4 text-ink-3">
            {String(shown).padStart(2, "0")} SHOWN
          </span>
        </div>
      </div>
    </div>
  );
}

function Chip({
  on,
  onClick,
  children,
}: {
  on: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button type="button" className="chip" data-on={on} onClick={onClick}>
      {children}
    </button>
  );
}

/**
 * Two different empties. A wardrobe with nothing in it needs an invitation;
 * a filter that matched nothing needs a way back. Showing "add some clothes"
 * to someone who has thirty pieces and a typo in the search box is the kind of
 * empty state that makes a product feel like it isn't listening.
 */
function Empty({
  filtered,
  onReset,
  onAdd,
}: {
  filtered: boolean;
  onReset: () => void;
  onAdd: () => void;
}) {
  if (filtered) {
    return (
      <div className="flex flex-col items-start gap-5 px-4 py-24 lg:px-6">
        <p className="spec-sm text-ink-3">NOTHING ON THE RAIL</p>
        <p className="display display-md max-w-[16ch]">
          No piece answers to <span className="aside">that.</span>
        </p>
        <button type="button" onClick={onReset} className="btn btn-ghost">
          <span className="spec">Clear the filters</span>
          <span aria-hidden className="spec">↺</span>
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-start gap-5 px-4 py-24 lg:px-6">
      <p className="spec-sm text-ink-3">AN EMPTY RAIL</p>
      <p className="display display-md max-w-[18ch]">
        Nothing hangs here <span className="aside">yet.</span>
      </p>
      <p className="max-w-[46ch] text-[0.95rem] leading-relaxed text-ink-2">
        Photograph a few things you already own — flat on a bed or on a hanger,
        it doesn&apos;t matter. Rangrez cuts each one out and renders it onto
        your avatar.
      </p>
      <button type="button" onClick={onAdd} className="btn">
        <span className="spec">Add clothes from your photos</span>
        <span aria-hidden className="spec">→</span>
      </button>
    </div>
  );
}
