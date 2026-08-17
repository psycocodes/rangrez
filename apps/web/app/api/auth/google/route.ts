import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { authClient } from "@/lib/supabase-auth";

export async function GET() {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const origin = `${proto}://${host}`;

  try {
    const supabase = await authClient();
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${origin}/auth/callback`,
        queryParams: { prompt: "select_account" },
      },
    });

    if (error || !data.url) {
      return NextResponse.redirect(
        new URL(`/auth?error=${encodeURIComponent(error?.message ?? "Google OAuth not configured")}`, origin),
      );
    }

    return NextResponse.redirect(data.url);
  } catch (err) {
    return NextResponse.redirect(
      new URL(`/auth?error=${encodeURIComponent(err instanceof Error ? err.message : "Google sign in failed")}`, origin),
    );
  }
}
