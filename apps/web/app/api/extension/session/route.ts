import { cors, preflight } from "@/lib/cors";
import { userFromRequest } from "@/lib/ext-token";
import { isMock } from "@/lib/youcam";

export const OPTIONS = preflight;

/**
 * GET /api/extension/session
 *
 * The extension's handshake. Called on install, on popup open, and before the
 * first try-on of a session, so the panel can show "connect Rangrez" or "no
 * avatar yet" instead of failing at the moment the user clicks try-on.
 *
 * Returns every plate on the account, not just the active one — the panel asks
 * which body to use when there is more than one, and it cannot ask a question
 * it doesn't have the answers to. With a single plate the list has one entry
 * and the panel never mentions it.
 */
export async function GET(req: Request) {
  const user = await userFromRequest(req);

  if (!user) {
    return cors({ connected: false, reason: "no-token" }, { status: 401 });
  }

  // Absolute, so the extension can render these on any origin.
  const absolute = (url: string) => new URL(url, req.url).toString();

  return cors({
    connected: true,
    mocked: isMock(),
    user: { name: user.name, email: user.email },
    avatars: user.avatars.map((a) => ({
      id: a.id,
      label: a.customization.label,
      renderUrl: absolute(a.renderUrl),
      colorSeason: a.colorSeason?.name ?? null,
    })),
    activeAvatarId: user.activeAvatarId ?? null,
    // The active plate, still under the old key. An extension that hasn't
    // updated yet keeps working against exactly what it worked against before.
    avatar: user.avatar
      ? {
          renderUrl: absolute(user.avatar.renderUrl),
          colorSeason: user.avatar.colorSeason?.name ?? null,
        }
      : null,
  });
}
