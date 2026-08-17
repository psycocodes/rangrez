import Link from "next/link";
import { headers } from "next/headers";

import { AvatarMissing } from "@/components/AvatarPlate";
import { LookCreator } from "@/components/LookCreator";
import { Navbar } from "@/components/Navbar";
import { requireUser } from "@/lib/auth";
import { listGarments } from "@/lib/db";
import { mintExtensionToken } from "@/lib/ext-token";
import { slotFor } from "@/lib/look";

export const metadata = { title: "Trial Room — Rangrez" };

export default async function TrialRoomPage() {
  const user = await requireUser();
  const garments = await listGarments(user.id);
  const wearable = garments.filter((g) => slotFor(g) !== null);

  const token = mintExtensionToken(user);
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const apiBase = `${proto}://${host}`;

  if (!user.avatar) {
    return (
      <div className="relative flex h-full min-h-0 flex-col overflow-hidden bg-[#F4EFE6] text-[#12100d]">
        <Navbar
          user={user}
          token={token}
          apiBase={apiBase}
        />
        <section className="flex-1 overflow-y-auto px-4 lg:px-6 flex items-center justify-center">
          <div className="grid items-center gap-10 py-12 max-w-4xl mx-auto lg:grid-cols-[1fr_22rem]">
            <div>
              <p className="spec mb-4 text-[#FF5A5F] font-bold">Nothing to dress</p>
              <h1 className="font-friday text-4xl sm:text-5xl text-[#12100d] uppercase">
                Build a fit
                <br />
                <span className="text-[#FFDE59] bg-[#12100d] px-2">on your body.</span>
              </h1>
              <p className="mt-5 max-w-[46ch] font-mono text-xs leading-relaxed text-[#12100d]/70">
                The trial room hangs a whole outfit — top, bottom, shoes and an outer layer — on one avatar body, one garment at a time. It needs an avatar first.
              </p>
              <Link
                href="/avatar-new"
                className="mt-6 inline-flex items-center gap-2 rounded-2xl border-[3px] border-[#12100d] bg-[#FFDE59] px-6 py-3 font-friday text-xs uppercase tracking-wider text-[#12100d] shadow-[4px_4px_0px_#12100d] hover:bg-[#FFE57F] active:translate-x-[2px] active:translate-y-[2px] transition-all"
              >
                <span>Create your avatar →</span>
              </Link>
            </div>
            <AvatarMissing />
          </div>
        </section>
      </div>
    );
  }

  return (
    <div
      className="relative flex h-full min-h-0 flex-col overflow-hidden bg-[#F4EFE6] text-[#12100d]"
      style={{
        backgroundImage: "url('/assets/backgrounds/trialroom-background.png')",
        backgroundSize: "cover",
        backgroundPosition: "center",
      }}
    >
      {/* Floating Navbar directly over the trial room */}
      <div className="absolute top-0 inset-x-0 z-50 pointer-events-auto">
        <Navbar
          user={user}
          token={token}
          apiBase={apiBase}
        />
      </div>
      <div className="relative flex-1 min-h-0 overflow-hidden pt-16">
        <LookCreator
          avatars={user.avatars}
          activeAvatarId={user.activeAvatarId}
          garments={wearable}
          embedded
        />
      </div>
    </div>
  );
}
