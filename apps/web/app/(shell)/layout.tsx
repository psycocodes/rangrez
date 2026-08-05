import { Spine, TopBar } from "@/components/Chrome";
import { requireUser } from "@/lib/auth";

/** Everything behind the door shares this chrome. */
export default async function ShellLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser();

  return (
    <div className="flex min-h-dvh">
      <Spine note={`SESSION · ${user.name.toUpperCase()}`} />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar
          name={user.name}
          season={user.avatar?.colorSeason?.name.toUpperCase()}
          hasAvatar={Boolean(user.avatar)}
        />
        <main className="flex-1">{children}</main>
        <Colophon />
      </div>
    </div>
  );
}

function Colophon() {
  return (
    <footer className="mt-24 border-t border-ink/15">
      <div className="grid gap-8 px-5 py-10 sm:grid-cols-2 lg:grid-cols-4 lg:px-8">
        <div>
          <p className="spec-sm mb-3 text-ink-3">COLOPHON</p>
          <p className="aside text-[1.35rem] leading-tight">
            Rangrez, the dyer of cloth.
          </p>
        </div>
        <p className="max-w-[34ch] text-[0.8rem] leading-relaxed text-ink-3">
          Virtual try-on rendered through YouCam (Perfect Corp) Apparel VTO.
          Cataloguing, colour-season ranking and combination caching are ours.
        </p>
        <p className="max-w-[34ch] text-[0.8rem] leading-relaxed text-ink-3">
          Placeholder photography stands in for garment renders until the
          segmentation pipeline is live. Each image is dipped in its own
          catalogued dye.
        </p>
        <div className="spec-sm space-y-2 text-ink-3">
          <p>V 0.1 · HACKATHON</p>
          <p>SET IN INSTRUMENT SERIF,</p>
          <p>INTER TIGHT & JETBRAINS MONO</p>
        </div>
      </div>
    </footer>
  );
}
