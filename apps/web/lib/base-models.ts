import type { AvatarFraming } from "./types";

/**
 * ═══════════════════════════════════════════════════════════════════════════
 *  Base models — a body to borrow
 * ═══════════════════════════════════════════════════════════════════════════
 *
 *  Not everybody wants to upload a photograph of themselves, and nobody wants
 *  to before they have seen what the product does. A base model is a stock
 *  body you can dress instead: pick one, and the wardrobe, the look creator
 *  and the extension all work exactly as they would with your own plate.
 *
 *  ── the two assets, and why they are two ─────────────────────────────────
 *
 *  Each model has a *poster* and a *plate*, and they are for opposite things:
 *
 *    poster   what you look at while choosing. Drawn — the figures below are
 *             SVG, generated from proportions, no files and no network. This
 *             is the slot a 3D model drops into later: swap `poster` for a
 *             <model-viewer> or a canvas and nothing else in the product
 *             changes, because nothing else in the product reads it.
 *
 *    plate    the actual photograph sent to Apparel VTO as `src_file_id`.
 *             This has to be a real picture of a real body — the engine fits
 *             garments to anatomy it can see, and it will refuse, or worse
 *             quietly hallucinate, when handed an illustration.
 *
 *  That separation is the whole design: **the pretty thing is never the thing
 *  we submit.** A 3D model in the picker is decoration; a JPEG is the input.
 *
 *  ── adding the photographs ───────────────────────────────────────────────
 *
 *  Drop a file at `public/base-models/<id>.jpg` and that model becomes
 *  selectable — `listBaseModels()` checks the disk, so no code change and no
 *  redeploy. Until then the card shows its drawing and says it is waiting for
 *  one, rather than pretending to work and failing at the first render.
 *
 *  For a 3D asset later: `public/base-models/<id>.glb`, and teach the picker
 *  to prefer it over `poster`. The slot is reserved and unused today.
 * ═══════════════════════════════════════════════════════════════════════════
 */

export interface BaseModel {
  id: string;
  /** What the picker calls it. */
  label: string;
  /** One line on the card — the build, in words rather than numbers. */
  note: string;
  /** How much of the body the plate photograph shows. Gates the look slots. */
  framing: AvatarFraming;
  heightCm: number;
  /** Which YouCam body model its shoe/bag/hat renders go through. */
  vtoGender: "male" | "female";
  /** Proportions the drawing is generated from. Also honest documentation. */
  build: Build;
}

/**
 * Shoulder and hip as a fraction of total height, plus the head-to-height
 * ratio. Three numbers is enough to draw a recognisably different figure and
 * few enough that they can be read as a description rather than a rig.
 */
interface Build {
  /** 7 is the classical canon; 7.5–8 reads as a fashion figure. */
  heads: number;
  shoulder: number;
  hip: number;
}

export const BASE_MODELS: readonly BaseModel[] = [
  {
    id: "atlas",
    label: "Atlas",
    note: "Tall, square shoulders, full length",
    framing: "full",
    heightCm: 186,
    vtoGender: "male",
    build: { heads: 8, shoulder: 0.26, hip: 0.2 },
  },
  {
    id: "meera",
    label: "Meera",
    note: "Full length, narrow shoulder, soft hip",
    framing: "full",
    heightCm: 168,
    vtoGender: "female",
    build: { heads: 7.6, shoulder: 0.19, hip: 0.23 },
  },
  {
    id: "kabir",
    label: "Kabir",
    note: "Average build, knee up",
    framing: "knee",
    heightCm: 174,
    vtoGender: "male",
    build: { heads: 7.4, shoulder: 0.23, hip: 0.19 },
  },
  {
    id: "noor",
    label: "Noor",
    note: "Average build, full length",
    framing: "full",
    heightCm: 163,
    vtoGender: "female",
    build: { heads: 7.2, shoulder: 0.18, hip: 0.22 },
  },
  {
    id: "dev",
    label: "Dev",
    note: "Broad through the chest, full length",
    framing: "full",
    heightCm: 178,
    vtoGender: "male",
    build: { heads: 7.2, shoulder: 0.29, hip: 0.24 },
  },
  {
    id: "ira",
    label: "Ira",
    note: "Petite, head and shoulders",
    framing: "bust",
    heightCm: 156,
    vtoGender: "female",
    build: { heads: 7, shoulder: 0.19, hip: 0.21 },
  },
];

export const baseModel = (id: string | undefined) =>
  id ? BASE_MODELS.find((m) => m.id === id) : undefined;

/** Where a model's photographic plate lives, once someone has put one there. */
export const platePath = (id: string) => `/base-models/${id}.jpg`;

/**
 * Reserved. Nothing reads this yet — it is the address the 3D asset will have
 * when there is one, written down so the picker has somewhere to look.
 */
export const modelPath = (id: string) => `/base-models/${id}.glb`;

/* ── the drawing ─────────────────────────────────────────────────────────── */

const FIELD = "#E4DCCA";
const FIGURE = "#3A352B";
const PLINTH = "#6D6555";

/**
 * A figure on a plinth, generated from its build.
 *
 * Deliberately a silhouette. A drawn face would be a drawn *person*, and the
 * whole point of these cards is that you are choosing a body to borrow — an
 * illustrated stranger looking back at you is a stranger, while a silhouette
 * is a mannequin. It also means the drawing can never be mistaken for the
 * photograph, which matters when only one of them is what VTO receives.
 */
