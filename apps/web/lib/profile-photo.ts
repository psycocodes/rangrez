import type { User } from "./types";

/**
 * Which face to show for a person, and in what order to prefer them.
 *
 * 1. A photo the user explicitly uploaded/set if they turned off Google photo
 * 2. The user's real Google profile photo (from OAuth session, identities, or unavatar fallback)
 * 3. A stored custom photo
 * 4. An email-based avatar
 * 5. A generated illustration fallback
 */
export function profilePhoto(user: {
  name?: string;
  email?: string;
  profilePhotoUrl?: string;
  useGooglePhoto?: boolean;
  googlePhotoUrl?: string;
}): string {
  const wantsGoogle = user.useGooglePhoto ?? true;

  if (!wantsGoogle && user.profilePhotoUrl) return user.profilePhotoUrl;
  if (wantsGoogle && user.googlePhotoUrl) return user.googlePhotoUrl;
  if (user.profilePhotoUrl) return user.profilePhotoUrl;
  if (user.googlePhotoUrl) return user.googlePhotoUrl;

  if (user.email && user.email.includes("@")) {
    const emailClean = user.email.trim().toLowerCase();
    if (emailClean.endsWith("@gmail.com") || emailClean.endsWith(".google.com")) {
      return `https://unavatar.io/google/${encodeURIComponent(emailClean)}`;
    }
    return `https://unavatar.io/${encodeURIComponent(emailClean)}`;
  }

  return generatedPhoto(user.name);
}

/** Whether there is a real Google picture to offer, rather than a drawing. */
export function hasGooglePhoto(user: { googlePhotoUrl?: string; email?: string }): boolean {
  if (Boolean(user.googlePhotoUrl)) return true;
  if (user.email && (user.email.endsWith("@gmail.com") || user.email.endsWith(".google.com"))) return true;
  return false;
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
 * Extract the user's real Google / OAuth photo from Supabase auth user object.
 * Checks user_metadata, identities array, app_metadata, and email fallbacks.
 */
export function extractGooglePhoto(
  authUser: {
    user_metadata?: Record<string, unknown> | null;
    app_metadata?: Record<string, unknown> | null;
    identities?: Array<{ identity_data?: Record<string, unknown> | null; provider?: string }> | null;
    email?: string | null;
  } | null | undefined,
  profile?: { profilePhotoUrl?: string } | null,
): string | undefined {
  if (!authUser) return profile?.profilePhotoUrl;

  // 1. Check user_metadata keys
  const meta = authUser.user_metadata;
  if (meta) {
    for (const key of ["avatar_url", "picture", "picture_url", "photo_url", "image", "photo", "profile_picture"]) {
      const value = meta[key];
      if (typeof value === "string" && (value.startsWith("https://") || value.startsWith("http://"))) {
        return value;
      }
    }
  }

  // 2. Check identities array (Supabase OAuth stores Google user data here)
  if (Array.isArray(authUser.identities)) {
    for (const identity of authUser.identities) {
      const idData = identity.identity_data;
      if (idData) {
        for (const key of ["avatar_url", "picture", "picture_url", "photo_url", "image", "photo", "profile_picture"]) {
          const value = idData[key];
          if (typeof value === "string" && (value.startsWith("https://") || value.startsWith("http://"))) {
            return value;
          }
        }
      }
    }
  }

  // 3. Check existing profile photo if it's already an https/http URL
  if (profile?.profilePhotoUrl && (profile.profilePhotoUrl.startsWith("https://") || profile.profilePhotoUrl.startsWith("http://"))) {
    return profile.profilePhotoUrl;
  }

  // 4. Fallback for Google/Gmail accounts: Unavatar Google photo resolver
  const email = authUser.email;
  if (email && typeof email === "string" && email.includes("@")) {
    const emailClean = email.trim().toLowerCase();
    if (emailClean.endsWith("@gmail.com") || emailClean.endsWith(".google.com")) {
      return `https://unavatar.io/google/${encodeURIComponent(emailClean)}`;
    }
    return `https://unavatar.io/${encodeURIComponent(emailClean)}`;
  }

  return undefined;
}

export function googlePhotoFromMetadata(
  metadata: Record<string, unknown> | undefined | null,
): string | undefined {
  if (!metadata) return undefined;
  for (const key of ["avatar_url", "picture", "picture_url", "photo_url", "image"]) {
    const value = metadata[key];
    if (typeof value === "string" && value.startsWith("https://")) return value;
  }
  return undefined;
}

