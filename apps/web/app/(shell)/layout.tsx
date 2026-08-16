import { Masthead } from "@/components/Masthead";
import { requireUser } from "@/lib/auth";

/**
 * Everything behind the door shares this shell: a masthead, and the rest of
 * the viewport.
 *
 * The corner seal that briefly replaced the old top bar was the wrong call —
 * it hid navigation behind a click on every page to save 3rem that no page
 * actually needed. A header is what a header is for. What did stay dead is the
 * rotated spine and the colophon: those were a document's furniture, and every
 * page is a room now.
 *
 * `overflow-y-auto` on main rather than on the document: the rebuilt pages are
 * `.page` and never scroll, and the ones with more to say scroll *inside* here
 * — so the masthead is always on screen without being sticky, and there is no
 * seam under it to go wrong.
 */
export default async function ShellLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser();

  return (
    <div className="flex h-dvh flex-col overflow-hidden">
      <Masthead
        name={user.name}
        note={user.avatar?.colorSeason?.name.toUpperCase() ?? "NO AVATAR"}
      />
      {/* min-h-0 so a page that wants exactly one viewport can have it — a
          flex child defaults to min-height:auto and refuses to shrink. */}
      <main className="min-h-0 flex-1 overflow-y-auto">{children}</main>
    </div>
  );
}
