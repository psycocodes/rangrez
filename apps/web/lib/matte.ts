/**
 * ═══════════════════════════════════════════════════════════════════════════
 *  Deciding what is background — pure, so it can be tested without a browser
 * ═══════════════════════════════════════════════════════════════════════════
 *
 *  No imports, no canvas, no DOM. Pixels in, mask out. lib/cutout.ts does the
 *  drawing; everything that makes a judgement lives here, the same way the
 *  extension keeps its candidate scoring out of the service worker.
 *
 *  ── why a flood fill and not a threshold ─────────────────────────────────
 *
 *  Measuring "how far is this pixel from the backdrop colour" is enough to
 *  find a bounding box, and lib/extract.ts does exactly that. It is not enough
 *  to cut *around* something: a white shirt on a white sweep is the same
 *  colour as its background, so a colour threshold deletes the shirt.
 *
 *  Connectivity breaks the tie. The sweep touches the edge of the frame and
 *  the shirt does not, so we start at the border and only spread to
 *  neighbours that still look like backdrop. The white *inside* the shirt is
 *  never reached — the shirt's own outline stands between it and the border —
 *  and it survives.
 *
 *  This is not a segmentation model and does not pretend to be. It is very
 *  good on a plain backdrop, which is what a product shot and a decent avatar
 *  photograph both are, and the caller can tell when it has failed.
 * ═══════════════════════════════════════════════════════════════════════════
 */

/**
 * How sharply a pixel differs from the pixels either side of it.
 *
 * A central difference per channel, summed — cheap, and enough to answer the
 * only question asked of it: is there an outline here. Absolute values are
 * meaningless on their own and are always compared against the backdrop's own,
 * measured in the same units at the same time.
 */
function gradientMap(data: Uint8ClampedArray, w: number, h: number): Float32Array {
  const grad = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const at = y * w + x;
      const l = x > 0 ? (at - 1) * 4 : at * 4;
      const r = x < w - 1 ? (at + 1) * 4 : at * 4;
      const u = y > 0 ? (at - w) * 4 : at * 4;
      const d = y < h - 1 ? (at + w) * 4 : at * 4;
      let sum = 0;
      for (let c = 0; c < 3; c++) {
        sum += Math.abs(data[r + c] - data[l + c]) + Math.abs(data[d + c] - data[u + c]);
      }
      grad[at] = sum;
    }
  }
  return grad;
}

/**
 * The faintest outline we will ever treat as an outline.
 *
 * Below this is JPEG ringing on a flat sweep, which sits around 15–20 at an
 * 8×8 block boundary. A white shirt against a white backdrop still throws two
 * or three times that at its hem, because a garment casts a shadow and a
 * backdrop does not.
 */
const MIN_EDGE = 26;

/** How far above the backdrop's own worst noise an edge has to stand. */
const EDGE_HEADROOM = 1.7;

/**
 * Marks every pixel reachable from the frame's edge without crossing something
 * that stops looking like the background.
 *
 * The tolerance adapts to how uniform the border actually is. A seamless
 * studio sweep deviates by almost nothing, so a tight tolerance is safe and
 * keeps the fill from leaking through a shadow. A photograph taken against a
 * patterned wall deviates a lot, and a tight tolerance there would find
 * nothing at all — so it widens, up to a ceiling past which we are no longer
 * removing a background, we are removing whatever we feel like.
 *
 * ── why colour alone is not enough ───────────────────────────────────────
 *
 * Connectivity is supposed to save the white shirt on the white sweep: the
 * shirt's outline stands between its interior and the border, so the fill
 * never reaches inside. That argument holds only if the outline is unbroken
 * *in colour*, and on a white-on-white photograph it very often isn't — a few
 * pixels somewhere along the hem read as backdrop, the fill threads through
 * the gap, and from the inside the whole garment is within tolerance. It does
 * not nibble an edge; it takes the shirt. That is the failure this pass exists
 * for, and it was the single worst thing the cutout did.
 *
 * So the fill has to clear two bars, not one: look like the backdrop, *and*
 * not sit on an edge. The edge bar is set from the backdrop's own gradient —
 * whatever noise the sweep already carries cannot stop the fill, by
 * construction — so a busy background degrades to the old behaviour rather
 * than to a fill that refuses to start.
 */
