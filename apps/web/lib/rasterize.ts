import { context2d, makeCanvas, toJpegBlob } from "./canvas";
import { ART_FIELD } from "./garment-art";

/**
 * ═══════════════════════════════════════════════════════════════════════════
 *  Drawings → photographs
 * ═══════════════════════════════════════════════════════════════════════════
 *
 *  BROWSER ONLY.
 *
 *  The starter wardrobe is *drawn* — every piece is an SVG generated from its
 *  own dye (lib/garment-art.ts), which is why a card labelled "Raw Denim
 *  Straight" shows a pair of jeans rather than a stock photo of a typewriter.
 *
 *  Apparel VTO cannot use any of that. It takes bytes it can decode as a
 *  photograph, uploaded to its own bucket — an `<svg>` is not one, and a
 *  `data:` URI is not an address anything can fetch. So the first time a drawn
 *  piece is actually asked to go on a body, it gets rasterised here and stored
 *  as a real file on our own origin. From then on the garment carries an
 *  ordinary `/uploads/…` URL and nothing downstream knows it was ever
 *  otherwise.
 *
 *  Once per garment, in the browser, at the moment it is first needed:
 *
 *    · no server-side image toolchain — no sharp, no resvg, no native build
 *    · no cost at all for the pieces nobody ever tries on
 *    · the fix is permanent, because the row is patched rather than the bytes
 *      being re-derived on every render
 * ═══════════════════════════════════════════════════════════════════════════
 */

/** What VTO sees. Comfortably above the engine's needs, small enough to post. */
const OUT = 1024;

export const isDrawn = (url: string) => url.startsWith("data:image/svg+xml");

/**
 * An SVG data URI → a JPEG blob.
 *
 * Flattened rather than kept transparent, for the same reason lib/extract.ts
 * flattens: what the engine composites an alpha channel against is undefined,
 * and a garment whose background is "whatever YouCam decides" is a garment
 * whose render we cannot predict.
 *
 * Flattened onto the artwork's *own* field colour, not onto white. These
 * drawings are 4:5 and the square they go into is not, so there is always a
 * letterbox — and a beige flat-lay padded with white has a hard rectangle
 * edge around it, which is precisely the kind of false contour a try-on picks
 * up and transfers onto the body. One uniform field, no edge, nothing for the
 * engine to mistake for the garment.
 */
export async function rasterize(dataUri: string): Promise<Blob> {
  const image = new Image();
  // Same-origin data URI, but decoding is still async and Safari will not
  // give correct dimensions before load resolves.
  image.decoding = "async";

  await new Promise<void>((resolve, reject) => {
    image.onload = () => resolve();
    image.onerror = () => reject(new Error("Couldn't read that drawing."));
    image.src = dataUri;
  });

  const w = image.naturalWidth || OUT;
  const h = image.naturalHeight || OUT;
  const fit = Math.min(OUT / w, OUT / h);
  const dw = Math.max(1, Math.round(w * fit));
  const dh = Math.max(1, Math.round(h * fit));

  const canvas = makeCanvas(OUT, OUT);
  const ctx = context2d(canvas);
  ctx.fillStyle = ART_FIELD;
  ctx.fillRect(0, 0, OUT, OUT);
  ctx.drawImage(image, (OUT - dw) / 2, (OUT - dh) / 2, dw, dh);

  return toJpegBlob(canvas);
}

/**
 * Make sure a garment has an address a server can fetch, and hand back the URL.
 *
 * A no-op for anything already stored — which is every upload, every shop save
 * and every piece that has been through here once. Callers can put this in
 * front of any render without thinking about it.
 */
export async function materialise(garment: {
  id: string;
  imageUrl: string;
}): Promise<string> {
  if (!isDrawn(garment.imageUrl)) return garment.imageUrl;

  const body = new FormData();
  body.append("id", garment.id);
  body.append("image", await rasterize(garment.imageUrl), `${garment.id}.jpg`);

  const res = await fetch("/api/wardrobe/materialise", { method: "POST", body });
  const json = await res.json();
  if (!res.ok) {
    throw new Error(json.error ?? "Couldn't prepare that piece for rendering.");
  }
  return json.imageUrl as string;
}
