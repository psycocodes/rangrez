import { headers } from "next/headers";
import Link from "next/link";

import { ConnectHandshake } from "@/components/ConnectHandshake";
import { requireUser } from "@/lib/auth";
import { mintExtensionToken } from "@/lib/ext-token";
import { isMock } from "@/lib/youcam";

export const metadata = { title: "Connect the extension — Rangrez" };

const STEPS: Array<[string, string]> = [
  [
    "Open Chrome's extensions page",
    "chrome://extensions — then switch on Developer mode, top right.",
  ],
  [
    "Load unpacked",
    "Point it at apps/extension in this repo. There is no build step; the folder is the extension.",
  ],
  [
    "Come back to this page",
    "Refresh once. The extension reads its key from here — nothing to copy, nothing to paste. Deploying? Add your exact origin to the pairing entry in manifest.json first; it only trusts localhost by default.",
  ],
  [
    "Open any product page",
    "Amazon, Myntra, Flipkart, Ajio, Zara, H&M. A small mark appears in the corner when it finds clothes.",
  ],
];

export default async function ConnectPage() {
  const user = await requireUser();
  const token = mintExtensionToken(user);

  // The extension talks to whatever origin served this page, so local dev and
  // a deployed instance both pair without configuration.
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const apiBase = `${proto}://${host}`;

  return (
    <section className="px-4 lg:px-6">
      <div className="flex items-baseline justify-between gap-4 border-b border-ink/15 py-3">
        <span className="spec text-ink-3">04 — The extension</span>
        <span className="spec-sm text-ink-3">
          {isMock() ? "YOUCAM · MOCK" : "YOUCAM · LIVE"}
        </span>
      </div>

      <div className="grid gap-10 py-10 lg:grid-cols-[1.15fr_1fr] lg:gap-16 lg:py-14">
        <div>
          <p className="spec mb-6 text-madder">Try-on while you shop</p>
          <h1 className="display display-lg">
            Take the
            <br />
            avatar
            <br />
            <span className="aside">shopping.</span>
          </h1>
          <p className="mt-7 max-w-[48ch] text-[0.98rem] leading-relaxed text-ink-2">
            The extension watches for clothes on a product page, works out what
            the piece actually is, picks the cleanest photograph of it out of the
            gallery, and hangs it on the same avatar your wardrobe uses. No tab
            switch, no upload, no leaving the page.
          </p>

          <div className="mt-10 border-t-2 border-ink">
            {STEPS.map(([title, body], i) => (
              <div key={title} className="flex gap-4 border-b border-ink/15 py-4">
                <span className="spec-sm w-6 shrink-0 pt-1 text-madder">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <div>
                  <p className="tight text-[0.95rem]">{title}</p>
                  <p className="mt-1.5 max-w-[46ch] text-[0.82rem] leading-relaxed text-ink-3">
                    {body}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <aside className="lg:sticky lg:top-28 lg:self-start">
          <div className="mb-3 flex items-baseline justify-between">
            <span className="spec-sm text-ink-3">HANDSHAKE</span>
            <span className="spec-sm text-ink-3">KEY 01</span>
          </div>

          <ConnectHandshake token={token} apiBase={apiBase} />

          {!user.avatar && (
            <p className="mt-5 border-l-2 border-madder bg-madder/8 py-2.5 pl-3 text-[0.82rem] leading-relaxed text-ink-2">
              <span className="spec-sm mr-2 text-madder">FIRST</span>
              There is no body to dress yet.{" "}
              <Link
                href="/atelier"
                className="text-ink underline decoration-madder underline-offset-4"
              >
                Create your avatar
              </Link>{" "}
              — the extension needs it before it can render anything.
            </p>
          )}

          <div className="rule mt-8 pt-4">
            <p className="spec-sm mb-3.5 text-ink-3">WHAT IT CAN HANG</p>
            <ul className="grid gap-px bg-ink/15">
              {[
                ["Tops, shirts, knitwear", "yes"],
                ["Jackets & outerwear", "yes"],
                ["Trousers, jeans, skirts", "yes"],
                ["Dresses & one-pieces", "yes"],
                ["Shoes", "not yet"],
                ["Chains, bags, eyewear", "not yet"],
              ].map(([label, state]) => (
                <li
                  key={label}
                  className="flex items-center justify-between bg-paper px-3 py-2.5"
                >
                  <span className="text-[0.85rem] text-ink-2">{label}</span>
                  <span
                    className={`spec-sm ${
                      state === "yes" ? "text-ink" : "text-ink-3"
                    }`}
                  >
                    {state.toUpperCase()}
                  </span>
                </li>
              ))}
            </ul>
            <p className="mt-3.5 max-w-[42ch] text-[0.78rem] leading-relaxed text-ink-3">
              Apparel VTO dresses a body; it doesn&apos;t hang jewellery or fit
              shoes. The extension still recognises those and says so, rather
              than spending a call to fail.
            </p>
          </div>
        </aside>
      </div>
    </section>
  );
}
