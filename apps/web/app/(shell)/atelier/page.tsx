import { AvatarStudio } from "@/components/AvatarStudio";
import { requireUser } from "@/lib/auth";
import { isMock } from "@/lib/youcam";

export const metadata = { title: "Studio — Rangrez" };

export default async function AtelierPage() {
  const user = await requireUser();

  return (
    <section className="px-4 lg:px-6">
      <div className="flex items-baseline justify-between gap-4 border-b border-ink/15 py-3">
        <span className="spec text-ink-3">02 — The studio</span>
        <span className="spec-sm text-ink-3">
          {isMock() ? "YOUCAM · MOCK" : "YOUCAM · LIVE"}
        </span>
      </div>

      <div className="py-10 lg:py-14">
        <AvatarStudio existing={user.avatar} mocked={isMock()} />
      </div>
    </section>
  );
}
