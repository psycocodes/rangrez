"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import { extractGarment } from "@/lib/extract";
import { CUTS, type Cut } from "@/lib/fit";
import { UPLOAD_KINDS } from "@/lib/garment-kind";
import type { Avatar } from "@/lib/types";

/**
 * ═══════════════════════════════════════════════════════════════════════════
 *  Adding clothes you already own
 * ═══════════════════════════════════════════════════════════════════════════
 *
 *  The shape of this is chosen around one fact: extraction is instant and
 *  rendering is not. So it runs in two visible movements —
 *
 *    review    every photograph is cut out and named the moment it's chosen,
 *              and you correct anything wrong before spending a single call
 *    render    the pieces are in your wardrobe already; the body shots arrive
 *              behind them, in parallel, and you can close this and walk away
 *
 *  The alternative — one button, one spinner, twenty seconds a garment — was
 *  never worth building. Nobody watches that.
 * ═══════════════════════════════════════════════════════════════════════════
 */

type ItemState =
  | "reading"
  | "ready"
  | "saving"
  | "rendering"
  | "done"
  | "failed";

interface Item {
  key: string;
  file: File;
  state: ItemState;
  name: string;
  kindId: string;
  /**
   * The size on the label, and how the piece is cut. Optional, and asked for
   * here rather than later because this is the one moment the garment is in
   * the user's hands — the label is right there. Everything the extension
   * says about fit on a shop page is calibrated against what these hold.
   */
  sizeLabel: string;
  cut: Cut;
  previewUrl?: string;
  blob?: Blob;
  dominantColor?: string;
  /** Set once the row exists in the wardrobe. */
  garmentId?: string;
  tryOnUrl?: string;
  note?: string;
}

/** How many YouCam renders to have in flight at once. */
const RENDER_LANES = 3;
const MAX_FILES = 12;

