"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { figureArt } from "@/lib/base-models";
import type { BaseModelStatus } from "@/lib/base-models-server";
import { FRAMING, MAX_AVATARS } from "@/lib/types";

/**
 * Borrow a body.
 *
 * Uploading a photograph of yourself is a big ask before you've seen what the
 * product does, so this is the other door in: pick a stock body and the
 * wardrobe, the look creator and the extension all work exactly as they would
 * with your own plate.
 *
 * ── the drawing is not the model ─────────────────────────────────────────
 *
 * Every card shows a generated silhouette, and that silhouette is *never*
 * what gets rendered. It exists so choosing feels like choosing, and it is
 * the slot a 3D model drops into later — swap the <img> for a viewer and
 * nothing downstream notices, because nothing downstream reads it. What
 * Apparel VTO receives is the photograph at `plateUrl`, always.
 *
 * A body with no photograph yet says so rather than being hidden. Half the
 * feature is the arrangement, and a card that shows you exactly where the
 * missing file goes is more useful than a gap.
 */
export function BaseModelPicker({
  models,
  full,
}: {
  models: BaseModelStatus[];
  /** All MAX_AVATARS plates are taken. */
  full: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const ready = models.filter((m) => m.ready).length;

  async function adopt(model: BaseModelStatus) {
    if (busy || full || !model.ready) return;
    setBusy(model.id);
    setError(null);

    const body = new FormData();
    body.append("baseModel", model.id);
    body.append("label", model.label);

    try {
      const res = await fetch("/api/avatar", { method: "POST", body });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Couldn't use that body.");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't use that body.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
        <p className="max-w-[58ch] text-[0.9rem] leading-relaxed text-ink-2">
          A body to borrow, if you&apos;d rather not upload one of your own.
          Everything works the same on it — the same renders, the same
          wardrobe, the same extension.
        </p>
        <span className="spec-sm shrink-0 text-ink-3">
          {ready} OF {models.length} READY
        </span>
      </div>

      {error && (
        <p className="mb-4 border-l-2 border-madder bg-madder/8 py-2.5 pl-3 text-[0.85rem] leading-relaxed text-ink-2">
          {error}
        </p>
      )}

      <div className="grid grid-cols-2 gap-px bg-ink/15 sm:grid-cols-3 lg:grid-cols-6">
        {models.map((model) => {
          const working = busy === model.id;
          const usable = model.ready && !full && !busy;

          return (
            <div key={model.id} className="flex flex-col bg-paper p-2.5">
              <button
                type="button"
                onClick={() => void adopt(model)}
                disabled={!usable}
                aria-label={
                  model.ready
                    ? `Use ${model.label} — ${model.note}`
                    : `${model.label} has no photograph yet`
                }
                className="group block w-full text-left disabled:cursor-default"
              >
                <div
                  className={`relative aspect-[3/4] w-full overflow-hidden border transition-colors duration-300 ${
                    usable
                      ? "border-transparent group-hover:border-ink"
                      : "border-transparent"
                  }`}
                >
                  {/* The poster. A drawing, deliberately — see the note above,
                      and note that it is decoration all the way down: this
                      element is the one a 3D viewer replaces. */}
                  {/* eslint-disable-next-line @next/next/no-img-element -- an
                      inline SVG data URI; there is nothing to optimize and
                      next/image would only re-encode it. */}
                  <img
                    src={figureArt(model)}
                    alt=""
                    className={`absolute inset-0 h-full w-full object-cover transition-all duration-500 [transition-timing-function:var(--ease-cloth)] ${
                      model.ready
                        ? "opacity-100 group-hover:scale-[1.03]"
                        : "opacity-45 grayscale"
                    } ${working ? "opacity-40" : ""}`}
                  />

                  {working && (
                    <span
                      aria-hidden
                      className="scan absolute inset-x-0 top-0 h-px bg-turmeric"
                    />
                  )}

                  {!model.ready && (
                    <span className="spec-sm absolute inset-x-0 bottom-0 bg-ink/85 px-1.5 py-1 text-center text-paper">
                      NO PHOTO YET
                    </span>
                  )}
                  {model.modelUrl && (
                    <span className="spec-sm absolute right-0 top-0 bg-turmeric px-1.5 py-1 text-ink">
                      3D
                    </span>
                  )}
                </div>

                <p className="tight mt-2 truncate text-[0.85rem]">{model.label}</p>
                <p className="spec-sm mt-1 text-ink-3">
                  {model.heightCm}CM · {FRAMING[model.framing].label.toUpperCase()}
                </p>
              </button>

              <p className="mt-1.5 flex-1 text-[0.72rem] leading-snug text-ink-3">
                {model.note}
              </p>

              {model.ready && (
                <span
                  className={`spec-sm mt-2 block border py-1.5 text-center transition-colors duration-300 ${
                    usable
                      ? "border-ink/25 text-ink-3"
                      : "border-ink/15 text-ink-3/50"
                  }`}
                >
                  {working ? "TAKING IT" : "USE THIS BODY"}
                </span>
              )}
            </div>
          );
        })}
      </div>

      {ready < models.length && (
        <p className="rule mt-5 max-w-[74ch] pt-3 text-[0.8rem] leading-relaxed text-ink-3">
          The greyed bodies are drawn but have no photograph behind them yet.
          Apparel VTO fits garments to anatomy it can see, so an illustration
          can&apos;t stand in — drop a real photo at{" "}
          <code className="spec text-ink">public/base-models/&lt;id&gt;.jpg</code>{" "}
          and that card turns on by itself, no code change. A{" "}
          <code className="spec text-ink">.glb</code> beside it is picked up as
          the 3D poster the day one exists.
        </p>
      )}

      {full && (
        <p className="mt-5 border-l-2 border-madder bg-madder/8 py-2.5 pl-3 text-[0.85rem] leading-relaxed text-ink-2">
          <span className="spec-sm mr-2 text-madder">SHELF FULL</span>
          All {MAX_AVATARS} plates are taken — retire one above to borrow a body.
        </p>
      )}
    </div>
  );
}