export function floodBackground(
  data: Uint8ClampedArray,
  w: number,
  h: number,
): Uint8Array {
  const px = (x: number, y: number) => (y * w + x) * 4;

  // The border, as one population.
  const border: number[] = [];
  for (let x = 0; x < w; x++) {
    border.push(px(x, 0), px(x, h - 1));
  }
  for (let y = 1; y < h - 1; y++) {
    border.push(px(0, y), px(w - 1, y));
  }

  const mean = [0, 1, 2].map(
    (c) => border.reduce((s, i) => s + data[i + c], 0) / border.length,
  );
  const spread = Math.sqrt(
    border.reduce((s, i) => {
      const d =
        (data[i] - mean[0]) ** 2 +
        (data[i + 1] - mean[1]) ** 2 +
        (data[i + 2] - mean[2]) ** 2;
      return s + d;
    }, 0) / border.length,
  );

  const loosest = Math.min(132, Math.max(46, 42 + spread * 1.15));

  const delta = (i: number) =>
    Math.abs(data[i] - mean[0]) +
    Math.abs(data[i + 1] - mean[1]) +
    Math.abs(data[i + 2] - mean[2]);

  // The edge bar, in the backdrop's own units: the ninetieth percentile of the
  // border's gradient with headroom on top. Taken from the border rather than
  // the whole frame because the whole frame contains the garment, and a
  // garment's outline is exactly the population we are trying to exclude.
  const grad = gradientMap(data, w, h);
  // The ninety-ninth percentile, not the ninetieth. At the ninetieth, one
  // border pixel in ten is above the bar by definition, and on a backdrop with
  // any texture at all those blocked pixels percolate into a wall the fill
  // cannot get through — a noisy background stopped being removed at all. The
  // bar has to sit above essentially every gradient the backdrop itself
  // produces, so that only a genuine outline is ever an outline.
  const borderGrad = border.map((i) => grad[i / 4]).sort((a, b) => a - b);
  const p99 = borderGrad[Math.floor(borderGrad.length * 0.99)] ?? 0;
  const edgeLimit = Math.max(MIN_EDGE, p99 * EDGE_HEADROOM);

  const fill = (tolerance: number): Uint8Array => {
    const mask = new Uint8Array(w * h);
    // A plain array used as a stack beats a shift()-based queue by a wide
    // margin here; the order pixels come out in makes no difference.
    const stack: number[] = [];

    const push = (x: number, y: number) => {
      const at = y * w + x;
      if (mask[at]) return;
      if (delta(at * 4) >= tolerance) return;
      if (grad[at] > edgeLimit) return;
      mask[at] = 1;
      stack.push(at);
    };

    for (let x = 0; x < w; x++) {
      push(x, 0);
      push(x, h - 1);
    }
    for (let y = 0; y < h; y++) {
      push(0, y);
      push(w - 1, y);
    }

    while (stack.length) {
      const at = stack.pop() as number;
      const x = at % w;
      const y = (at - x) / w;
      if (x > 0) push(x - 1, y);
      if (x < w - 1) push(x + 1, y);
      if (y > 0) push(x, y - 1);
      if (y < h - 1) push(x, y + 1);
    }

    return mask;
  };

  const tolerance = chooseTolerance(fill, loosest, w, h);
  const mask = fill(tolerance);

  sealLeaks(mask, w, h);
  trimEdgeFringe(data, mask, w, h, mean, tolerance);
  fillEnclosedPockets(data, mask, w, h, mean, tolerance);
  return mask;
}

/** Tolerances tried, tightest first. Anything above the adaptive cap is cut. */
const LEVELS = [14, 20, 27, 36, 48, 64, 84, 110, 132];

/**
 * How much of the two outer rings has to go before we call the backdrop gone.
 *
 * Relative to the best any tolerance manages, not to 1, because a garment that
 * runs off the edge of the frame occupies part of the border permanently and
 * no tolerance will ever clear it.
 */
const CLEARED = 0.985;

