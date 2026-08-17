import { NextResponse } from "next/server";
import { ensureProfile, findUserById } from "@/lib/db";
import { authClient } from "@/lib/supabase-auth";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const email = String(body.email ?? "").trim().toLowerCase();
    const password = String(body.password ?? "");

    if (!EMAIL_RE.test(email)) {
      return NextResponse.json({ error: "Valid email address required." }, { status: 400 });
    }
    if (!password) {
      return NextResponse.json({ error: "Password is required." }, { status: 400 });
    }

    const supabase = await authClient();
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error || !data.user) {
      const isNotConfirmed = /not confirmed/i.test(error?.message ?? "");
      return NextResponse.json(
        {
          error: isNotConfirmed
            ? "Email address has not been confirmed yet. Please verify your email."
            : "Invalid email or password.",
          code: isNotConfirmed ? "email_not_confirmed" : "invalid_credentials",
        },
        { status: 401 },
      );
    }

    let profile = await findUserById(data.user.id);
    if (!profile) {
      profile = await ensureProfile({
        id: data.user.id,
        email,
        name:
          (data.user.user_metadata?.name as string | undefined) ??
          email.split("@")[0],
      });
    }

    const hasAvatar = profile.avatars.length > 0 || Boolean(profile.avatar);

    return NextResponse.json({
      success: true,
      user: profile,
      hasAvatar,
      redirect: hasAvatar ? "/trialroom" : "/auth?step=onboarding",
    });
  } catch (err) {
    console.error("[api/auth/login] error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Sign-in failed." },
      { status: 500 },
    );
  }
}
