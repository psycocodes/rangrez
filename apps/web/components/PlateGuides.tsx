"use client";

import { useEffect, useState } from "react";

/**
 * Tailor's rules that actually land on the body.
 *
 * They used to sit at fixed percentages of the plate — 22 / 46 / 72 — which is
 * only ever right if the subject fills the frame the way a studio shot does.
 * On a photo taken at a party they label a tree.
 *
 * So we find the person instead. The face is the one landmark that's reliably
 * detectable without a model: skin pixels cluster there, and once you know how
 * tall the head is, the rest of the body follows from proportion — roughly
 * seven and a half heads from crown to floor. Shoulders sit about a quarter of
 * a head below the chin, the natural waist near three heads down, a shirt hem
 * near four.
 *
 * If no face is found we draw nothing. A rule in the wrong place is worse than
 * no rule.
 */

const CROP_Y: Record<string, number> = {
  full: 0.5,
  "three-quarter": 0.34,
  bust: 0.18,
};

/** Kovac's RGB rule — the same one the extension uses to spot model shots. */
function isSkin(r: number, g: number, b: number): boolean {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  return (
    r > 95 && g > 40 && b > 20 &&
    max - min > 15 &&
    Math.abs(r - g) > 15 &&
    r > g && r > b
  );
}

interface Rule {
  label: string;
  /** Position down the *displayed* plate, 0–1. */
  at: number;
}

export function PlateGuides({
  src,
  crop,
  ratio = 3 / 4,
}: {
  src: string;
  crop: string;
  ratio?: number;
}) {
  const [rules, setRules] = useState<Rule[] | null>(null);

  useEffect(() => {
    let cancelled = false;

    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      if (cancelled) return;
      try {
        setRules(measure(img, crop, ratio));
      } catch {
        setRules([]); // tainted canvas or similar — draw nothing
      }
    };
    img.onerror = () => !cancelled && setRules([]);
    img.src = src;

    return () => {
      cancelled = true;
    };
  }, [src, crop, ratio]);

  if (!rules?.length) return null;

  return (
    <div aria-hidden className="pointer-events-none absolute inset-0">
      {rules.map((rule) => (
        <div
          key={rule.label}
          className="absolute left-0 right-0 flex items-center pr-2"
          style={{ top: `${rule.at * 100}%` }}
        >
          <span className="h-px flex-1 bg-paper/35" />
          <span className="spec-sm bg-paper/85 px-1 py-0.5 text-ink">
            {rule.label}
          </span>
        </div>
      ))}
      <div className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-paper/25" />
    </div>
  );
}

/* ── the measurement ────────────────────────────────────────────────────── */

function measure(img: HTMLImageElement, crop: string, ratio: number): Rule[] {
  const W = 120;
  const H = Math.max(1, Math.round((W * img.naturalHeight) / img.naturalWidth));

  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return [];
  ctx.drawImage(img, 0, 0, W, H);
  const { data } = ctx.getImageData(0, 0, W, H);

  // Skin per row. The face is the densest run near the top of the person.
  const perRow = new Array<number>(H).fill(0);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4;
      if (isSkin(data[i], data[i + 1], data[i + 2])) perRow[y]++;
    }
  }

  const busiest = Math.max(...perRow);
  if (busiest < 2) return []; // no person we can find
  const threshold = Math.max(2, busiest * 0.25);

  // Longest contiguous run of skin-bearing rows — the face, rather than a
  // stray warm-coloured object elsewhere in the frame.
  let bestStart = -1;
  let bestLen = 0;
  let start = -1;
  for (let y = 0; y <= H; y++) {
    const on = y < H && perRow[y] >= threshold;
    if (on && start === -1) start = y;
    if (!on && start !== -1) {
      if (y - start > bestLen) {
        bestLen = y - start;
        bestStart = start;
      }
      start = -1;
    }
  }
  if (bestStart < 0 || bestLen < 2) return [];

  const headTop = bestStart;
  const headHeight = bestLen;

  // Canonical proportions, in head-heights from the crown.
  const marks: Array<[string, number]> = [
    ["SHOULDER", 1.35],
    ["WAIST", 3.1],
    ["HEM", 4.3],
  ];

  // The plate crops with object-fit: cover, so map natural-image Y into the
  // visible box the same way the browser does.
  const containerW = 1;
  const containerH = containerW / ratio;
  const scale = Math.max(containerW / W, containerH / H);
  const drawnH = H * scale;
  const posY = CROP_Y[crop] ?? 0.5;
  const offsetY = (containerH - drawnH) * posY;

  return marks
    .map(([label, heads]) => {
      const yNatural = headTop + heads * headHeight;
      const at = (offsetY + yNatural * scale) / containerH;
      return { label, at };
    })
    // Anything that falls outside the visible crop is simply not drawn.
    .filter((r) => r.at > 0.04 && r.at < 0.97);
}