/**
 * The tightest tolerance that actually gets rid of the background.
 *
 * One adaptive number cannot serve both a navy coat on white — where anything
 * up to 130 is safe and a wide tolerance gives the cleanest edge — and a white
 * shirt on white, where 46 removes the shirt. Measured on the real
 * photographs: a white tee on a near-white sweep goes from 41% of the frame
 * removed at 16, to 52% at 22, to 87% at 40. Somewhere in there it stopped
 * removing backdrop and started removing shirt, and no property of the number
 * itself says where.
 *
 * What does say is the backdrop. Sweep from tight to loose and stop the moment
 * the outer rings of the frame are clear: at that point every pixel we came
 * for is gone, and every further widening can only reach *inward*, into the
 * garment. It is the one stopping rule that needs no guess about how much of
 * the picture the garment ought to occupy.
 *
 * Two rings rather than one — the outermost, and one inset a tenth of the way
 * in — because a sweep is often lit brightest at the edges, and clearing the
 * outermost pixels alone can leave a band of shadow standing just behind them.
 */
function chooseTolerance(
  fill: (tolerance: number) => Uint8Array,
  loosest: number,
  w: number,
  h: number,
): number {
  const ring: number[] = [];
  const inset = Math.max(1, Math.round(Math.min(w, h) * 0.1));
  for (const d of [0, inset]) {
    for (let x = d; x < w - d; x++) {
      ring.push(d * w + x, (h - 1 - d) * w + x);
    }
    for (let y = d + 1; y < h - 1 - d; y++) {
      ring.push(y * w + d, y * w + (w - 1 - d));
    }
  }

  const levels = LEVELS.filter((t) => t <= loosest);
  if (!levels.length) levels.push(loosest);

  const cleared = levels.map((t) => {
    const mask = fill(t);
    let hit = 0;
    for (const at of ring) hit += mask[at];
    return hit / ring.length;
  });

  const target = Math.max(...cleared) * CLEARED;
  const i = cleared.findIndex((c) => c >= target);
  return levels[i < 0 ? levels.length - 1 : i];
}

/** Half-width of the widest gap a leak is allowed to have squeezed through. */
const LEAK_RADIUS = 2;

/**
 * Undoes anything the fill reached through a gap narrower than it is wide.
 *
 * The edge bar catches a *faint* outline. It cannot catch a **broken** one:
 * where three pixels of a hem genuinely read as backdrop there is no gradient
 * to find, the fill threads through, and on the far side of the hole every
 * pixel of a white garment is within tolerance. That single case — a hole a
 * few pixels wide — is what a white shirt on a white sweep actually fails on,
 * and it takes the whole shirt.
 *
 * The tell is not colour, it is shape: real background is *broadly* connected
 * to the frame edge, and a leak hangs off a thread. So erode the background by
 * a couple of pixels, which severs any neck that thin, keep only what still
 * reaches the border, and grow it back inside its original bounds. Background
 * that came in through the front door survives untouched; anything that came
 * through a pinhole is put back.
 *
 * The cost is that a genuinely narrow channel of backdrop — a gap under an arm
 * pressed to a side — is put back as garment. It is bounded at four pixels of
 * width on a 320px matte, which is narrower than any real gap between two
 * limbs, and fillEnclosedPockets gets a second look at it afterwards anyway.
 */
function sealLeaks(mask: Uint8Array, w: number, h: number): void {
  // ── close the speckle first.
  //
  // A grainy backdrop leaves pinholes all through the background mask — single
  // pixels that missed the colour bar. Eroding that directly is fatal: every
  // pinhole eats its own neighbourhood, and on a backdrop a fifth of which is
  // grain there is nothing left to reconstruct from, so the whole background
  // survives as "garment". A 3×3 majority closes a pinhole (eight of nine
  // neighbours outvote it) and leaves a three-pixel neck standing, which is
  // the width this pass exists to sever.
  const solid = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let bg = 0;
      let n = 0;
      for (let dy = -1; dy <= 1; dy++) {
        const yy = y + dy;
        if (yy < 0 || yy >= h) continue;
        for (let dx = -1; dx <= 1; dx++) {
          const xx = x + dx;
          if (xx < 0 || xx >= w) continue;
          n++;
          bg += mask[yy * w + xx];
        }
      }
      solid[y * w + x] = bg * 2 > n ? 1 : 0;
    }
  }

  // ── erode: background only where the neighbourhood is all background.
  // Outside the frame counts as background, so the border itself never wears
  // away — it is the one place we are certain about.
  const eroded = solid;
  for (let pass = 0; pass < LEAK_RADIUS; pass++) {
    const was = eroded.slice();
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const at = y * w + x;
        if (!was[at]) continue;
        const solid =
          (x === 0 || was[at - 1]) &&
          (x === w - 1 || was[at + 1]) &&
          (y === 0 || was[at - w]) &&
          (y === h - 1 || was[at + w]);
        if (!solid) eroded[at] = 0;
      }
    }
  }

  // ── keep only what the frame edge can still reach.
  const rooted = new Uint8Array(w * h);
  const stack: number[] = [];
  const seed = (at: number) => {
    if (!eroded[at] || rooted[at]) return;
    rooted[at] = 1;
    stack.push(at);
  };
  for (let x = 0; x < w; x++) {
    seed(x);
    seed((h - 1) * w + x);
  }
  for (let y = 0; y < h; y++) {
    seed(y * w);
    seed(y * w + w - 1);
  }
  while (stack.length) {
    const at = stack.pop() as number;
    const x = at % w;
    const y = (at - x) / w;
    if (x > 0) seed(at - 1);
    if (x < w - 1) seed(at + 1);
    if (y > 0) seed(at - w);
    if (y < h - 1) seed(at + w);
  }

  // ── grow back, but only over pixels the fill had already claimed.
  for (let pass = 0; pass < LEAK_RADIUS; pass++) {
    const was = rooted.slice();
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const at = y * w + x;
        if (rooted[at] || !mask[at]) continue;
        if (
          (x > 0 && was[at - 1]) ||
          (x < w - 1 && was[at + 1]) ||
          (y > 0 && was[at - w]) ||
          (y < h - 1 && was[at + w])
        ) {
          rooted[at] = 1;
        }
      }
    }
  }

  mask.set(rooted);
}

