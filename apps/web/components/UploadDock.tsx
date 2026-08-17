"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import { extractGarment } from "@/lib/extract";
import { CUTS, type Cut } from "@/lib/fit";
import { UPLOAD_KINDS } from "@/lib/garment-kind";
import type { Avatar } from "@/lib/types";

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
  sizeLabel: string;
  cut: Cut;
  previewUrl?: string;
  blob?: Blob;
  dominantColor?: string;
  garmentId?: string;
  tryOnUrl?: string;
  note?: string;
}

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

  async function commit() {
    const ready = items.filter((i) => i.state === "ready" && i.blob);
    if (!ready.length) return;

    setPhase("working");
    setError(null);

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

    router.refresh();

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

  const readyCount = items.filter((i) => i.state === "ready").length;
  const doneCount = items.filter((i) => i.state === "done").length;
  const failedCount = items.filter((i) => i.state === "failed").length;
  const busy = phase === "working";

  return (
    <div
      className="fixed inset-0 z-[80] flex items-end justify-center bg-[#12100d]/75 backdrop-blur-sm sm:items-center sm:p-6"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !busy) onClose();
      }}
    >
      <div
        role="dialog"
        aria-label="Add clothes to your wardrobe"
        className="rise flex max-h-[92dvh] w-full max-w-[44rem] flex-col border-[3px] border-[#12100d] bg-[#F4EFE6] shadow-[8px_8px_0px_#12100d] rounded-[2rem] overflow-hidden"
      >
        {/* Header */}
        <header className="flex items-center justify-between border-b-[3px] border-[#12100d] bg-white px-5 py-3.5">
          <span className="font-friday text-sm uppercase tracking-wider text-[#12100d]">
            {phase === "settled" ? "ADDED PIECES" : "ADD FROM YOUR PHOTOS"}
          </span>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            aria-label="Close"
            className="border-2 border-[#12100d] bg-[#FF5A5F] px-2 py-0.5 text-xs font-black text-white shadow-[2px_2px_0px_#12100d] transition-all hover:bg-[#FF3B42] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none cursor-pointer"
          >
            ✕
          </button>
        </header>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {items.length === 0 ? (
            <DropZone
              dragging={dragging}
              setDragging={setDragging}
              onFiles={accept}
              onBrowse={() => input.current?.click()}
            />
          ) : (
            <>
              <div className="space-y-3">
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
                  className="w-full border-[3px] border-dashed border-[#12100d] bg-white py-3.5 rounded-2xl font-mono text-xs font-black text-[#12100d] hover:bg-[#FAF6EF] transition-all cursor-pointer"
                >
                  + ADD MORE PHOTOS
                </button>
              )}
            </>
          )}

          {error && (
            <p
              role="alert"
              className="border-2 border-[#12100d] bg-[#FF5A5F] px-4 py-2.5 rounded-2xl font-mono text-xs font-black text-white shadow-[2px_2px_0px_#12100d]"
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
            e.target.value = "";
          }}
        />

        {/* Footer */}
        <footer className="border-t-[3px] border-[#12100d] bg-white p-5">
          {/* Avatar Target Switcher */}
          {avatars.length > 1 && phase === "pick" && items.length > 0 && (
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <span className="font-mono text-[0.68rem] font-black uppercase text-[#12100d]/50">
                RENDER FIT ON:
              </span>
              {avatars.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => setPlateId(a.id)}
                  className={`border-2 border-[#12100d] px-2.5 py-1 rounded-xl text-xs font-black uppercase shadow-[2px_2px_0px_#12100d] transition-all ${
                    a.id === plate?.id
                      ? "bg-[#FFDE59] text-[#12100d]"
                      : "bg-[#F4EFE6] text-[#12100d]/70 hover:bg-white"
                  }`}
                >
                  {a.customization.label}
                </button>
              ))}
            </div>
          )}

          {!plate && items.length > 0 && phase === "pick" && (
            <p className="mb-4 border-2 border-[#12100d] bg-[#FFDE59] px-4 py-3 rounded-2xl font-mono text-xs text-[#12100d] leading-relaxed shadow-[3px_3px_0px_#12100d]">
              <span className="font-black mr-2">NO BODY YET</span>
              These will hang flat in your wardrobe. Create an avatar to unlock automated fits.
            </p>
          )}

          <div className="flex flex-wrap items-center gap-3">
            {phase === "settled" ? (
              <>
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 border-2 border-[#12100d] bg-[#FFDE59] py-3 rounded-2xl font-friday text-sm uppercase tracking-wider text-[#12100d] shadow-[3px_3px_0px_#12100d] hover:bg-[#FFE57F]"
                >
                  {doneCount} in your wardrobe
                  {failedCount > 0 ? ` · ${failedCount} failed` : ""} →
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setItems([]);
                    setPhase("pick");
                  }}
                  className="border-2 border-[#12100d] bg-white py-3 px-5 rounded-2xl font-friday text-sm uppercase tracking-wider text-[#12100d] shadow-[2px_2px_0px_#12100d] hover:bg-[#FAF6EF]"
                >
                  Add more
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={commit}
                  disabled={busy || readyCount === 0}
                  className="flex-1 border-2 border-[#12100d] bg-[#FFDE59] py-3 rounded-2xl font-friday text-sm uppercase tracking-wider text-[#12100d] shadow-[3px_3px_0px_#12100d] hover:bg-[#FFE57F] disabled:opacity-40 disabled:pointer-events-none"
                >
                  {busy
                    ? "DIGITISING & RENDERING PIECES..."
                    : readyCount === 0
                      ? "CHOOSE SOME PHOTOS"
                      : `ADD ${readyCount} ${readyCount === 1 ? "PIECE" : "PIECES"} TO WARDROBE →`}
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  disabled={busy}
                  className="border-2 border-[#12100d] bg-white py-3 px-6 rounded-2xl font-friday text-sm uppercase tracking-wider text-[#12100d] shadow-[2px_2px_0px_#12100d] hover:bg-[#FAF6EF] disabled:opacity-40 cursor-pointer"
                >
                  CANCEL
                </button>
              </>
            )}
          </div>

          {busy && (
            <p className="mt-3 font-mono text-[0.68rem] text-[#12100d]/60 leading-relaxed uppercase">
              Your garments are queued. Rendering body shots in parallel. You can close this screen anytime.
            </p>
          )}
        </footer>
      </div>
    </div>
  );
}

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
      className={`flex flex-col items-center justify-center gap-6 border-[3px] border-dashed border-[#12100d] p-10 text-center rounded-[2rem] transition-colors duration-300 ${
        dragging ? "bg-[#FFFBEA]" : "bg-white"
      }`}
    >
      <Hanger />
      <div>
        <h3 className="font-friday text-2xl uppercase text-[#12100d]">
          Photograph what
          <br />
          <span className="text-[#FF5A5F]">you already own.</span>
        </h3>
        <p className="mx-auto mt-3 max-w-[42ch] font-mono text-xs leading-relaxed text-[#12100d]/70">
          Lay a piece flat on a plain surface, or shoot it on a hanger. Rangrez cuts it out, files it on the right rail, and renders it onto your avatar.
        </p>
      </div>
      <button
        type="button"
        onClick={onBrowse}
        className="border-[3px] border-[#12100d] bg-[#12100d] text-white px-5 py-2.5 rounded-xl font-friday text-xs uppercase tracking-wider shadow-[3px_3px_0px_#FFDE59] hover:bg-[#FFDE59] hover:text-[#12100d] transition-all cursor-pointer"
      >
        CHOOSE PHOTOS ↑
      </button>
      <p className="font-mono text-[0.68rem] text-[#12100d]/50 font-bold uppercase">
        OR DROP THEM HERE · UP TO {MAX_FILES}
      </p>
    </div>
  );
}

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
    <div className="flex items-start gap-4 border-2 border-[#12100d] bg-white p-3.5 rounded-[1.5rem] shadow-[3px_3px_0px_#12100d]">
      <div className="relative aspect-square w-16 shrink-0 overflow-hidden border-2 border-[#12100d] bg-[#FAF6EF] rounded-xl">
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
          <span aria-hidden className="scan absolute inset-x-0 top-0 h-px bg-[#FFDE59]" />
        )}
        {item.state === "done" && item.tryOnUrl && (
          <span className="absolute inset-x-0 bottom-0 border-t border-[#12100d] bg-[#FFDE59] py-0.5 text-center font-mono text-[0.58rem] font-bold text-[#12100d]">
            ON YOU
          </span>
        )}
      </div>

      <div className="min-w-0 flex-1">
        {locked ? (
          <p className="font-friday text-sm uppercase truncate text-[#12100d]">
            {item.name || item.file.name}
          </p>
        ) : (
          <input
            value={item.name}
            onChange={(e) => onName(e.target.value)}
            placeholder={item.file.name.replace(/\.[a-z0-9]+$/i, "")}
            maxLength={90}
            aria-label="Name this piece"
            className="w-full border-2 border-[#12100d] bg-[#FAF6EF] px-2 py-1 rounded-xl text-xs font-mono font-bold uppercase outline-none text-[#12100d]"
          />
        )}

        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5">
          {locked ? (
            <span className="border border-[#12100d] bg-[#F4EFE6] px-1.5 py-0.5 rounded text-[0.65rem] font-mono font-bold text-[#12100d]/70">
              {UPLOAD_KINDS.find((k) => k.id === item.kindId)?.label.toUpperCase()}
            </span>
          ) : (
            <label className="flex items-center gap-2">
              <span className="font-mono text-[0.62rem] font-black text-[#12100d]/50">RAIL:</span>
              <select
                value={item.kindId}
                onChange={(e) => onKind(e.target.value)}
                className="border-2 border-[#12100d] bg-[#FAF6EF] px-1.5 py-0.5 rounded-lg text-[0.65rem] font-mono font-black uppercase text-[#12100d] cursor-pointer outline-none"
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
            className={`font-mono text-[0.65rem] font-black uppercase ${
              item.state === "failed"
                ? "text-[#FF5A5F]"
                : item.state === "done"
                  ? "text-emerald-600"
                  : "text-[#12100d]/50"
            }`}
          >
            {item.state === "reading" ? "READING" : item.state === "ready" ? "READY" : item.state === "saving" ? "SAVING" : item.state === "rendering" ? "ON MANNEQUIN..." : item.state === "done" ? "COMPLETED" : "FAILED"}
          </span>

          {item.dominantColor && (
            <span
              aria-hidden
              className="block h-2.5 w-2.5 rounded-full border border-[#12100d]"
              style={{ backgroundColor: item.dominantColor }}
            />
          )}
        </div>

        {!locked && (
          <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1.5">
            <label className="flex items-center gap-2">
              <span className="font-mono text-[0.62rem] font-black text-[#12100d]/50">SIZE:</span>
              <input
                value={item.sizeLabel}
                onChange={(e) => onSize(e.target.value)}
                placeholder="M"
                maxLength={12}
                aria-label="Size on the label"
                className="w-16 border-2 border-[#12100d] bg-[#FAF6EF] px-2 py-0.5 rounded-lg text-xs font-mono font-bold uppercase text-[#12100d] outline-none"
              />
            </label>
            <label className="flex items-center gap-2">
              <span className="font-mono text-[0.62rem] font-black text-[#12100d]/50">CUT:</span>
              <select
                value={item.cut}
                onChange={(e) => onCut(e.target.value as Cut)}
                className="border-2 border-[#12100d] bg-[#FAF6EF] px-1.5 py-0.5 rounded-lg text-[0.65rem] font-mono font-black uppercase text-[#12100d] cursor-pointer outline-none"
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
          <p className="font-mono text-[0.65rem] text-[#12100d]/60 mt-1 uppercase">
            SIZE {item.sizeLabel.toUpperCase()} · {item.cut.toUpperCase()}
          </p>
        )}

        {item.note && (
          <p
            className={`mt-1 font-mono text-[0.65rem] leading-snug ${
              item.state === "failed" ? "text-[#FF5A5F]" : "text-[#12100d]/50"
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
          className="border-2 border-[#12100d] bg-[#FF5A5F] px-2 py-0.5 text-xs text-white rounded-lg shadow-[1px_1px_0px_#12100d] hover:bg-[#FF3B42] cursor-pointer"
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
      className="text-[#12100d]"
    >
      <path
        d="M23 11c0-3 2-5 4.5-5S32 8 32 10.5"
        stroke="currentColor"
        strokeWidth="2.5"
      />
      <path
        d="M23 11 3 26.5c-1.2.9-.6 2.5.9 2.5h38.2c1.5 0 2.1-1.6.9-2.5L23 11Z"
        stroke="currentColor"
        strokeWidth="2.5"
      />
    </svg>
  );
}
