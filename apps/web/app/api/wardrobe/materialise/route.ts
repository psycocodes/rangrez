import { NextResponse } from "next/server";

import { requireUser } from "@/lib/auth";
import { getGarment, patchGarment } from "@/lib/db";
import { storeUpload } from "@/lib/uploads";

/**
 * POST /api/wardrobe/materialise — give a drawn piece a real address.
 *
 * The starter wardrobe is generated artwork held as `data:` URIs, which is
 * perfect for a grid and useless to Apparel VTO: the engine wants photographic
 * bytes at a fetchable address, and a data URI is neither. The browser has
 * already rasterised the drawing (lib/rasterize.ts); this stores it and points
 * the row at the file.
 *
 * Idempotent by construction — a garment whose `image_url` is already a stored
 * path is handed straight back without writing anything, so a rebuild, a
 * second tab, or two layers of the same look racing each other all settle on
 * the same URL.
 */
export async function POST(req: Request) {
  const user = await requireUser();

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Expected a multipart upload." }, { status: 400 });
  }

  const id = String(form.get("id") ?? "").trim();
  if (!id) {
    return NextResponse.json({ error: "Which piece?" }, { status: 400 });
  }

  // Scoped by user, so a guessed id belonging to someone else finds nothing.
  const garment = await getGarment(user.id, id);
  if (!garment) {
    return NextResponse.json({ error: "That piece is gone." }, { status: 404 });
  }

  // Already real. Nothing to do, and nothing to overwrite — this is what stops
  // a repeat call from replacing a genuine photograph with whatever was posted.
  if (!garment.imageUrl.startsWith("data:")) {
    return NextResponse.json({ imageUrl: garment.imageUrl, stored: false });
  }

  const image = form.get("image");
  if (!(image instanceof File) || image.size === 0) {
    return NextResponse.json({ error: "No image received." }, { status: 400 });
  }

  let stored;
  try {
    stored = await storeUpload(image);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Couldn't store that." },
      { status: 400 },
    );
  }

  // Only `image_url` is touched. The drawing is not kept as `original_url`
  // because there is nothing to keep: `garmentArt(name, zone, dye)` is a pure
  // function of three fields still on this row, so the artwork can be redrawn
  // exactly at any time. Writing it would also make this route depend on a
  // migration it has no other reason to need.
  const updated = await patchGarment(user.id, garment.id, {
    imageUrl: stored.url,
  });

  return NextResponse.json({
    imageUrl: updated?.imageUrl ?? stored.url,
    stored: true,
  });
}
