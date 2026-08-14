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

/**
 * Where a piece came from. This is the tag the wardrobe's source filter keys
 * off, so each value has to mean exactly one route into the catalog:
 *
 *   upload  photographed by the user and uploaded from the dashboard
 *   shop    saved by the browser extension off a product page
 *   closet  added by hand
 *   seed    the demo starter wardrobe, clearable from the profile
 */
export type Origin = "upload" | "shop" | "closet" | "seed";

export const ORIGIN_LABEL: Record<Origin, string> = {
  upload: "Uploaded",
  shop: "From a shop",
  closet: "Added by hand",
  seed: "Starter",
};

/** One garment in the catalog, already re-rendered onto the user's avatar. */
export interface Garment {
  id: string;
  userId: string;
  name: string;
  /** Where it was digitized from. */
  origin: Origin;
  zone: Zone;
  dye: Dye;
  season: SeasonTag;
  /** Free-text material note, shown on the spec line. */
  material: string;
  /**
   * The garment as it hangs: for an upload, the extracted cutout on white; for
   * a shop save, the VTO render itself; for a seed, placeholder photography.
   */
  imageUrl: string;
  /**
   * The same piece worn by the avatar. Uploads carry both images, and the grid
   * crossfades to this one on hover — the flat garment says *what it is*, this
   * says *what it looks like on you*, which is the whole product in one card.
   * Absent until the render lands (or if it failed).
   */
  tryOnUrl?: string;
  /** Which plate `tryOnUrl` was rendered against, so a switch can invalidate it. */
  tryOnAvatarId?: string;
  /**
   * The YouCam surface this piece renders through — "upper_body", "shoes",
   * "necklace" and so on. Stored rather than derived from `zone`, because five
   * rails can't express eleven surfaces: a watch and a bag both hang on the
   * accessory rail but are different endpoints with different request shapes.
   */
  vtoTarget?: string;
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
 *
 * An account may hold up to MAX_AVATARS of these — a studio plate, a full
 * length, a summer one — with exactly one active at a time. The active plate
 * is what every surface means when it says "your avatar"; the others exist so
 * you can switch context without re-shooting, not so try-ons become a choice
 * you have to make every time.
 */
/**
 * How much of the body the avatar photograph actually shows.
 *
 * This is not cosmetic. A try-on can only put trousers on a body that has
 * legs in frame — ask YouCam to fit `lower_body` to a head-and-shoulders shot
 * and you get an expensive, confidently wrong picture. So the framing is
 * captured once, at avatar creation, and the look creator greys out every slot
 * the body cannot carry rather than letting someone spend a render finding out.
 */
export type AvatarFraming = "bust" | "knee" | "full";

export const FRAMING: Record<
  AvatarFraming,
  { label: string; note: string; slots: SlotId[] }
> = {
  bust: {
    label: "Head & shoulders",
    note: "Tops and jackets only — there are no legs in the frame to dress.",
    slots: ["torso", "layer"],
  },
  knee: {
    label: "Waist or knee up",
    note: "Tops, jackets and bottoms. Shoes need the whole body in shot.",
    slots: ["torso", "layer", "bottom"],
  },
  full: {
    label: "Full length",
    note: "Everything: tops, jackets, bottoms and shoes.",
    slots: ["torso", "layer", "bottom", "shoes"],
  },
};

/** The four layers a look is built from, innermost first. */
export type SlotId = "torso" | "layer" | "bottom" | "shoes";

export interface Avatar {
  id: string;
  /** Stored path of the uploaded base photo. */
  sourceUrl: string;
  /** The processed/normalised avatar plate used as VTO `src`. */
  renderUrl: string;
  status: RenderStatus;
  taskId?: string;
  colorSeason?: ColorSeason;
  /**
   * Guessed from the photograph, then confirmed by the user — a guess alone
   * isn't good enough to disable controls on. Absent on plates shot before
   * this existed, which the look creator reads as "full" so nothing that used
   * to work stops working.
   */
  framing?: AvatarFraming;
  createdAt: string;
  /** User-tweakable presentation, applied everywhere the avatar appears. */
  customization: AvatarCustomization;
}

/**
 * Three, because each one is a real YouCam render target and a real choice the
 * extension has to put in front of someone. Two is not enough to be worth the
 * feature; four turns the picker into a menu.
 */
export const MAX_AVATARS = 3;

export interface AvatarCustomization {
  /** Backdrop the avatar plate is composited against. */
  backdrop: "paper" | "vat" | "madder" | "studio";
  /** How tightly the plate crops the body. */
  crop: "full" | "three-quarter" | "bust";
  /** Warm/cool grade applied to the plate, -100..100. */
  grade: number;
  /** Show the ruled measurement overlay on the plate. */
  guides: boolean;
  /**
   * Display name printed under the plate — and, once an account holds more
   * than one, the plate's *identity*: it is what the profile shelf and the
   * extension's picker call it. Doubling up is deliberate; a plate having a
   * caption and a separate name would be two things to keep in agreement.
   */
  label: string;
}

export interface User {
  id: string;
  email: string;
  name: string;
  createdAt: string;
  /** Up to MAX_AVATARS plates, in the order they were shot. */
  avatars: Avatar[];
  activeAvatarId?: string;
  /**
   * The active plate. Derived from `avatars` on read and kept as the same
   * object reference, so mutating `user.avatar` mutates the array entry too.
   * Everything that just wants "the avatar" reads this and is unaffected by
   * there being more than one.
   */
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
