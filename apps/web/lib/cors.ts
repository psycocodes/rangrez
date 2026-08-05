import "server-only";

/**
 * CORS for the browser-extension surface only.
 *
 * These routes authenticate with a Bearer token (see lib/ext-token.ts), never
 * a cookie, so a wildcard origin carries no ambient-authority risk: a hostile
 * page can call them all it likes and gets a 401 without the token. That is
 * also why `Access-Control-Allow-Credentials` is deliberately absent.
 */

const HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Max-Age": "86400",
};

export function cors<T>(body: T, init: ResponseInit = {}): Response {
  return Response.json(body, {
    ...init,
    headers: { ...HEADERS, ...(init.headers ?? {}) },
  });
}

/** Preflight. Every extension route re-exports this as `OPTIONS`. */
export function preflight(): Response {
  return new Response(null, { status: 204, headers: HEADERS });
}
