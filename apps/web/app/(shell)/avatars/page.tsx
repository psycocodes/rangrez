import { headers } from "next/headers";
import { AvatarsView } from "@/components/AvatarsView";
import { requireUser } from "@/lib/auth";
import { mintExtensionToken } from "@/lib/ext-token";

export const metadata = { title: "Avatar Bodies — Rangrez" };

export default async function AvatarsPage() {
  const user = await requireUser();
  const token = mintExtensionToken(user);
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const apiBase = `${proto}://${host}`;

  return <AvatarsView user={user} token={token} apiBase={apiBase} />;
}