/**
 * The two pixels of backdrop the edge barrier leaves behind.
 *
 * The fill halts at the *first* pixel of the outline, and an outline has a
 * ramp — so it halts a pixel or two before the garment actually starts, and
 * those pixels are still backdrop. Left alone they survive the matte as a pale
 * halo, which after the blur in softenMask is three to six pixels wide in the
 * finished cutout and is the first thing you notice about a dark garment.
 *
 * So: two passes, each stepping exactly one pixel inward from what was
 * background at the start of that pass, and only over pixels that are a much
 * closer match to the backdrop than the fill itself demanded. Two, and
 * snapshotted, because the whole danger is a rule like this cascading — an
 * unbounded version is just the leak we built the barrier to stop. On a
 * garment that genuinely is the colour of its backdrop this shaves a pixel or
 * two off the outline, which the soft edge absorbs and nobody can see; on a
 * garment that isn't, it removes a halo everybody can.
 */
function trimEdgeFringe(
  data: Uint8ClampedArray,
  mask: Uint8Array,
  w: number,
  h: number,
  mean: number[],
  tolerance: number,
): void {
  // How far the subject sits from the backdrop decides how hard we may trim.
  //
  // Against a navy coat on white there is no risk at all: nothing two pixels
  // inside the outline can be mistaken for the sweep, and two passes take the
  // halo off cleanly. Against a white shirt on white every pixel of the
  // garment is a candidate, and two passes is enough to sever a shoelace. So
  // the reach is set by the one measurement that separates those cases.
  let sum = 0;
  let subject = 0;
  for (let at = 0; at < mask.length; at++) {
    if (mask[at]) continue;
    const i = at * 4;
    sum +=
      Math.abs(data[i] - mean[0]) +
      Math.abs(data[i + 1] - mean[1]) +
      Math.abs(data[i + 2] - mean[2]);
    subject++;
  }
  const distinct = subject ? sum / subject : 0;
  const bold = distinct > 90;

  const strict = tolerance * (bold ? 0.6 : 0.45);
  const near = (at: number) => {
    const i = at * 4;
    return (
      Math.abs(data[i] - mean[0]) +
        Math.abs(data[i + 1] - mean[1]) +
        Math.abs(data[i + 2] - mean[2]) <
      strict
    );
  };

  for (let pass = 0; pass < (bold ? 2 : 1); pass++) {
    const was = mask.slice();
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const at = y * w + x;
        if (was[at] || !near(at)) continue;
        const touching =
          (x > 0 && was[at - 1]) ||
          (x < w - 1 && was[at + 1]) ||
          (y > 0 && was[at - w]) ||
          (y < h - 1 && was[at + w]);
        if (touching) mask[at] = 1;
      }
    }
  }
}

