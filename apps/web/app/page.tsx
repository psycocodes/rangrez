import { redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/auth";
import { landingFor } from "@/lib/onboarding";

/** The door is either the wardrobe, the studio, or the sign-in page. */
export default async function Index() {
  const user = await getCurrentUser();
  if (!user) redirect("/enter");
  redirect(landingFor(user));
}
