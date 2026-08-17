import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth";
import { backgroundMask } from "@/lib/segment";

/**
 * ═══════════════════════════════════════════════════════════════════════════
 *  The matte, as a service
 * ═══════════════════════════════════════════════════════════════════════════
 *
 *  lib/cutout.ts runs in the browser and always has. That was the right call
 *  and it is why this endpoint is shaped the way it is: the model needs a
 *  native runtime, which only exists on the server, but the *photograph* has
 *  no business making the trip. A 12MB phone picture uploaded so a mask can be
 *  computed and sent back would be slower than the flood fill it replaces, and
 *  the whole point of cutting in the browser was that nothing waits on a
 *  network.
 *
 *  So only the postage stamp travels. lib/cutout.ts already renders the source
 *  down to a ~320px probe before it looks for a background — that is what gets
 *  posted, at roughly 60KB, and what comes back is one byte per probe pixel.
 *  The mask is applied to the full-resolution image locally, exactly as it was
 *  when the fill produced it.
 *
 *  ── the contract ─────────────────────────────────────────────────────────
 *
 *    POST /api/matte?w=<n>&h=<n>   body: any image sharp can decode
 *    → 200  w×h bytes, 1 where background, 0 where subject
 *    → 204  the model is unavailable; the caller uses lib/matte.ts instead
 *
 *  1-means-background is not an arbitrary choice — it is what floodBackground
 *  returns, and every consumer downstream (subjectBox, meanColor, softenMask)
 *  was written against it. The two must stay interchangeable or the fallback
 *  is not a fallback.
 * ═══════════════════════════════════════════════════════════════════════════
 */

/** The probe is ~320px on its longest edge; this leaves room and no more. */
const MAX_EDGE = 512;

/** A 320² probe is ~60KB as PNG. Anything near a megabyte is not a probe. */
const MAX_BYTES = 4 * 1024 * 1024;

function edge(raw: string | null): number | null {
  const n = Number(raw);
  return Number.isInteger(n) && n >= 2 && n <= MAX_EDGE ? n : null;
}

export async function POST(req: Request) {
  /* Inference is not free and this decodes user-supplied images, so it is
     signed in or not at all — but explicitly 401, not `requireUser`. That
     redirects to /enter, and `fetch` follows redirects: an expired session
     would hand lib/cutout.ts the sign-in page's HTML with a status of 200. It
     checks the length and would survive, but a binary endpoint answering a
     POST with a login page is the wrong shape to leave lying around. */
  if (!(await getCurrentUser())) {
    return NextResponse.json({ error: "sign in first" }, { status: 401 });
  }

  const url = new URL(req.url);
  const w = edge(url.searchParams.get("w"));
  const h = edge(url.searchParams.get("h"));
  if (!w || !h) {
    return NextResponse.json({ error: "w and h must be 2…512" }, { status: 400 });
  }

  const body = await req.arrayBuffer();
  if (!body.byteLength || body.byteLength > MAX_BYTES) {
    return NextResponse.json({ error: "body must be 1B…4MB" }, { status: 413 });
  }

  // 204, not 500: an absent model, and an image that would not decode, are
  // both ordinary conditions here. The caller's response to either is to do
  // what it did before this endpoint existed.
  const mask = await backgroundMask(Buffer.from(body), w, h);
  if (!mask) return new NextResponse(null, { status: 204 });

  // `mask.buffer` rather than `mask`: a Uint8Array is not a BodyInit, and the
  // helper allocates its own array so the whole buffer is exactly the mask.
  return new NextResponse(mask.buffer as ArrayBuffer, {
    status: 200,
    headers: {
      "content-type": "application/octet-stream",
      "content-length": String(mask.length),
      "cache-control": "no-store",
    },
  });
}
