/**
 * Pairing, page side.
 *
 * Runs only on origins that serve Rangrez itself (see manifest — deliberately
 * not <all_urls>). Looks for the handshake node that /connect renders, hands
 * the token to the service worker, and marks the node so the page can show
 * "paired" without a refresh.
 */
(() => {
  const NODE_ID = "rangrez-ext-handshake";

  async function pair(node) {
    const token = node.dataset.token;
    if (!token || node.dataset.paired === "1") return;

    try {
      await RZ.api.runtime.sendMessage({
        type: "PAIR",
        token,
        apiBase: node.dataset.api || location.origin,
      });
      node.dataset.paired = "1";
    } catch (err) {
      console.warn("[rangrez] pairing failed", err);
    }
  }

  const existing = document.getElementById(NODE_ID);
  if (existing) {
    void pair(existing);
    return;
  }

  // /connect may still be streaming in. Watch briefly, then give up rather
  // than leaving an observer running on every page of the app.
  const observer = new MutationObserver(() => {
    const node = document.getElementById(NODE_ID);
    if (node) {
      observer.disconnect();
      void pair(node);
    }
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });
  setTimeout(() => observer.disconnect(), 10_000);
})();
