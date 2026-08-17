import {
  ajrakh,
  bandhani,
  cornerMotif,
  halftone,
  INK,
  mandala,
  phool,
  rays,
  wash,
  zari,
} from "@/lib/ornament";

/**
 * The ornament layer, as components.
 *
 * lib/ornament.ts makes the patterns; this puts them on the page. The split is
 * that the library is pure and testable and knows nothing about React, while
 * everything here is a `<div>` with a background — which is all a printed
 * field ever is.
 *
 * These are server components. Nothing here has state, and a pattern that
 * needed hydrating to appear would be a pattern that flashes.
 */

export type FieldKind = "ajrakh" | "phool" | "bandhani" | "zari" | "rays" | "plain";

/**
 * The printed ground behind everything.
 *
 * Rule 3 of the label grammar: the field is never empty. Two layers by
 * default — a motif that tiles, over a sunburst that doesn't — because a
 * single flat repeat reads as wallpaper, and wallpaper is what happens when
 * you add pattern without adding depth.
 */
export function Ground({
  kind = "phool",
  tone = INK.peacock,
  base = INK.leaf,
  accent,
  opacity = 0.15,
  glow = true,
  scale,
  className = "",
  style,
  children,
}: {
  kind?: FieldKind;
  /** The ink the motif is printed in. */
  tone?: string;
  /** The cloth it is printed on. */
  base?: string;
  /** The second block, where the pattern uses one. */
  accent?: string;
  opacity?: number;
  /** A sunburst under the tile. Off for surfaces that already have a focus. */
  glow?: boolean;
  scale?: number;
  className?: string;
  style?: React.CSSProperties;
  children?: React.ReactNode;
}) {
  const motif =
    kind === "ajrakh"
      ? ajrakh(tone, opacity, scale ?? 72, accent ?? INK.madder)
      : kind === "phool"
        ? phool(tone, opacity, scale ?? 104, accent ?? INK.madder)
        : kind === "bandhani"
          ? bandhani(tone, opacity, scale ?? 56)
          : kind === "zari"
            ? zari(tone, opacity, scale ?? 88)
            : kind === "rays"
              ? rays(tone, opacity)
              : null;

  // Three strata, and the order is the whole reason this reads as cloth: the
  // tile on top, a broad sunburst beneath it, the wash underneath both. The
  // wash is what stops a repeat looking like wallpaper — dyed cloth is uneven
  // at a scale far larger than its pattern, and that unevenness is the
  // difference between "printed" and "tiled".
  const layers: string[] = [];
  const sizes: string[] = [];
  const repeats: string[] = [];

  if (motif) {
    layers.push(`url("${motif}")`);
    sizes.push(kind === "rays" ? "cover" : "auto");
    repeats.push(kind === "rays" ? "no-repeat" : "repeat");
  }
  if (glow && kind !== "rays") {
    layers.push(`url("${rays(tone, opacity * 0.5)}")`);
    sizes.push("cover");
    repeats.push("no-repeat");
  }
  layers.push(wash(base));

  return (
    <div
      className={className}
      style={{
        backgroundImage: layers.join(", "),
        backgroundSize: [...sizes, "auto"].join(", "),
        backgroundPosition: "center",
        backgroundRepeat: [...repeats, "repeat"].join(", "),
        ...style,
      }}
    >
      {children}
    </div>
  );
}

/**
 * A framed panel: double rule, four corner curls.
 *
 * Rule 2 — content is enclosed, never merely stopped. The corners are one
 * motif rotated four ways rather than four drawings, so changing the ornament
 * is one edit.
 */
export function Frame({
  ink = INK.abyss,
  corner = INK.brass,
  className = "",
  style,
  children,
}: {
  ink?: string;
  corner?: string;
  className?: string;
  style?: React.CSSProperties;
  children: React.ReactNode;
}) {
  const motif = `url("${cornerMotif(corner, 0.9)}")`;
  return (
    <div
      className={`frame ${className}`}
      style={
        {
          "--frame-ink": ink,
          "--corner": motif,
          ...style,
        } as React.CSSProperties
      }
    >
      <span aria-hidden className="frame-corner" />
      <span aria-hidden className="frame-corner" />
      <span aria-hidden className="frame-corner" />
      <span aria-hidden className="frame-corner" />
      {children}
    </div>
  );
}

/**
 * A mandala behind a single focal element — the halo every label puts behind
 * its subject. Absolutely positioned and inert; the caller supplies the frame
 * of reference.
 */
export function Halo({
  tone = INK.brass,
  opacity = 0.22,
  className = "",
}: {
  tone?: string;
  opacity?: number;
  className?: string;
}) {
  return (
    <span
      aria-hidden
      className={`pointer-events-none absolute inset-0 bg-center bg-no-repeat ${className}`}
      style={{
        backgroundImage: `url("${mandala(tone, opacity)}")`,
        backgroundSize: "contain",
      }}
    />
  );
}

/**
 * The dot screen of cheap offset printing, laid over a flat colour.
 *
 * The single cheapest way to stop a fill looking like a fill. Multiplied, so
 * it darkens the ink rather than fogging it grey.
 */
export function Screen({
  tone = INK.abyss,
  opacity = 0.14,
  size = 6,
  className = "",
}: {
  tone?: string;
  opacity?: number;
  size?: number;
  className?: string;
}) {
  return (
    <span
      aria-hidden
      className={`pointer-events-none absolute inset-0 mix-blend-multiply ${className}`}
      style={{ backgroundImage: `url("${halftone(tone, opacity, size)}")` }}
    />
  );
}
