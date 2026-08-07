import "server-only";

import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * The request-scoped client that carries the user's Supabase Auth session.
 *
 * Distinct from `lib/supabase.ts`, which holds the secret key and bypasses RLS
 * for server-side work. This one speaks as the signed-in user, using the
 * publishable key and the session cookies Supabase sets. It exists so accounts
 * live in Supabase's own Authentication table rather than a password column we
 * maintain by hand.
 */
export async function authClient(): Promise<SupabaseClient> {
  const jar = await cookies();

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/+$/, "");
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY are required for sign-in.",
    );
  }

  return createServerClient(url, key, {
    cookies: {
      getAll: () => jar.getAll(),
      setAll(list) {
        // Cookies can only be written from a Server Action or Route Handler.
        // During a page render this throws, and that's fine — the session is
        // still valid, it just isn't refreshed on this particular pass.
        try {
          for (const { name, value, options } of list) {
            jar.set(name, value, options);
          }
        } catch {
          /* read-only render context */
        }
      },
    },
  });
}
