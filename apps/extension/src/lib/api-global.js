/**
 * Same shim as `api.js`, for content scripts.
 *
 * Content scripts are classic scripts — they can't `import` — but they do share
 * one isolated-world global per page, so hanging the API off `RZ` and loading
 * this first gives every later file the same promise-based namespace.
 *
 * See api.js for why `browser` is preferred over `chrome`.
 */
globalThis.RZ = globalThis.RZ || {};
globalThis.RZ.api = globalThis.browser ?? globalThis.chrome;
