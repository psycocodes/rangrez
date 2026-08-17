import { NextResponse } from "next/server";
import { ensureProfile } from "@/lib/db";
import { authClient } from "@/lib/supabase-auth";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const name = String(body.name ?? "").trim();
    const email = String(body.email ?? "").trim().toLowerCase();
    const password = String(body.password ?? "");

    if (!name) {
      return NextResponse.json({ error: "Name is required." }, { status: 400 });
    }
    if (!EMAIL_RE.test(email)) {
      return NextResponse.json({ error: "Valid email address required." }, { status: 400 });
    }
    if (password.length < 8) {
      return NextResponse.json({ error: "Password must be at least 8 characters." }, { status: 400 });
    }

    const supabase = await authClient();
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { name } },
    });

    if (error) {
      const isAlready = /already registered|already exists/i.test(error.message);
      return NextResponse.json(
        {
          error: isAlready
            ? "That email is already registered. Please sign in instead."
            : error.message,
          code: isAlready ? "email_exists" : "signup_error",
        },
        { status: isAlready ? 409 : 400 },
      );
    }

    const userId = data.user?.id;
    if (userId) {
      await ensureProfile({ id: userId, email, name });
    }

    const requiresEmailVerification = !data.session;

    return NextResponse.json({
      success: true,
      userId,
      email,
      name,
      requiresEmailVerification,
      hasSession: Boolean(data.session),
    });
  } catch (err) {
    console.error("[api/auth/register] error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Registration failed." },
      { status: 500 },
    );
  }
}
