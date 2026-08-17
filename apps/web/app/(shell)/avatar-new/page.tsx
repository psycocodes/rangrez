import { headers } from "next/headers";
import { AddAvatarForm } from "@/components/AddAvatarForm";
import { requireUser } from "@/lib/auth";
import { mintExtensionToken } from "@/lib/ext-token";

export const metadata = { title: "Add Avatar — Rangrez" };

export default async function NewAvatarPageRoute({
  searchParams,
}: {
  searchParams: Promise<{ replace?: string }>;
}) {
  const [user, params] = await Promise.all([requireUser(), searchParams]);

  const replacing = params.replace
    ? user.avatars.find((a) => a.id === params.replace)
    : undefined;

  const token = mintExtensionToken(user);
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const apiBase = `${proto}://${host}`;

  return (
    <AddAvatarForm
      user={user}
      replacing={replacing}
      token={token}
      apiBase={apiBase}
    />
  );
}
