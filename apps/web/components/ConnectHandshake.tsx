"use client";

import { useSyncExternalStore } from "react";

const NODE_ID = "rangrez-ext-handshake";

/**
 * The extension confirms pairing by writing `data-paired` onto the handshake
 * node. That is external mutable state we don't own, so it's subscribed to
 * rather than mirrored into React state.
 */
function subscribe(onChange: () => void) {
  const node = document.getElementById(NODE_ID);
  if (!node) return () => {};
  const observer = new MutationObserver(onChange);
  observer.observe(node, { attributes: true, attributeFilter: ["data-paired"] });
  return () => observer.disconnect();
}

const isPaired = () =>
  document.getElementById(NODE_ID)?.dataset.paired === "1";

/**
 * The pairing handshake, page side.
 *
 * The extension cannot read our httpOnly session cookie, and we do not want to
 * make the user copy a token by hand. So this renders the bearer token onto a
 * single node; a content script matched to this origin picks it up, stores it
 * in `chrome.storage.local`, and writes `data-paired` back onto the same node.
 *
 * The token is deliberately confined to this one route rather than the app
 * shell, so it is only ever in the DOM on a page the user asked for.
 */
export function ConnectHandshake({
  token,
  apiBase,
}: {
  token: string;
  apiBase: string;
}) {
  const paired = useSyncExternalStore(subscribe, isPaired, () => false);

  return (
    <>
      <div
        id={NODE_ID}
        data-token={token}
        data-api={apiBase}
        hidden
      />

      <div
        className={`flex items-center gap-3 border px-4 py-3.5 transition-colors duration-500 ${
          paired ? "border-ink bg-ink text-paper" : "border-ink/25 bg-paper"
        }`}
      >
        <span
          aria-hidden
          className={`block h-2 w-2 rounded-full ${
            paired ? "bg-turmeric" : "animate-pulse bg-madder"
          }`}
        />
        <span className="spec">
          {paired ? "Extension paired" : "Waiting for the extension"}
        </span>
        <span
          className={`spec-sm ml-auto ${paired ? "text-paper/55" : "text-ink-3"}`}
        >
          {paired ? "YOU CAN CLOSE THIS" : "INSTALL IT, THEN REFRESH"}
        </span>
      </div>
    </>
  );
}
