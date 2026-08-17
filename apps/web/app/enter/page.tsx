import { redirect } from "next/navigation";

import { AuthDoor } from "@/components/AuthDoor";
import { Vat, VatMasthead } from "@/components/Vat";
import { getCurrentUser } from "@/lib/auth";
import { hasGoogle } from "@/lib/providers";
import { landingFor } from "@/lib/onboarding";

export const metadata = { title: "Enter — Rangrez" };

export default async function EnterPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const user = await getCurrentUser();
  if (user) redirect(landingFor(user));

  // Google and the OAuth callback report failures by bouncing back here.
  const { error } = await searchParams;
  const google = await hasGoogle();

  return (
    <main className="grid min-h-dvh grid-cols-1 lg:grid-cols-[1.15fr_1fr]">
      <Vat>
        <VatMasthead />
      </Vat>
      <AuthDoor oauthError={error} google={google} />
    </main>
  );
}
