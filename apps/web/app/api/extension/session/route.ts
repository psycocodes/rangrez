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
 */
export async function GET(req: Request) {
  const user = await userFromRequest(req);

  if (!user) {
    return cors({ connected: false, reason: "no-token" }, { status: 401 });
  }

  return cors({
    connected: true,
    mocked: isMock(),
    user: { name: user.name, email: user.email },
    avatar: user.avatar
      ? {
          // Absolute, so the extension can render it on any origin.
          renderUrl: new URL(user.avatar.renderUrl, req.url).toString(),
          colorSeason: user.avatar.colorSeason?.name ?? null,
        }
      : null,
  });
}
