import { headers } from "next/headers";
import { AddGarmentView } from "@/components/AddGarmentView";
import { requireUser } from "@/lib/auth";
import { mintExtensionToken } from "@/lib/ext-token";

export const metadata = { title: "Add Garment — Rangrez" };

export default async function AddGarmentPage() {
  const user = await requireUser();
  const token = mintExtensionToken(user);
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const apiBase = `${proto}://${host}`;

  return <AddGarmentView user={user} token={token} apiBase={apiBase} />;
}
