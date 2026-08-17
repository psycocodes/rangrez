import { AddAvatarForm } from "@/components/AddAvatarForm";
import { requireUser } from "@/lib/auth";

export const metadata = { title: "Studio — Rangrez" };

export default async function AtelierPage({
  searchParams,
}: {
  searchParams: Promise<{ replace?: string }>;
}) {
  const [user, params] = await Promise.all([requireUser(), searchParams]);

  const replacing = params.replace
    ? user.avatars.find((a) => a.id === params.replace)
    : undefined;

  return (
    <div className="page min-h-screen bg-[#F4EFE6] text-[#12100d] p-4 lg:p-8 overflow-y-auto">
      <div className="mx-auto max-w-5xl pb-16">
        <AddAvatarForm user={user} replacing={replacing} />
      </div>
    </div>
  );
}