export function figureArt(model: BaseModel): string {
  const { heads, shoulder, hip } = model.build;

  // One canvas for every model so the cards line up, with the figure scaled
  // into it by its own height — a tall model genuinely reads as taller.
  const W = 300;
  const H = 420;
  const floor = H - 46;
  const top = 34;
  const bodyH = floor - top;

  const head = bodyH / heads;
  const cx = W / 2;

  const shoulderW = bodyH * shoulder;
  const hipW = bodyH * hip;
  const waistW = (shoulderW + hipW) * 0.36;

  const neckY = top + head * 1.05;
  const shoulderY = top + head * 1.35;
  const waistY = top + head * 3.1;
  const hipY = top + head * 4;
  const kneeY = top + head * 5.6;

  const p = (n: number) => Math.round(n * 10) / 10;

  // Shoulder → waist → hip, then straight down the leg. One closed path; the
  // silhouette is the drawing, so there is nothing else to get wrong.
  const torso = [
    `M ${p(cx - shoulderW / 2)} ${p(shoulderY)}`,
    `C ${p(cx - shoulderW / 2)} ${p(waistY - head)} ${p(cx - waistW / 2)} ${p(waistY - head * 0.4)} ${p(cx - waistW / 2)} ${p(waistY)}`,
    `C ${p(cx - waistW / 2)} ${p(hipY - head * 0.4)} ${p(cx - hipW / 2)} ${p(hipY - head * 0.3)} ${p(cx - hipW / 2)} ${p(hipY)}`,
    `L ${p(cx - hipW / 2.3)} ${p(floor)}`,
    `L ${p(cx - hipW / 9)} ${p(floor)}`,
    `L ${p(cx - hipW / 14)} ${p(hipY + head * 0.25)}`,
    `L ${p(cx + hipW / 14)} ${p(hipY + head * 0.25)}`,
    `L ${p(cx + hipW / 9)} ${p(floor)}`,
    `L ${p(cx + hipW / 2.3)} ${p(floor)}`,
    `L ${p(cx + hipW / 2)} ${p(hipY)}`,
    `C ${p(cx + hipW / 2)} ${p(hipY - head * 0.3)} ${p(cx + waistW / 2)} ${p(hipY - head * 0.4)} ${p(cx + waistW / 2)} ${p(waistY)}`,
    `C ${p(cx + waistW / 2)} ${p(waistY - head * 0.4)} ${p(cx + shoulderW / 2)} ${p(waistY - head)} ${p(cx + shoulderW / 2)} ${p(shoulderY)}`,
    "Z",
  ].join(" ");

  const armWidth = bodyH * 0.028;
  const arm = (side: 1 | -1) => {
    const x = cx + side * (shoulderW / 2 - bodyH * 0.012);
    const wrist = cx + side * (hipW / 2 + bodyH * 0.012);
    // Half a stroke below the shoulder line, or the round cap draws a horn
    // above the square shoulder and every figure looks like a coat hanger.
    const from = shoulderY + armWidth / 2;
    return `M ${p(x)} ${p(from)} C ${p(x + side * bodyH * 0.03)} ${p(waistY)} ${p(wrist)} ${p(hipY - head * 0.3)} ${p(wrist)} ${p(hipY + head * 0.35)}`;
  };

  // Bust framing shows only the top of the figure; the rest fades out rather
  // than being cropped, so the card still reads as a body and the difference
  // between the framings is visible at a glance.
  const fade =
    model.framing === "full"
      ? ""
      : `<rect x="0" y="${p(model.framing === "bust" ? shoulderY + head * 1.4 : kneeY)}" width="${W}" height="${H}" fill="url(#fade)"/>`;

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">
<defs>
<linearGradient id="fade" x1="0" y1="0" x2="0" y2="1">
<stop offset="0" stop-color="${FIELD}" stop-opacity="0"/>
<stop offset=".55" stop-color="${FIELD}" stop-opacity="1"/>
</linearGradient>
</defs>
<rect width="${W}" height="${H}" fill="${FIELD}"/>
<ellipse cx="${cx}" cy="${p(floor + 8)}" rx="${p(bodyH * 0.17)}" ry="9" fill="${PLINTH}" opacity=".22"/>
<rect x="${p(cx - bodyH * 0.19)}" y="${p(floor + 4)}" width="${p(bodyH * 0.38)}" height="7" fill="${PLINTH}" opacity=".5"/>
<ellipse cx="${cx}" cy="${p(top + head * 0.52)}" rx="${p(head * 0.34)}" ry="${p(head * 0.46)}" fill="${FIGURE}"/>
<rect x="${p(cx - head * 0.14)}" y="${p(neckY - head * 0.1)}" width="${p(head * 0.28)}" height="${p(head * 0.4)}" fill="${FIGURE}"/>
<path d="${torso}" fill="${FIGURE}"/>
<path d="${arm(-1)}" stroke="${FIGURE}" stroke-width="${p(armWidth)}" stroke-linecap="round" fill="none"/>
<path d="${arm(1)}" stroke="${FIGURE}" stroke-width="${p(armWidth)}" stroke-linecap="round" fill="none"/>
${fade}
</svg>`;

  return `data:image/svg+xml,${encodeURIComponent(svg.replace(/\n/g, ""))}`;
}
