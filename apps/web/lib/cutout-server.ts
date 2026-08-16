import "server-only";

/**
 * The garment cutout, for the app.
 *
 * All of it lives in lib/garment-cut.ts. This file exists to put the
 * `server-only` guard in front of it — a client component importing sharp
 * should fail with "you imported a server module", not with four hundred lines
 * of libvips failing to bundle.
 *
 * The split is so scripts/seed-photos.mjs can call the identical pipeline from
 * plain node, where `server-only` throws on import by design.
 */
export {
  extractGarment,
  outfitReference,
  type GarmentCutout,
  type OutfitPiece,
  type OutfitSlot,
} from "./garment-cut.ts";
