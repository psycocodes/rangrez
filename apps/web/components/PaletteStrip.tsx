import type { ColorSeason } from "@/lib/types";

/** The user's flattering palette, printed as a dyer's colour card. */
export function PaletteStrip({
  season,
  compact = false,
}: {
  season: ColorSeason;
  compact?: boolean;
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3 pb-2">
        <span className="spec-sm text-ink-3">YOUR PALETTE</span>
        <span className="spec-sm text-ink-3">
          {Math.round(season.confidence * 100)}% CONFIDENCE
        </span>
      </div>

      <div className="flex h-9 gap-px bg-ink/15">
        {season.palette.map((dye) => (
          <div
            key={dye.name + dye.hex}
            className="group relative flex-1"
            style={{ backgroundColor: dye.hex }}
            title={`${dye.name} · ${dye.hex}`}
          >
            <span className="spec-sm pointer-events-none absolute -top-6 left-0 whitespace-nowrap bg-ink px-1.5 py-1 text-paper opacity-0 transition-opacity duration-300 group-hover:opacity-100">
              {dye.name}
            </span>
          </div>
        ))}
      </div>

      {!compact && (
        <p className="aside mt-3 text-[0.95rem] leading-snug text-ink-2">
          {season.note}
        </p>
      )}
    </div>
  );
}
