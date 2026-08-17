import type { User } from "./types";

/**
 * Which face to show for a person, and in what order to prefer them.
 *
 * There were two copies of this decision — one in ProfileView, one in the
 * Navbar — and both had the same bug: what they called "the Google photo" was
 * a DiceBear illustration generated from the account name. Nobody's actual
 * Google picture had ever been fetched, so the toggle marked "use my Google
 * photo" turned on a cartoon.
 *
 * The order:
 *
 *   1. a photo the user uploaded here, if they have turned the Google one off
 *   2. the picture on the Google account they signed in with
 *   3. a photo they uploaded, even when they asked for Google — because an
 *      email-and-password account has no Google picture to fall back to and a
 *      stored one is still better than a drawing
 *   4. a generated illustration, which is the only branch that was ever taken
 */
export function profilePhoto(user: {
  name?: string;
  profilePhotoUrl?: string;
  useGooglePhoto?: boolean;
  googlePhotoUrl?: string;
}): string {
  const wantsGoogle = user.useGooglePhoto ?? true;

  if (!wantsGoogle && user.profilePhotoUrl) return user.profilePhotoUrl;
  if (wantsGoogle && user.googlePhotoUrl) return user.googlePhotoUrl;
  return user.profilePhotoUrl || generatedPhoto(user.name);
}

/** Whether there is a real Google picture to offer, rather than a drawing. */
export function hasGooglePhoto(user: Pick<User, "googlePhotoUrl">): boolean {
  return Boolean(user.googlePhotoUrl);
}

/**
 * The last resort — a drawing, seeded from the name so it is at least stable
 * for a given person rather than changing on every render.
 */
export function generatedPhoto(name?: string): string {
  return `https://api.dicebear.com/7.x/notionists/svg?seed=${encodeURIComponent(
    name || "User",
  )}&backgroundColor=b6e3f4,c0aede,d1d4f9,ffd5dc,ffdfbf`;
}

/**
 * The picture Google put on the session, if this account came from Google.
 *
 * Supabase copies the provider's claims into `user_metadata` verbatim, and the
 * key is not consistent: the OIDC claim is `picture`, and Supabase's own
 * normalised field is `avatar_url`. Both are checked because which one is
 * present depends on the provider and on how the identity was linked.
 */
export function googlePhotoFromMetadata(
  metadata: Record<string, unknown> | undefined | null,
): string | undefined {
  if (!metadata) return undefined;
  for (const key of ["avatar_url", "picture"]) {
    const value = metadata[key];
    // Only ever an https URL — this ends up in an <img src>, and the metadata
    // is provider-controlled rather than ours.
    if (typeof value === "string" && value.startsWith("https://")) return value;
  }
  return undefined;
}
