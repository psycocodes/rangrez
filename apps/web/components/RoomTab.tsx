import Link from "next/link";

/**
 * The pull tab between the two rooms.
 *
 * One component because there are two of them facing each other — TRIAL ROOM
 * on the wardrobe's left edge, WARDROBE on the trial room's right — and they
 * have to stay identical or the slide looks like it lands somewhere else.
 * There were three copies of this markup before, which is how one of them
 * ended up with a different emoji than the other.
 *
 * ── why it is `absolute` and not `fixed` ─────────────────────────────────
 *
 * Both rooms sit on a track that slides sideways (see ClosetRoom), and a
 * transformed ancestor becomes the containing block for `position: fixed`
 * descendants. So `fixed` here does not mean the viewport — it means the
 * track, which is twice the viewport wide. `right: 0` on a fixed tab resolved
 * to the far edge of the *other* room. Absolute against a positioned pane is
 * both correct and what was actually wanted: the tab travels with its room.
 *
 * ── why the type scales with viewport height ─────────────────────────────
 *
 * The label is set vertically, so its length is the tab's *height*. At a fixed
 * size that is ~180px of furniture pinned to the middle of the screen, and the
 * rails put their scroll arrows at the quarter and three-quarter marks — on a
 * short window the tab grew over both of them. Nothing here is a fixed pixel
 * size for that reason; at the small end the tab is ~130px and clears them.
 */
export function RoomTab({
  side,
  label,
  tone,
  href,
  onClick,
  title,
}: {
  side: "left" | "right";
  label: string;
  /** `madder` for the trial room, `brass` for the wardrobe. */
  tone: "madder" | "brass";
  href?: string;
  onClick?: () => void;
  /** The accessible name. The visible label is a destination, not a verb. */
  title: string;
}) {
  const right = side === "right";

  const palette =
    tone === "madder"
      ? "bg-[#FF5A5F] text-white hover:bg-[#FF3B42]"
      : "bg-[#FFDE59] text-[#12100d] hover:bg-[#FFE57F]";

  const className = [
    "group absolute top-1/2 z-40 flex -translate-y-1/2 flex-col items-center",
    "border-[#12100d] border-y-[3px] cursor-pointer select-none",
    "transition-[background-color,translate] duration-200",
    right
      ? "right-0 rounded-l-2xl border-l-[3px] shadow-[-4px_4px_0px_#12100d] hover:-translate-x-[3px]"
      : "left-0 rounded-r-2xl border-r-[3px] shadow-[4px_4px_0px_#12100d] hover:translate-x-[3px]",
    palette,
  ].join(" ");

  /* Every length is viewport-relative so the whole tab shrinks together. A
     clamp on the type alone would leave the padding behind and the thing would
     still be too tall on a laptop with a short window. */
  const style = {
    paddingInline: "clamp(0.4rem, 0.9vh, 0.65rem)",
    paddingBlock: "clamp(0.5rem, 1.5vh, 1rem)",
    gap: "clamp(0.3rem, 0.8vh, 0.5rem)",
  } as const;

  const inner = (
    <>
      <span
        className="font-black uppercase"
        style={{
          writingMode: "vertical-rl",
          textOrientation: "mixed",
          fontSize: "clamp(0.5rem, 1.32vh, 0.68rem)",
          letterSpacing: "clamp(0.12em, 0.35vh, 0.2em)",
        }}
      >
        {label}
      </span>
      {/* The only glyph left, and it points at where you are going rather than
          at the tab. The dashboard is home and sits on the left of the track,
          so the wardrobe's tab lives on the right edge and points right, and
          the way back lives on the left edge and points left — the side a tab
          is on is the direction it takes you. A triangle rather than an emoji
          so it takes the tab's own colour. */}
      <span
        aria-hidden
        className="font-mono font-bold leading-none transition-transform duration-200"
        style={{ fontSize: "clamp(0.46rem, 1.1vh, 0.62rem)" }}
      >
        {right ? "▶" : "◀"}
      </span>
    </>
  );

  if (href) {
    return (
      <Link href={href} aria-label={title} className={className} style={style}>
        {inner}
      </Link>
    );
  }

  return (
    <button type="button" onClick={onClick} aria-label={title} className={className} style={style}>
      {inner}
    </button>
  );
}