/**
 * The triangle between an arm and a torso.
 *
 * Connectivity is what makes the fill safe, and it is also its one blind spot:
 * a region of genuine background that the subject has closed off — hand on
 * hip, a sleeve resting against the body, the loop of a handle — is never
 * reached from the border, so it survives as if it were part of the garment.
 *
 * Two conditions before we take one out, both necessary:
 *
 *   · it is *small*. A white shirt photographed on a white sweep has an
 *     interior that also looks like the background and is also unreachable —
 *     the difference between that and an armpit is size, and nothing else.
 *   · it is a *closer* match to the backdrop than the main fill demanded.
 *     A printed white logo on a white-ish tee is the case that would punch a
 *     hole through a garment, so the bar to delete something enclosed is
 *     deliberately higher than the bar to delete something at the edge.
 */
function fillEnclosedPockets(
  data: Uint8ClampedArray,
  mask: Uint8Array,
  w: number,
  h: number,
  mean: number[],
  tolerance: number,
): void {
  // 3% of the frame was far too generous. The white midsole of a trainer, the
  // white panel of a graphic tee, the inside of a buckle — all enclosed, all
  // the colour of a white sweep, all comfortably under 3%, and all deleted,
  // which is what put magenta through the sole of every white shoe in the
  // wardrobe. A gap between an arm and a torso is a fraction of that.
  // The window is narrower than it looks. The gap between a bent arm and a
  // hip — the case this whole pass exists for — measures 1.3% of its frame in
  // test/cutout.test.mjs, so the ceiling cannot go below about 1.4%; and a
  // white midsole starts around 6%. 1.5% sits in the gap between them with
  // room on both sides.
  const MAX_POCKET = 0.015;
  const limit = Math.floor(w * h * MAX_POCKET);
  const strict = tolerance * 0.4;

  const seen = new Uint8Array(w * h);
  const near = (i: number, within: number) =>
    Math.abs(data[i] - mean[0]) +
      Math.abs(data[i + 1] - mean[1]) +
      Math.abs(data[i + 2] - mean[2]) <
    within;

  for (let start = 0; start < mask.length; start++) {
    if (mask[start] || seen[start] || !near(start * 4, strict)) continue;

    const region: number[] = [];
    const stack = [start];
    seen[start] = 1;
    let escaped = false;

    while (stack.length) {
      const at = stack.pop() as number;

      // Past the size limit it is not a pocket, it is the subject — but the
      // walk has to run to the end regardless. Breaking out here left most of
      // the region unvisited, so the outer loop started again inside it and
      // traced whatever thin fragments `seen` had left behind; each of those
      // came in under the limit and was duly deleted. On a garment whose own
      // colour is near the backdrop's that is the entire interior, and it came
      // out ruled with one-pixel stripes of nothing. Costs one more pass over
      // a region we were walking anyway.
      if (!escaped) {
        region.push(at);
        if (region.length > limit) {
          escaped = true;
          region.length = 0;
        }
      }

      const x = at % w;
      const y = (at - x) / w;
      const step = (nx: number, ny: number) => {
        const next = ny * w + nx;
        if (seen[next] || mask[next]) return;
        if (!near(next * 4, strict)) return;
        seen[next] = 1;
        stack.push(next);
      };
      if (x > 0) step(x - 1, y);
      if (x < w - 1) step(x + 1, y);
      if (y > 0) step(x, y - 1);
      if (y < h - 1) step(x, y + 1);
    }

    if (!escaped) for (const at of region) mask[at] = 1;
  }
}

/* ═══ WHERE IN THE PICTURE THE GARMENT IS ══════════════════════════════════
 *
 *  Taking the backdrop out is not the whole job. A shop's best photograph is
 *  very often a model wearing the piece, and a wardrobe card showing a person
 *  from the crown of their head to their shoes is a picture of a person — you
 *  cannot tell the shirt from the trousers, and it reads as somebody's avatar
 *  rather than as a garment you own.
 *
 *  So after the matte we ask a second question: which horizontal band of this
 *  subject is the thing we were actually shopping for. The signal is skin.
 *  A face is the one region of a clothed body that is reliably bare, reliably
 *  near the top, and reliably *not* the garment — and it is also the single
 *  feature that makes a card read as a portrait.
 *
 *  This is deliberately not segmentation. It answers one question — where does
 *  the head stop — and refuses to reframe at all when it cannot answer it,
 *  because a wrong crop beheads a flat lay and a missing crop merely leaves us
 *  where we already were.
 * ═════════════════════════════════════════════════════════════════════════ */

