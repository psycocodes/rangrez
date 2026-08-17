import { NextResponse } from "next/server";

import { ensureProfile } from "@/lib/db";
import { authClient } from "@/lib/supabase-auth";
import { landingFor } from "@/lib/onboarding";

/**
 * Where Google sends people back to.
 *
 * Supabase hands over a one-time code; exchanging it sets the session cookies.
 * The profile row is created here rather than left to the next page load, so a
 * first-time Google user lands in the studio with a wardrobe already waiting,
 * exactly like someone who signed up with an email.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");

  // Google's own refusals (consent declined, app blocked) come back here too.
  const denied = url.searchParams.get("error_description") ?? url.searchParams.get("error");
  if (denied) {
    return NextResponse.redirect(
      new URL(`/enter?error=${encodeURIComponent(denied)}`, url.origin),
    );
  }

  if (!code) {
    return NextResponse.redirect(new URL("/enter", url.origin));
  }

  const supabase = await authClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);

  if (error || !data.user) {
    return NextResponse.redirect(
      new URL(
        `/enter?error=${encodeURIComponent(error?.message ?? "That sign-in didn't complete.")}`,
        url.origin,
      ),
    );
  }

  const meta = data.user.user_metadata ?? {};
  let profile;
  try {
    profile = await ensureProfile({
      id: data.user.id,
      email: data.user.email ?? "",
      name:
        (meta.full_name as string | undefined) ??
        (meta.name as string | undefined) ??
        data.user.email?.split("@")[0] ??
        "You",
    });
  } catch (err) {
    console.error("[auth/callback] profile failed:", err);
    return NextResponse.redirect(new URL("/setup", url.origin));
  }

  return NextResponse.redirect(
    new URL(landingFor(profile), url.origin),
  );
}
