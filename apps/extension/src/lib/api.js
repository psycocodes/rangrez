/**
 * The extension API, whichever browser we're in.
 *
 * Firefox exposes the promise-based `browser.*` namespace; its `chrome.*`
 * alias is callback-style, so awaiting it silently yields undefined. Chrome
 * has no `browser` at all, and its MV3 `chrome.*` already returns promises.
 * Preferring `browser` and falling back to `chrome` therefore gives one
 * promise-based API on both, with no polyfill and no `if (firefox)` anywhere
 * else in the codebase.
 *
 * ES-module form, for the background script and the popup. Content scripts are
 * classic scripts and use `api-global.js` instead — same one-liner, different
 * delivery.
 */
export const api = globalThis.browser ?? globalThis.chrome;

/** True on Firefox, where host permissions are opt-in rather than granted. */
export const isGecko = Boolean(globalThis.browser?.runtime?.getBrowserInfo);
