"use client";

import { useMemo, useState } from "react";

import { GarmentEditor } from "./GarmentActions";
import { GarmentCard, Interstitial } from "./GarmentCard";
import { GRID_INTERSTITIALS } from "@/lib/seed";
import { ZONE_LABEL, ZONES, type Garment, type Zone } from "@/lib/types";

type Filter = Zone | "all";
type Sort = "recent" | "worn" | "dye";
type Source = "all" | "shop" | "closet";

export function WardrobeGrid({ garments }: { garments: Garment[] }) {
  const [zone, setZone] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const [paletteOnly, setPaletteOnly] = useState(false);
  const [raw, setRaw] = useState(false);
  const [sort, setSort] = useState<Sort>("recent");
  const [source, setSource] = useState<Source>("all");
  const [editing, setEditing] = useState<Garment | null>(null);

  const shopCount = useMemo(
    () => garments.filter((g) => g.origin === "shop").length,
    [garments],
  );

  const counts = useMemo(() => {
    const map = { all: garments.length } as Record<Filter, number>;
    for (const z of ZONES) map[z] = garments.filter((g) => g.zone === z).length;
    return map;
  }, [garments]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = garments.filter((g) => {
      if (zone !== "all" && g.zone !== zone) return false;
      if (source === "shop" && g.origin !== "shop") return false;
      if (source === "closet" && g.origin === "shop") return false;
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
        shopCount={shopCount}
        shown={visible.length}
      />

      {visible.length === 0 ? (
        <Empty onReset={() => {
          setZone("all");
          setQuery("");
          setPaletteOnly(false);
        }} />
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
  shopCount,
  shown,
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
  shopCount: number;
  shown: number;
}) {
  return (
    <div className="sticky top-[3.3rem] z-40 border-y border-ink/15 bg-paper/92 backdrop-blur-md">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2.5 px-4 py-2.5 lg:px-6">
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

          {/* Only worth showing once the extension has actually saved something. */}
          {shopCount > 0 && (
            <Chip
              on={source !== "all"}
              onClick={() =>
                setSource(
                  source === "all" ? "shop" : source === "shop" ? "closet" : "all",
                )
              }
            >
              <span className="spec">
                {source === "shop"
                  ? "From a shop"
                  : source === "closet"
                    ? "My closet"
                    : "Any source"}
              </span>
              {source === "shop" && (
                <span className="spec-sm opacity-55">{shopCount}</span>
              )}
            </Chip>
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

function Empty({ onReset }: { onReset: () => void }) {
  return (
    <div className="flex flex-col items-start gap-5 px-4 py-24 lg:px-6">
      <p className="spec-sm text-ink-3">NOTHING ON THE RAIL</p>
      <p className="display display-md max-w-[16ch]">
        No piece answers to <span className="aside">that.</span>
      </p>
      <button type="button" onClick={onReset} className="btn btn-ghost">
        <span className="spec">Clear the filters</span>
        <span aria-hidden className="spec">
          ↺
        </span>
      </button>
    </div>
  );
}