/**
 * Kovac's RGB skin rule. Cheap, decades old, and wrong at the margins — but we
 * are not identifying anybody, only asking "is this row mostly bare", and it
 * holds across skin tones far better than any threshold on lightness would.
 */
export function isSkin(r: number, g: number, b: number): boolean {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  return (
    r > 95 && g > 40 && b > 20 &&
    max - min > 15 &&
    Math.abs(r - g) > 15 &&
    r > g && r > b
  );
}

export interface SkinProfile {
  /** Skin as a share of every subject pixel, 0–1. */
  share: number;
  /** Per image row, skin as a share of *that row's* subject pixels. */
  rows: Float32Array;
}

/**
 * Per-row skin, measured over the subject only.
 *
 * Measuring against the whole row would make the answer depend on how much
 * empty backdrop happened to be either side of the model, which is a property
 * of the photographer's framing and not of the person.
 */
export function skinProfile(
  data: Uint8ClampedArray,
  mask: Uint8Array,
  w: number,
  h: number,
): SkinProfile {
  const rows = new Float32Array(h);
  let subject = 0;
  let skin = 0;

  for (let y = 0; y < h; y++) {
    let rowSubject = 0;
    let rowSkin = 0;
    for (let x = 0; x < w; x++) {
      const at = y * w + x;
      if (mask[at]) continue;
      rowSubject++;
      const i = at * 4;
      if (isSkin(data[i], data[i + 1], data[i + 2])) rowSkin++;
    }
    rows[y] = rowSubject ? rowSkin / rowSubject : 0;
    subject += rowSubject;
    skin += rowSkin;
  }

  return { share: subject ? skin / subject : 0, rows };
}

export interface Box {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  /** Subject pixels found. Zero means the mask ate everything. */
  hits: number;
}

/**
 * Everything smaller than this share of the biggest piece of subject is
 * printing on the backdrop, not part of what was photographed.
 *
 * A pair of shoes is two blobs of roughly equal size and both are the subject.
 * A stock library's watermark, a price sticker, a caption under a flat lay, a
 * speck of dust on the sweep — all of them are orders of magnitude smaller
 * than the garment, and all of them used to widen the bounding box and end up
 * inside the cutout. A jacket arrived in the wardrobe with "shutterstock.com"
 * printed under it, which is what prompted this.
 */
const SPECK = 0.08;

/**
 * The bounding box of the subject — meaning the garment, not every mark on the
 * paper it was photographed on.
 *
 * Built from connected blobs rather than from a straight sweep for the
 * pixels that aren't background, so a caption sitting in the corner can be
 * told apart from the thing being sold. Anything comparable in size to the
 * largest blob is kept, so a photograph of two shoes stays a photograph of two
 * shoes.
 */
export function subjectBox(mask: Uint8Array, w: number, h: number): Box {
  // Label every blob of subject, remembering its extent and its size.
  const seen = new Uint8Array(w * h);
  const blobs: Array<Box & { size: number }> = [];

  for (let start = 0; start < mask.length; start++) {
    if (mask[start] || seen[start]) continue;

    const stack = [start];
    seen[start] = 1;
    let minX = w, minY = h, maxX = -1, maxY = -1, size = 0;

    while (stack.length) {
      const at = stack.pop() as number;
      const x = at % w;
      const y = (at - x) / w;
      size++;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;

      const step = (nx: number, ny: number) => {
        const next = ny * w + nx;
        if (seen[next] || mask[next]) return;
        seen[next] = 1;
        stack.push(next);
      };
      if (x > 0) step(x - 1, y);
      if (x < w - 1) step(x + 1, y);
      if (y > 0) step(x, y - 1);
      if (y < h - 1) step(x, y + 1);
    }

    blobs.push({ minX, minY, maxX, maxY, hits: size, size });
  }

  // Everything was background. Hand back the whole frame rather than an
  // inverted box the caller has to know to check for.
  if (!blobs.length) {
    return { minX: 0, minY: 0, maxX: w - 1, maxY: h - 1, hits: 0 };
  }

  const biggest = blobs.reduce((a, b) => (b.size > a.size ? b : a));
  const kept = blobs.filter((b) => b.size >= biggest.size * SPECK);

  return kept.reduce<Box>(
    (box, b) => ({
      minX: Math.min(box.minX, b.minX),
      minY: Math.min(box.minY, b.minY),
      maxX: Math.max(box.maxX, b.maxX),
      maxY: Math.max(box.maxY, b.maxY),
      hits: box.hits + b.size,
    }),
    { minX: w, minY: h, maxX: -1, maxY: -1, hits: 0 },
  );
}

