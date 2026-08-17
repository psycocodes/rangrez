import { Suspense } from "react";
import { redirect } from "next/navigation";
import { OnboardingExperience } from "@/components/OnboardingExperience";
import { getCurrentUser } from "@/lib/auth";

export const metadata = { title: "Onboarding — Rangrez" };

export default async function OnboardingPage() {
  const user = await getCurrentUser();

  // If already has avatar, redirect to trialroom
  if (user && user.avatars.length > 0) {
    redirect("/trialroom");
  }

  return (
    <Suspense fallback={<div className="min-h-screen bg-[#F4EFE6]" />}>
      <OnboardingExperience user={user} />
    </Suspense>
  );
}
