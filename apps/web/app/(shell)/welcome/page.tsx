import { redirect } from "next/navigation";

import { Onboarding } from "@/components/Onboarding";
import { requireUser } from "@/lib/auth";
import { isReady } from "@/lib/onboarding";

export const metadata = { title: "Welcome — Rangrez" };

/**
 * First run.
 *
 * Guarded rather than gated: an account that already has everything is sent
 * on to the wardrobe instead of being walked through three screens it has
 * already satisfied. That makes the route safe to link to from anywhere —
 * including a stale bookmark — and it is why the redirect lives here and not
 * in a middleware that would have to duplicate the same reasoning.
 *
 * `?again` opens it regardless, for someone who wants to walk back through.
 */
export default async function WelcomePage({
  searchParams,
}: {
  searchParams: Promise<{ again?: string }>;
}) {
  const [user, params] = await Promise.all([requireUser(), searchParams]);

  if (isReady(user) && params.again === undefined) redirect("/wardrobe");

  return (
    <div className="min-h-0 flex-1 overflow-y-auto bg-[#F4EFE6] text-abyss">
      <Onboarding user={user} />
    </div>
  );
}
