import { headers } from "next/headers";
import { ProfileView } from "@/components/ProfileView";
import { requireUser } from "@/lib/auth";
import { listGarments } from "@/lib/db";
import { mintExtensionToken } from "@/lib/ext-token";

export const metadata = { title: "Profile — Rangrez" };

export default async function ProfilePage() {
  const user = await requireUser();
  const garments = await listGarments(user.id);

  const token = mintExtensionToken(user);
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const apiBase = `${proto}://${host}`;

  return (
    <div className="min-h-full w-full overflow-y-auto">
      <ProfileView
        user={user}
        garments={garments}
        token={token}
        apiBase={apiBase}
      />
    </div>
  );
}
