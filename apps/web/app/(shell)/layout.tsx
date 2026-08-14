import { Colophon, Spine, TopBar } from "@/components/Chrome";
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
        {/* min-h-0 so a page that wants exactly one viewport can have it — a
            flex child defaults to min-height:auto and refuses to shrink. */}
        <main className="min-h-0 flex-1">{children}</main>
        <Colophon />
      </div>
    </div>
  );
}