/**
 * Average colour of the subject between two rows — the piece's dye.
 *
 * Bounded by row rather than taken over the whole subject, because on a model
 * shot the whole subject includes a face and two hands, and a shirt whose
 * recorded colour has been averaged with somebody's forearms is a shirt that
 * lands in the wrong place in the palette ranking.
 */
export function meanColor(
  data: Uint8ClampedArray,
  mask: Uint8Array,
  w: number,
  h: number,
  fromY = 0,
  toY = h - 1,
): string {
  const sum = [0, 0, 0];
  let hits = 0;

  for (let y = Math.max(0, fromY); y <= Math.min(h - 1, toY); y++) {
    for (let x = 0; x < w; x++) {
      const at = y * w + x;
      if (mask[at]) continue;
      const i = at * 4;
      sum[0] += data[i];
      sum[1] += data[i + 1];
      sum[2] += data[i + 2];
      hits++;
    }
  }

  if (!hits) return "#6d6555";
  return (
    "#" +
    sum
      .map((c) => Math.round(c / hits).toString(16).padStart(2, "0"))
      .join("")
  );
}

/** Which part of a body the piece is worn on. */
export type GarmentBand = "upper" | "lower" | "full" | "feet" | "head";

/** A row this bare is face, neck, forearm or leg — not cloth. */
const BARE = 0.35;
/** Fewer rows than this above the bar is a warm-toned pattern, not a face. */
const FACE_ROWS = 3;

/**
 * The last row of the head, or null if there is no head in this photograph.
 *
 * Searched only in the top 45% of the subject: a face lower than that is not
 * the wearer's, it is a print on the fabric. Hair defeats a scan that expects
 * the head to *start* bare, which is why this looks for the deepest bare row
 * rather than the shallowest — the chin and neck are the bottom of the run,
 * and cutting there lands on the collarbone.
 */
function faceBottom(rows: Float32Array, minY: number, maxY: number): number | null {
  const limit = Math.min(maxY, minY + Math.round((maxY - minY + 1) * 0.45));
  let count = 0;
  let last: number | null = null;

  for (let y = minY; y <= limit; y++) {
    if (rows[y] > BARE) {
      count++;
      last = y;
    }
  }
  return count >= FACE_ROWS ? last : null;
}

/** The top of a sustained bare run below the waist — bare legs, so: the hem. */
function legTop(rows: Float32Array, minY: number, maxY: number): number | null {
  const from = minY + Math.round((maxY - minY + 1) * 0.5);
  let run = 0;
  for (let y = from; y <= maxY; y++) {
    if (rows[y] > BARE) {
      run++;
      if (run >= FACE_ROWS) return y - run + 1;
    } else {
      run = 0;
    }
  }
  return null;
}

/**
 * The rows worth keeping, given what we were shopping for.
 *
 * Returns the whole subject unchanged whenever no face was found. That covers
 * a flat lay, a folded stack, a detail crop and a photograph of a garment on a
 * hanger — every case where there is nothing to trim and a confident guess
 * would take the collar off.
 */
export function garmentWindow(
  profile: SkinProfile,
  box: Pick<Box, "minY" | "maxY">,
  band: GarmentBand,
): { top: number; bottom: number } {
  const { minY, maxY } = box;
  const height = maxY - minY + 1;
  const whole = { top: minY, bottom: maxY };

  const face = faceBottom(profile.rows, minY, maxY);
  if (face === null) return whole;

  const at = (fraction: number) => minY + Math.round(height * fraction);

  let top = minY;
  let bottom = maxY;
  switch (band) {
    case "upper":
      // Below the chin, down to the hem — read off bare legs where there are
      // any, and otherwise assumed, because a shirt over trousers gives no
      // signal at all about where one stops and the other starts.
      top = face + 1;
      bottom = Math.min(maxY, legTop(profile.rows, minY, maxY) ?? at(0.72));
      break;
    case "lower":
      // The waist sits near the middle of a standing figure. Taking the later
      // of that and the chin keeps a half-body shot from losing its subject.
      top = Math.max(face + 1, at(0.42));
      break;
    case "full":
      // A dress or a co-ord runs the length of the body; only the head goes.
      top = face + 1;
      break;
    case "feet":
      top = at(0.8);
      break;
    case "head":
      // A hat, a pair of earrings: the one band where the head *is* the point.
      bottom = Math.min(maxY, face);
      break;
  }

  // A window this thin means the reasoning above met a photograph it doesn't
  // describe. Keep the whole subject rather than a sliver of it.
  if (bottom - top + 1 < height * 0.12) return whole;
  return { top, bottom };
}