export function UploadDock({
  avatars,
  activeAvatarId,
  onClose,
}: {
  avatars: Avatar[];
  activeAvatarId?: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);

  const [items, setItems] = useState<Item[]>([]);
  const [dragging, setDragging] = useState(false);
  const [phase, setPhase] = useState<"pick" | "working" | "settled">("pick");
  const [plateId, setPlateId] = useState(activeAvatarId);
  const [error, setError] = useState<string | null>(null);

  const plate = avatars.find((a) => a.id === plateId) ?? avatars[0];

  const patch = useCallback((key: string, next: Partial<Item>) => {
    setItems((list) =>
      list.map((it) => (it.key === key ? { ...it, ...next } : it)),
    );
  }, []);

  // Object URLs outlive React state unless someone revokes them.
  const urls = useRef<string[]>([]);
  useEffect(() => {
    const held = urls.current;
    return () => held.forEach((u) => URL.revokeObjectURL(u));
  }, []);

  useEffect(() => {
    const esc = (e: KeyboardEvent) => {
      if (e.key === "Escape" && phase !== "working") onClose();
    };
    document.addEventListener("keydown", esc);
    return () => document.removeEventListener("keydown", esc);
  }, [onClose, phase]);

  /* ── choosing ─────────────────────────────────────────────────────────── */

  const accept = useCallback(
    async (files: FileList | null) => {
      if (!files?.length) return;
      setError(null);

      const images = Array.from(files).filter((f) => f.type.startsWith("image/"));
      if (!images.length) {
        setError("Those need to be images — JPG, PNG or WebP.");
        return;
      }

      const room = MAX_FILES - items.length;
      if (images.length > room) {
        setError(
          `${MAX_FILES} at a time. Taking the first ${room > 0 ? room : 0}.`,
        );
      }

      const taking = images.slice(0, Math.max(0, room));
      const fresh: Item[] = taking.map((file, i) => ({
        key: `${Date.now()}-${i}-${file.name}`,
        file,
        state: "reading",
        name: "",
        kindId: "top",
        sizeLabel: "",
        cut: "regular",
      }));
      setItems((list) => [...list, ...fresh]);

      // All at once: this is local canvas work, and doing it in series would
      // make a dozen photographs feel like a progress bar for no reason.
      await Promise.all(
        fresh.map(async (item) => {
          try {
            const out = await extractGarment(item.file);
            urls.current.push(out.previewUrl);
            patch(item.key, {
              state: "ready",
              blob: out.blob,
              previewUrl: out.previewUrl,
              dominantColor: out.dominantColor,
              name: out.suggestedName,
              kindId: out.suggestedKindId,
              note: out.matted
                ? "Cut out of its background"
                : out.cropped
                  ? "Cropped to the garment — the background wouldn't matte"
                  : "Used the full frame",
            });
          } catch (err) {
            patch(item.key, {
              state: "failed",
              note: err instanceof Error ? err.message : "Couldn't read that file.",
            });
          }
        }),
      );
    },
    [items.length, patch],
  );

  /* ── committing ───────────────────────────────────────────────────────── */

  async function commit() {
    const ready = items.filter((i) => i.state === "ready" && i.blob);
    if (!ready.length) return;

    setPhase("working");
    setError(null);

    // ── movement one: the pieces land in the wardrobe ───────────────────
    const saved = await Promise.all(
      ready.map(async (item) => {
        patch(item.key, { state: "saving" });

        const body = new FormData();
        body.append("photo", item.blob!, `${item.key}.jpg`);
        body.append("name", item.name.trim());
        body.append("kind", item.kindId);
        body.append("dominantColor", item.dominantColor ?? "");
        body.append("sizeLabel", item.sizeLabel.trim());
        body.append("cut", item.cut);

        try {
          const res = await fetch("/api/wardrobe/upload", {
            method: "POST",
            body,
          });
          const json = await res.json();
          if (!res.ok) throw new Error(json.error ?? "Couldn't save that piece.");

          const rendersOn = Boolean(json.rendersOn) && Boolean(plate);
          patch(item.key, {
            state: rendersOn ? "rendering" : "done",
            garmentId: json.garment.id,
            note: rendersOn
              ? undefined
              : plate
                ? "Hangs flat — no try-on surface for this"
                : "Hangs flat until you have an avatar",
          });
          return rendersOn ? { key: item.key, id: json.garment.id as string } : null;
        } catch (err) {
          patch(item.key, {
            state: "failed",
            note: err instanceof Error ? err.message : "Couldn't save that piece.",
          });
          return null;
        }
      }),
    );

    // They are already in the grid, marked as still rendering. Anyone who
    // closes this now loses nothing.
    router.refresh();

    // ── movement two: the body shots, a few lanes at a time ─────────────
    const queue = saved.filter((s): s is { key: string; id: string } => s !== null);
    let next = 0;

    await Promise.all(
      Array.from({ length: Math.min(RENDER_LANES, queue.length) }, async () => {
        while (next < queue.length) {
          const job = queue[next++];
          try {
            const res = await fetch("/api/wardrobe/render", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ id: job.id, avatarId: plate?.id }),
            });
            const json = await res.json();
            if (!res.ok) throw new Error(json.error ?? "That render didn't take.");
            patch(job.key, { state: "done", tryOnUrl: json.tryOnUrl });
          } catch (err) {
            patch(job.key, {
              state: "failed",
              note:
                err instanceof Error ? err.message : "That render didn't take.",
            });
          }
        }
      }),
    );

    router.refresh();
    setPhase("settled");
  }

  /* ── render ───────────────────────────────────────────────────────────── */

  const readyCount = items.filter((i) => i.state === "ready").length;
  const doneCount = items.filter((i) => i.state === "done").length;
  const failedCount = items.filter((i) => i.state === "failed").length;
  const busy = phase === "working";

  return (
    <div
      className="fixed inset-0 z-[80] flex items-end justify-center bg-ink/45 backdrop-blur-[2px] sm:items-center sm:p-6"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !busy) onClose();
      }}
    >
      <div
        role="dialog"
        aria-label="Add clothes to your wardrobe"
        className="rise flex max-h-[92dvh] w-full max-w-[44rem] flex-col border border-ink bg-paper"
      >
        <header className="flex items-baseline justify-between border-b border-ink px-4 py-3">
          <span className="spec text-ink-3">
            {phase === "settled" ? "Added" : "Add from your photos"}
          </span>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            aria-label="Close"
            className="spec text-ink-3 transition-colors hover:text-madder disabled:opacity-30"
          >
            ✕
          </button>
        </header>

        <div className="flex-1 overflow-y-auto p-4">
          {items.length === 0 ? (
            <DropZone
              dragging={dragging}
              setDragging={setDragging}
              onFiles={accept}
              onBrowse={() => input.current?.click()}
            />
          ) : (
            <>
              <div className="flex flex-col gap-px bg-ink/15">
                {items.map((item) => (
                  <Row
                    onSize={(sizeLabel) => patch(item.key, { sizeLabel })}
                    onCut={(cut) => patch(item.key, { cut })}
                    key={item.key}
                    item={item}
                    locked={phase !== "pick"}
                    onName={(name) => patch(item.key, { name })}
                    onKind={(kindId) => patch(item.key, { kindId })}
                    onRemove={() =>
                      setItems((list) => list.filter((i) => i.key !== item.key))
                    }
                  />
                ))}
              </div>

              {phase === "pick" && items.length < MAX_FILES && (
                <button
                  type="button"
                  onClick={() => input.current?.click()}
                  className="spec-sm mt-3 w-full border border-dashed border-ink/30 py-3 text-ink-3 transition-colors duration-300 hover:border-ink hover:text-ink"
                >
                  + ADD MORE PHOTOS
                </button>
              )}
            </>
          )}

          {error && (
            <p
              role="alert"
              className="mt-4 border-l-2 border-madder bg-madder/8 py-2 pl-3 text-[0.85rem] leading-snug text-madder"
            >
              {error}
            </p>
          )}
        </div>

        <input
          ref={input}
          type="file"
          multiple
          accept="image/jpeg,image/png,image/webp"
          className="sr-only"
          onChange={(e) => {
            void accept(e.target.files);
            // Let the same file be chosen twice in a row.
            e.target.value = "";
          }}
        />

        {/* ── the foot ─────────────────────────────────────────────────── */}
        <footer className="border-t border-ink px-4 py-3">
          {/* Only a question worth asking when there is more than one answer. */}
          {avatars.length > 1 && phase === "pick" && items.length > 0 && (
            <div className="mb-3.5 flex flex-wrap items-center gap-x-3 gap-y-2">
              <span className="spec-sm text-ink-3">RENDER ON</span>
              {avatars.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  className="chip"
                  data-on={a.id === plate?.id}
                  onClick={() => setPlateId(a.id)}
                >
                  <span className="spec">{a.customization.label}</span>
                </button>
              ))}
            </div>
          )}

          {!plate && items.length > 0 && phase === "pick" && (
            <p className="mb-3.5 border-l-2 border-turmeric bg-turmeric/12 py-2 pl-3 text-[0.8rem] leading-relaxed text-ink-2">
              <span className="spec-sm mr-2 text-ink">NO BODY YET</span>
              These will hang flat in your wardrobe.{" "}
              <Link
                href="/atelier"
                className="text-ink underline decoration-madder underline-offset-4"
              >
                Create an avatar
              </Link>{" "}
              and you can try them on from the grid.
            </p>
          )}

          <div className="flex flex-wrap items-center gap-2.5">
            {phase === "settled" ? (
              <>
                <button type="button" onClick={onClose} className="btn flex-1">
                  <span className="spec">
                    {doneCount} in your wardrobe
                    {failedCount > 0 ? ` · ${failedCount} didn't take` : ""}
                  </span>
                  <span aria-hidden className="spec">→</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setItems([]);
                    setPhase("pick");
                  }}
                  className="btn btn-ghost"
                >
                  <span className="spec">Add more</span>
                  <span aria-hidden className="spec">+</span>
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={commit}
                  disabled={busy || readyCount === 0}
                  className="btn flex-1"
                >
                  <span className="spec">
                    {busy
                      ? "Working"
                      : readyCount === 0
                        ? "Choose some photos"
                        : `Add ${readyCount} ${readyCount === 1 ? "piece" : "pieces"}`}
                  </span>
                  <span aria-hidden className="spec">{busy ? "···" : "→"}</span>
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  disabled={busy}
                  className="btn btn-ghost disabled:opacity-40"
                >
                  <span className="spec">Cancel</span>
                </button>
              </>
            )}
          </div>

          {busy && (
            <p className="mt-3 text-[0.78rem] leading-relaxed text-ink-3">
              Your pieces are in the wardrobe already — the body shots are
              rendering {RENDER_LANES} at a time. You can close this; they&apos;ll
              finish without you.
            </p>
          )}
        </footer>
      </div>
    </div>
  );
}

