/** Shared domain types. Kept free of any storage/transport concerns. */

/** Layer of the body a garment occupies. The swipe customizer cycles per zone. */
export type Zone = "top" | "bottom" | "outerwear" | "shoes" | "accessory";

export const ZONES: readonly Zone[] = [
  "top",
  "bottom",
  "outerwear",
  "shoes",
  "accessory",
];

export const ZONE_LABEL: Record<Zone, string> = {
  top: "Tops",
  bottom: "Bottoms",
  outerwear: "Outerwear",
  shoes: "Shoes",
  accessory: "Accessories",
};

export type SeasonTag = "spring" | "summer" | "autumn" | "winter" | "yearround";

export const SEASON_LABEL: Record<SeasonTag, string> = {
  spring: "SS",
  summer: "SS",
  autumn: "AW",
  winter: "AW",
  yearround: "ALL",
};

/**
 * Apparel VTO is task-based and async: every call returns a task_id and the
 * render arrives later. Catalog items therefore carry a render lifecycle, and
 * the UI has to have a state for each one.
 */
export type RenderStatus = "queued" | "processing" | "rendered" | "failed";

/** A dye is how Rangrez names a colour — it drives the card treatment. */
export interface Dye {
  name: string;
  hex: string;
}

/** One garment in the catalog, already re-rendered onto the user's avatar. */
export interface Garment {
  id: string;
  userId: string;
  name: string;
  /** Where it was digitized from. */
  origin: "closet" | "shop" | "seed";
  zone: Zone;
  dye: Dye;
  season: SeasonTag;
  /** Free-text material note, shown on the spec line. */
  material: string;
  /** The avatar render (or placeholder). */
  imageUrl: string;
  /** Deterministic seed for placeholder photography. */
  seed: string;
  status: RenderStatus;
  /** YouCam task id, once a VTO call has been fired for this piece. */
  taskId?: string;
  /** Set by the colour-season recommender: is this inside the user's palette. */
  inPalette: boolean;
  wornCount: number;
  addedAt: string;
  /** Where a shop piece was found, so the card can link back to it. */
  sourceUrl?: string;
  updatedAt?: string;
}

/** A saved combination across zones. */
export interface SavedFit {
  id: string;
  userId: string;
  name: string;
  garmentIds: string[];
  note?: string;
  savedAt: string;
}

/** The 12-season personal colour system YouCam's analysis maps onto. */
export interface ColorSeason {
  /** e.g. "Deep Autumn" */
  name: string;
  /** warm | cool | neutral */
  temperature: "warm" | "cool" | "neutral";
  /** 0-1 confidence returned by the analysis */
  confidence: number;
  /** The flattering palette, 6 swatches. */
  palette: Dye[];
  /** Short stylist-voice note generated from the season. */
  note: string;
}

/**
 * The constant. One base photo becomes the canvas for every try-on, so that
 * a closet upload and a shop try-on land on the same body at the same scale.
 */
export interface Avatar {
  id: string;
  /** Stored path of the uploaded base photo. */
  sourceUrl: string;
  /** The processed/normalised avatar plate used as VTO `src`. */
  renderUrl: string;
  status: RenderStatus;
  taskId?: string;
  colorSeason?: ColorSeason;
  createdAt: string;
  /** User-tweakable presentation, applied everywhere the avatar appears. */
  customization: AvatarCustomization;
}

export interface AvatarCustomization {
  /** Backdrop the avatar plate is composited against. */
  backdrop: "paper" | "vat" | "madder" | "studio";
  /** How tightly the plate crops the body. */
  crop: "full" | "three-quarter" | "bust";
  /** Warm/cool grade applied to the plate, -100..100. */
  grade: number;
  /** Show the ruled measurement overlay on the plate. */
  guides: boolean;
  /** Display name printed under the plate. */
  label: string;
}

export interface User {
  id: string;
  email: string;
  name: string;
  /** Dummy auth only — see lib/auth/providers.ts for the migration seam. */
  passwordHash: string;
  createdAt: string;
  avatar?: Avatar;
  preferences: {
    fitPreference: "relaxed" | "regular" | "tailored";
    heightCm?: number;
    /** Rank palette-matching pieces first across the app. */
    paletteFirst: boolean;
    /**
     * YouCam's shoe/bag/hat endpoints require a body model and accept only
     * "male" or "female". It is an API parameter, not an identity — it is
     * surfaced in the profile so nobody is stuck with a guess.
     */
    vtoGender?: "male" | "female";
  };
}

export interface Session {
  userId: string;
  email: string;
  issuedAt: number;
}