/**
 * Take the wearer's arms, neck and legs out of the band we kept.
 *
 * Cropping to the garment's band leaves a shirt with two forearms either side
 * of it and a slice of neck on top. It is a great deal better than a whole
 * person, and it still isn't a shirt.
 *
 * The same insight that makes the backdrop flood safe works a second time
 * here: a limb *enters* the frame from outside it. Arms come in at the sides,
 * the neck at the top, legs at the bottom — so seeding at the border of the
 * band and spreading only through bare pixels reaches every limb and reaches
 * nothing in the middle. A skin-toned print, a tan panel, a beige button
 * placket: all unreachable, all kept, because a garment's own detail does not
 * touch the edge of the crop and is not connected to anything that does.
 *
 * Not safe unconditionally, which is why it is a separate call the caller has
 * to opt into: on a photograph of a camel coat every pixel is "bare", the
 * seeds land on the coat, and the fill takes the garment. The caller's job is
 * to check that skin is a minority before asking for this.
 *
 * Mutates `mask` in place and returns how many pixels it claimed.
 */
export function removeBareLimbs(
  data: Uint8ClampedArray,
  mask: Uint8Array,
  w: number,
  h: number,
  fromY = 0,
  toY = h - 1,
): number {
  const top = Math.max(0, fromY);
  const bottom = Math.min(h - 1, toY);
  const stack: number[] = [];
  const seen = new Uint8Array(w * h);
  let taken = 0;

  // Backdrop is walked *through* rather than stopped at. An arm does not touch
  // the edge of the frame — there is a strip of sweep between the two — so a
  // fill that halted at the first background pixel would never leave the
  // border it started on. Cloth is what stops it, and only cloth.
  const push = (x: number, y: number) => {
    if (y < top || y > bottom) return;
    const at = y * w + x;
    if (seen[at]) return;
    seen[at] = 1;

    if (!mask[at]) {
      const i = at * 4;
      if (!isSkin(data[i], data[i + 1], data[i + 2])) return; // cloth: stop
      mask[at] = 1;
      taken++;
    }
    stack.push(at);
  };

  for (let x = 0; x < w; x++) {
    push(x, top);
    push(x, bottom);
  }
  for (let y = top; y <= bottom; y++) {
    push(0, y);
    push(w - 1, y);
  }

  while (stack.length) {
    const at = stack.pop() as number;
    const x = at % w;
    const y = (at - x) / w;
    if (x > 0) push(x - 1, y);
    if (x < w - 1) push(x + 1, y);
    if (y > top) push(x, y - 1);
    if (y < bottom) push(x, y + 1);
  }

  return taken;
}

/**
 * Background mask → alpha channel, with a soft edge.
 *
 * A 3×3 box blur, then a curve that pushes anything mostly-opaque to fully
 * opaque. Without the curve the blur fogs the whole garment slightly; with it,
 * only the two or three pixels either side of the outline are partial, which
 * is what an edge is supposed to look like.
 */
export function softenMask(mask: Uint8Array, w: number, h: number): Uint8Array {
  const alpha = new Uint8Array(w * h);
  for (let i = 0; i < mask.length; i++) alpha[i] = mask[i] ? 0 : 255;

  const blurred = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let sum = 0;
      let n = 0;
      for (let dy = -1; dy <= 1; dy++) {
        const yy = y + dy;
        if (yy < 0 || yy >= h) continue;
        for (let dx = -1; dx <= 1; dx++) {
          const xx = x + dx;
          if (xx < 0 || xx >= w) continue;
          sum += alpha[yy * w + xx];
          n++;
        }
      }
      const v = sum / n;
      // Opaque stays opaque; clear stays clear; only the boundary ramps.
      blurred[y * w + x] = v > 216 ? 255 : v < 40 ? 0 : v;
    }
  }
  return blurred;
}