/* ── the empty state ─────────────────────────────────────────────────────── */

function DropZone({
  dragging,
  setDragging,
  onFiles,
  onBrowse,
}: {
  dragging: boolean;
  setDragging: (v: boolean) => void;
  onFiles: (f: FileList | null) => void;
  onBrowse: () => void;
}) {
  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        void onFiles(e.dataTransfer.files);
      }}
      className={`flex flex-col items-center justify-center gap-5 border border-dashed p-10 text-center transition-colors duration-300 ${
        dragging ? "border-ink bg-paper-3" : "border-ink/30 bg-paper-2"
      }`}
    >
      <Hanger />
      <div>
        <p className="display display-md">
          Photograph what
          <br />
          <span className="aside">you already own.</span>
        </p>
        <p className="mx-auto mt-3.5 max-w-[42ch] text-[0.85rem] leading-relaxed text-ink-3">
          Lay a piece flat on a plain surface, or shoot it on a hanger. Rangrez
          cuts it out, files it on the right rail, and renders it onto your
          avatar — hover any card in the grid to see it worn.
        </p>
      </div>
      <button type="button" onClick={onBrowse} className="btn">
        <span className="spec">Choose photos</span>
        <span aria-hidden className="spec">↑</span>
      </button>
      <p className="spec-sm text-ink-3">OR DROP THEM HERE · UP TO {MAX_FILES}</p>
    </div>
  );
}

