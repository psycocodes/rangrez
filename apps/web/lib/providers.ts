import "server-only";

/**
 * Which sign-in providers this Supabase project actually has switched on.
 *
 * Worth the round trip: `signInWithOAuth` builds a URL without checking, so a
 * disabled provider sends the user to a raw
 * `{"msg":"Unsupported provider: provider is not enabled"}` JSON page with no
 * way back. Asking first means we either show a button that works or don't
 * show it at all.
 *
 * Cached for a few minutes — this changes when someone edits the dashboard,
 * not per request.
 */

interface Settings {
  external?: Record<string, boolean>;
}

let cache: { at: number; providers: Set<string> } | null = null;
const TTL = 5 * 60 * 1000;

export async function enabledProviders(): Promise<Set<string>> {
  if (cache && Date.now() - cache.at < TTL) return cache.providers;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/+$/, "");
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return new Set();

  try {
    const res = await fetch(`${url}/auth/v1/settings`, {
      headers: { apikey: key },
      signal: AbortSignal.timeout(4000),
      cache: "no-store",
    });
    if (!res.ok) return new Set();

    const json = (await res.json()) as Settings;
    const providers = new Set(
      Object.entries(json.external ?? {})
        .filter(([, on]) => on)
        .map(([name]) => name),
    );
    cache = { at: Date.now(), providers };
    return providers;
  } catch {
    // A slow or unreachable auth endpoint shouldn't take the door down; we
    // just don't offer the extra buttons.
    return new Set();
  }
}

export async function hasGoogle(): Promise<boolean> {
  return (await enabledProviders()).has("google");
}
