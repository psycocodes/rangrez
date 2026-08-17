import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { ensureProfile, findUserByEmail, findUserById } from "@/lib/db";
import { authClient } from "@/lib/supabase-auth";
import { supabase as adminSupabase } from "@/lib/supabase";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const action = String(body.action ?? "check");
    const email = String(body.email ?? "").trim().toLowerCase();

    if (action === "resend") {
      if (!email) {
        return NextResponse.json({ error: "Email is required." }, { status: 400 });
      }
      const client = await authClient();
      await client.auth.resend({
        type: "signup",
        email,
      });
      return NextResponse.json({ success: true, message: "Magic link resent." });
    }

    if (action === "verify_simulated" || action === "confirm") {
      if (!email) {
        return NextResponse.json({ error: "Email is required." }, { status: 400 });
      }

      // Check or create profile
      let user = await findUserByEmail(email);
      if (!user) {
        // Find by admin client or ensure profile
        user = await ensureProfile({
          id: body.userId || `user_${Date.now()}`,
          email,
          name: email.split("@")[0],
        });
      }

      return NextResponse.json({
        success: true,
        status: "verified",
        user,
        redirect: "/auth?step=onboarding",
      });
    }

    // Default: check verification status
    const user = await getCurrentUser();
    if (user) {
      return NextResponse.json({
        success: true,
        status: "verified",
        user,
        redirect: user.avatars.length > 0 ? "/trialroom" : "/auth?step=onboarding",
      });
    }

    if (email) {
      const existing = await findUserByEmail(email);
      if (existing) {
        return NextResponse.json({
          success: true,
          status: "verified",
          user: existing,
          redirect: existing.avatars.length > 0 ? "/trialroom" : "/auth?step=onboarding",
        });
      }
    }

    return NextResponse.json({
      success: true,
      status: "pending",
    });
  } catch (err) {
    console.error("[api/auth/verify] error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Verification check failed." },
      { status: 500 },
    );
  }
}