/* ── one photograph ──────────────────────────────────────────────────────── */

const STATE_LABEL: Record<ItemState, string> = {
  reading: "READING",
  ready: "READY",
  saving: "SAVING",
  rendering: "ON THE BODY…",
  done: "DONE",
  failed: "DIDN'T TAKE",
};

function Row({
  item,
  locked,
  onName,
  onKind,
  onSize,
  onCut,
  onRemove,
}: {
  item: Item;
  locked: boolean;
  onName: (v: string) => void;
  onKind: (v: string) => void;
  onSize: (v: string) => void;
  onCut: (v: Cut) => void;
  onRemove: () => void;
}) {
  const shot = item.tryOnUrl ?? item.previewUrl;
  const busy = item.state === "reading" || item.state === "saving" || item.state === "rendering";

  return (
    <div className="flex items-start gap-3.5 bg-paper p-3">
      <div className="relative aspect-square w-16 shrink-0 overflow-hidden border border-ink/15 bg-paper-3">
        {/* A plain <img>, deliberately. This is usually a `blob:` URL for a
            file that has not been uploaded yet — there is nothing for an image
            optimizer to fetch, and next/image doesn't take that protocol. */}
        {shot ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={shot}
            alt=""
            className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-500 ${
              busy ? "opacity-45" : "opacity-100"
            }`}
          />
        ) : null}
        {busy && (
          <span aria-hidden className="scan absolute inset-x-0 top-0 h-px bg-turmeric" />
        )}
        {item.state === "done" && item.tryOnUrl && (
          <span className="spec-sm absolute inset-x-0 bottom-0 bg-turmeric px-1 py-0.5 text-center text-ink">
            ON YOU
          </span>
        )}
      </div>

      <div className="min-w-0 flex-1">
        {locked ? (
          <p className="tight truncate text-[0.9rem]">
            {item.name || item.file.name}
          </p>
        ) : (
          <input
            value={item.name}
            onChange={(e) => onName(e.target.value)}
            placeholder={item.file.name.replace(/\.[a-z0-9]+$/i, "")}
            maxLength={90}
            aria-label="Name this piece"
            className="field !py-1 !text-[0.88rem]"
          />
        )}

        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5">
          {locked ? (
            <span className="spec-sm text-ink-3">
              {UPLOAD_KINDS.find((k) => k.id === item.kindId)?.label}
            </span>
          ) : (
            <label className="flex items-baseline gap-2">
              <span className="spec-sm text-ink-3">RAIL</span>
              <select
                value={item.kindId}
                onChange={(e) => onKind(e.target.value)}
                className="spec cursor-pointer border-b border-ink/25 bg-transparent py-0.5 pr-1 outline-none"
              >
                {UPLOAD_KINDS.map((k) => (
                  <option key={k.id} value={k.id}>
                    {k.label.toUpperCase()}
                  </option>
                ))}
              </select>
            </label>
          )}

          <span
            className={`spec-sm ${
              item.state === "failed"
                ? "text-madder"
                : item.state === "done"
                  ? "text-ink"
                  : "text-ink-3"
            }`}
          >
            {STATE_LABEL[item.state]}
          </span>

          {item.dominantColor && (
            <span
              aria-hidden
              className="block h-2.5 w-2.5 border border-ink/25"
              style={{ backgroundColor: item.dominantColor }}
            />
          )}
        </div>

        {/* The label, while the garment is still in your hands. Both optional
            — an unsized piece is a perfectly good wardrobe entry — but they
            are what every fit recommendation downstream is calibrated on, and
            there is no later moment when the tag is this easy to read. */}
        {!locked && (
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5">
            <label className="flex items-baseline gap-2">
              <span className="spec-sm text-ink-3">SIZE</span>
              <input
                value={item.sizeLabel}
                onChange={(e) => onSize(e.target.value)}
                placeholder="M"
                maxLength={12}
                aria-label="Size on the label"
                className="spec w-16 border-b border-ink/25 bg-transparent py-0.5 uppercase outline-none placeholder:text-ink-3/60 focus:border-ink"
              />
            </label>
            <label className="flex items-baseline gap-2">
              <span className="spec-sm text-ink-3">CUT</span>
              <select
                value={item.cut}
                onChange={(e) => onCut(e.target.value as Cut)}
                className="spec cursor-pointer border-b border-ink/25 bg-transparent py-0.5 pr-1 outline-none"
              >
                {CUTS.map((c) => (
                  <option key={c} value={c}>
                    {c.toUpperCase()}
                  </option>
                ))}
              </select>
            </label>
          </div>
        )}

        {locked && item.sizeLabel && (
          <p className="spec-sm mt-1.5 text-ink-3">
            SIZE {item.sizeLabel.toUpperCase()} · {item.cut.toUpperCase()}
          </p>
        )}

        {item.note && (
          <p
            className={`mt-1.5 text-[0.75rem] leading-snug ${
              item.state === "failed" ? "text-madder" : "text-ink-3"
            }`}
          >
            {item.note}
          </p>
        )}
      </div>

      {!locked && (
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Remove ${item.name || item.file.name}`}
          className="spec shrink-0 px-1 py-1 text-ink-3 transition-colors hover:text-madder"
        >
          ✕
        </button>
      )}
    </div>
  );
}

function Hanger() {
  return (
    <svg
      width="46"
      height="34"
      viewBox="0 0 46 34"
      fill="none"
      aria-hidden
      className="text-ink-3"
    >
      <path
        d="M23 11c0-3 2-5 4.5-5S32 8 32 10.5"
        stroke="currentColor"
        strokeWidth="1.2"
      />
      <path
        d="M23 11 3 26.5c-1.2.9-.6 2.5.9 2.5h38.2c1.5 0 2.1-1.6.9-2.5L23 11Z"
        stroke="currentColor"
        strokeWidth="1.2"
      />
    </svg>
  );
}
