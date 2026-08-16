/**
 * Canvas plumbing, shared by the two browser-side image passes (garment
 * extraction and avatar framing).
 *
 * BROWSER ONLY.
 *
 * It exists because `getContext("2d")` on `HTMLCanvasElement | OffscreenCanvas`
 * does not narrow: TypeScript resolves the union of *all* overloads and hands
 * back `RenderingContext | OffscreenCanvasRenderingContext2D`, which includes
 * `ImageBitmapRenderingContext` and therefore has no `drawImage`. Casting at
 * every call site is how that turns into five identical errors; doing it once,
 * here, with the null check the DOM signature actually requires, is how it
 * doesn't.
 */

export type AnyCanvas = HTMLCanvasElement | OffscreenCanvas;
export type Ctx2D = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

/**
 * OffscreenCanvas where it exists — it keeps pixel work off the layout path,
 * so processing a dozen photographs doesn't stutter whatever is animating.
 */
export function makeCanvas(w: number, h: number): AnyCanvas {
  if (typeof OffscreenCanvas !== "undefined") return new OffscreenCanvas(w, h);
  const el = document.createElement("canvas");
  el.width = w;
  el.height = h;
  return el;
}

export function context2d(
  canvas: AnyCanvas,
  options?: CanvasRenderingContext2DSettings,
): Ctx2D {
  const ctx = (canvas as HTMLCanvasElement).getContext("2d", options);
  if (!ctx) throw new Error("This browser wouldn't give us a canvas to work on.");
  return ctx as Ctx2D;
}

export function toJpegBlob(canvas: AnyCanvas, quality = 0.92): Promise<Blob> {
  return toBlob(canvas, "image/jpeg", quality);
}

/**
 * PNG, for anything carrying an alpha channel. A cutout saved as JPEG is a
 * cutout composited onto black, which is worse than not cutting it out.
 */
export function toPngBlob(canvas: AnyCanvas): Promise<Blob> {
  return toBlob(canvas, "image/png");
}

function toBlob(canvas: AnyCanvas, type: string, quality?: number): Promise<Blob> {
  if ("convertToBlob" in canvas) {
    return canvas.convertToBlob({ type, quality });
  }
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("Couldn't read that image."))),
      type,
      quality,
    ),
  );
}
