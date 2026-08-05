import { redirect } from "next/navigation";

import { AuthDoor } from "@/components/AuthDoor";
import { Vat, VatMasthead } from "@/components/Vat";
import { getCurrentUser } from "@/lib/auth";

export const metadata = { title: "Enter — Rangrez" };

export default async function EnterPage() {
  const user = await getCurrentUser();
  if (user) redirect(user.avatar ? "/wardrobe" : "/atelier");

  return (
    <main className="grid min-h-dvh grid-cols-1 lg:grid-cols-[1.15fr_1fr]">
      <Vat>
        <VatMasthead />
      </Vat>
      <AuthDoor />
    </main>
  );
}
