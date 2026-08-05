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
