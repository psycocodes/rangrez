/**
 * "रंगरेज़", spelled for AMS Kartik.
 *
 * AMS Kartik is a legacy Devanagari font: no Unicode Devanagari at all, every
 * glyph hung on an ASCII slot. Typing the actual word renders nothing, so it
 * has to be spelled in that font's own keyboard layout.
 *
 * Nine characters and every one of them matters. The trailing `‼` is U+203C
 * DOUBLE EXCLAMATION MARK — not two exclamation marks — and it draws the nukta
 * under ज़. It will not survive being retyped by hand, which is exactly why
 * this is a constant and not a literal sitting in JSX.
 */
export const WORDMARK = "r/gareja‼";

/**
 * The word itself, set in the font that can render it.
 *
 * Four things are forced inline rather than left to the cascade, because each
 * one silently destroys the word if it leaks in from a parent:
 *
 *   text-transform    `.spec` and `.spec-sm` uppercase their contents. On a
 *                     normal word that is a style choice; here it would ask
 *                     the font for R/GAREJA‼ — nine *different* glyphs.
 *   letter-spacing    those same classes track at .24em, which would pull the
 *                     शिरोरेखा apart and break the conjuncts.
 *   text-orientation  in a vertical writing mode (the spine), the default
 *                     `mixed` treats U+203C as an upright character and gives
 *                     it its own 15.5px cell — so the nukta detaches and lands
 *                     beside the word instead of under ज़. `sideways` turns the
 *                     whole run as one, and the nukta goes back to zero
 *                     advance, composing with the letter. No effect at all in
 *                     horizontal text, so it is safe to set unconditionally.
 *   font-family       the whole point.
 *
 * It also always carries the real word as its accessible name: the markup is
 * meaningless ASCII to anything that isn't this font, so a screen reader would
 * otherwise announce "r slash gareja".
 */
export function Rangrez({
  className = "",
  style,
}: {
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <span
      aria-label="Rangrez"
      role="img"
      className={className}
      style={{
        fontFamily: "var(--font-kartik)",
        textTransform: "none",
        letterSpacing: "normal",
        textOrientation: "sideways",
        ...style,
      }}
    >
      {WORDMARK}
    </span>
  );
}

/**
 * The mark: three threads crossing a warp, with the dyed point at the centre.
 * Drawn rather than imported so it inherits currentColor everywhere it lands.
 */
export function Knot({ size = 14 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 14 14"
      fill="none"
      aria-hidden
      className="shrink-0"
    >
      <path d="M1 3.5h12M1 7h12M1 10.5h12" stroke="currentColor" strokeWidth="1" />
      <path d="M4.5 1v12M9.5 1v12" stroke="currentColor" strokeWidth="1" opacity="0.45" />
      <circle cx="7" cy="7" r="2.1" fill="currentColor" />
    </svg>
  );
}
