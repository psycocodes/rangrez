import { Suspense } from "react";
import { AuthExperience } from "@/components/AuthExperience";
import { getCurrentUser } from "@/lib/auth";
import { hasGoogle } from "@/lib/providers";

export const metadata = { title: "Auth — Rangrez" };

export default async function AuthPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const [user, params, google] = await Promise.all([
    getCurrentUser(),
    searchParams,
    hasGoogle(),
  ]);

  return (
    <Suspense fallback={<div className="min-h-screen bg-[#F4EFE6]" />}>
      <AuthExperience
        initialUser={user}
        googleAvailable={google}
        oauthError={params.error}
      />
    </Suspense>
  );
}
