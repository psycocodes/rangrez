import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * The one Supabase client, server-side only.
 *
 * Rangrez authenticates with its own signed cookie, so there is no
 * `auth.uid()` for row-level security to key off. The schema therefore runs
 * RLS with no anon policies, and everything goes through the SECRET
 * (service_role) key, which bypasses RLS. Scoping by `user_id` is this app's
 * job — see lib/db.ts, where every query carries it.
 *
 * If only the publishable key is present the client still builds, so a fresh
 * clone runs, but it will be able to read nothing once RLS is on. That is a
 * loud warning rather than a crash on purpose: the failure should show up as
 * "no data" at the point of use, not as a boot loop.
 */

let client: SupabaseClient | null = null;
let warned = false;

export function supabase(): SupabaseClient {
  if (client) return client;

  // Supabase's dashboard copies the URL with a trailing slash; left in, it
  // produces `//rest/v1/...` on some paths.
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/+$/, "");
  const secret =
    process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  const publishable =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL is not set. Add it to apps/web/.env.local.",
    );
  }

  const key = secret ?? publishable;
  if (!key) {
    throw new Error(
      "No Supabase key found. Add SUPABASE_SECRET_KEY to apps/web/.env.local.",
    );
  }

  if (!secret && !warned) {
    warned = true;
    console.warn(
      "\n[supabase] Running on the PUBLISHABLE key.\n" +
        "           That key ships to the browser, so with RLS enabled it can read\n" +
        "           nothing, and with RLS disabled anyone holding it can read your\n" +
        "           whole database. Add SUPABASE_SECRET_KEY (Project Settings → API\n" +
        "           keys → secret) and restart.\n",
    );
  }

  client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { "x-rangrez": "server" } },
  });
  return client;
}

/** True when the server is configured to actually reach the database. */
export function hasSupabase(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      (process.env.SUPABASE_SECRET_KEY ??
        process.env.SUPABASE_SERVICE_ROLE_KEY ??
        process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
  );
}
