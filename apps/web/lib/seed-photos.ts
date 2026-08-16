import type { SeedPhoto } from "./types";

/**
 * GENERATED — do not edit. `node scripts/seed-photos.mjs` writes this.
 *
 * One entry per photographed starter piece: where the cutout lives, and the
 * colour measured off it. The colour is here rather than in lib/seed.ts
 * because the card tints itself from the garment's dye, and a card in Turmeric
 * holding a photograph of a black jacket is worse than either alone.
 *
 * Pieces with no entry fall back to the drawn art in lib/garment-art.ts.
 */
export const SEED_PHOTOS: Record<string, SeedPhoto> = {
  "boxy-heavyweight-tee": {
    "file": "/seed/boxy-heavyweight-tee.f4b1a89b.png",
    "hex": "#1950bc",
    "source": "ChrisCrossRoyalblueCottontshirtmen.jpg.webp"
  },
  "canvas-low-top": {
    "file": "/seed/canvas-low-top.f1aa0885.png",
    "hex": "#6f8295",
    "source": "p2994477.jpg"
  },
  "quilted-bomber": {
    "file": "/seed/quilted-bomber.876c24b9.png",
    "hex": "#7c9cb8",
    "source": "istockphoto-885931726-612x612.jpg"
  },
  "raw-denim-straight": {
    "file": "/seed/raw-denim-straight.3309121c.png",
    "hex": "#404a5a",
    "source": "1_6b8140c5-6f1f-4483-9452-2c5fa2f45e09.jpg.webp"
  }
};
