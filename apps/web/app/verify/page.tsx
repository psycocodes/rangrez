import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";

export default async function VerifyPage() {
  const user = await getCurrentUser();
  if (user?.avatars && user.avatars.length > 0) {
    redirect("/trialroom");
  } else if (user) {
    redirect("/onboarding");
  } else {
    redirect("/auth");
  }
}
