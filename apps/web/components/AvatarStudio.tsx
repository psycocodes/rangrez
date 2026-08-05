"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import { PaletteStrip } from "./PaletteStrip";
import type { Avatar } from "@/lib/types";

type Phase = "idle" | "chosen" | "working" | "done" | "error";

/** Mirrors what the server is actually doing, in order. */
const STEPS = [
  "Uploading the plate",
  "Calibration render · Apparel VTO",
  "Skin tone & personal colour",
  "Re-ranking your wardrobe",
] as const;

export function AvatarStudio({
  existing,
  mocked,
}: {
  existing?: Avatar;
  mocked: boolean;
}) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);

  const [phase, setPhase] = useState<Phase>("idle");
  const [preview, setPreview] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [step, setStep] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Avatar | null>(null);
  const [dragging, setDragging] = useState(false);

  // Object URLs leak if you don't revoke them.
  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  // Advance the visible step while the single round trip is in flight. The
  // last step only lands when the server actually answers.
  useEffect(() => {
    if (phase !== "working") return;
    const t = setInterval(
      () => setStep((s) => Math.min(s + 1, STEPS.length - 2)),
      1400,
    );
    return () => clearInterval(t);
  }, [phase]);

  const choose = useCallback(
    (f: File | undefined) => {
      if (!f) return;
      if (!f.type.startsWith("image/")) {
        setError("That needs to be an image — JPG, PNG or WebP.");
        setPhase("error");
        return;
      }
      setError(null);
      setFile(f);
      setPreview((old) => {
        if (old) URL.revokeObjectURL(old);
        return URL.createObjectURL(f);
      });
      setPhase("chosen");
    },
    [],
  );

  async function submit() {
    if (!file) return;
    setPhase("working");
    setStep(0);
    setError(null);

    const body = new FormData();
    body.append("photo", file);

    try {
      const res = await fetch("/api/avatar", { method: "POST", body });
      const json = await res.json();

      if (!res.ok) throw new Error(json.error ?? "The dye house refused that photo.");

      setStep(STEPS.length - 1);
      setResult(json.avatar as Avatar);
      setPhase("done");
      // Pull the new avatar into every server component (top bar, wardrobe).
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setPhase("error");
    }
  }

  function reset() {
    setPhase("idle");
    setFile(null);
    setResult(null);
    setError(null);
    if (preview) URL.revokeObjectURL(preview);
    setPreview(null);
  }

  const shown = preview ?? existing?.renderUrl ?? null;

  return (
    <div className="grid gap-10 lg:grid-cols-[1fr_1.05fr] lg:gap-16">
      {/* ── left: the brief ─────────────────────────────────────────────── */}
      <div>
        <p className="spec mb-6 text-madder">
          {existing ? "Re-shoot" : "One photograph, once"}
        </p>
        <h1 className="display display-lg">
          Give us
          <br />
          <span className="aside">a body.</span>
        </h1>
        <p className="mt-7 max-w-[46ch] text-[0.98rem] leading-relaxed text-ink-2">
          This is the only photo Rangrez needs. Every garment you ever catalogue
          or try on gets composited onto it — so the shirt from your closet and
          the coat from a shop page hang on the same shoulders. Get this one
          right and you never think about it again.
        </p>

        <div className="mt-10 border-t-2 border-ink">
          {[
            ["Stand square to the camera", "Front-facing, arms relaxed at your sides. Turned shoulders make the try-on guess at your silhouette."],
            ["One flat, even light", "A window at midday beats a ring light. Hard shadows get baked into every render that follows."],
            ["Plain wall behind you", "The segmentation has to find your edges. A busy background is the single biggest cause of a bad plate."],
            ["Close-fitting clothes", "Bulky layers change your outline. A tee and trousers give the truest body to dress."],
          ].map(([title, body], i) => (
            <div key={title} className="flex gap-4 border-b border-ink/15 py-4">
              <span className="spec-sm w-6 shrink-0 pt-1 text-madder">
                {String(i + 1).padStart(2, "0")}
              </span>
              <div>
                <p className="tight text-[0.95rem]">{title}</p>
                <p className="mt-1.5 max-w-[42ch] text-[0.82rem] leading-relaxed text-ink-3">
                  {body}
                </p>
              </div>
            </div>
          ))}
        </div>

        {mocked && (
          <p className="mt-6 border-l-2 border-turmeric bg-turmeric/12 py-2.5 pl-3 text-[0.8rem] leading-relaxed text-ink-2">
            <span className="spec-sm mr-2 text-ink">MOCK MODE</span>
            No YouCam key is set, so the calibration render is simulated and your
            photo is used as the plate directly. Colour-season analysis is derived
            locally and is deterministic per photo. Add{" "}
            <code className="font-mono text-[0.75rem]">YOUCAM_API_KEY</code> to{" "}
            <code className="font-mono text-[0.75rem]">.env.local</code> and set{" "}
            <code className="font-mono text-[0.75rem]">YOUCAM_MOCK=0</code> to go live.
          </p>
        )}
      </div>

      {/* ── right: the plate ────────────────────────────────────────────── */}
      <div className="lg:sticky lg:top-28 lg:self-start">
        <div className="mb-3 flex items-baseline justify-between">
          <span className="spec-sm text-ink-3">
            {phase === "done" ? "PLATE 01 · SET" : "PLATE 01 · UNSET"}
          </span>
          <span className="spec-sm text-ink-3">3 : 4</span>
        </div>

        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            choose(e.dataTransfer.files?.[0]);
          }}
          className={`plate relative aspect-[3/4] w-full overflow-hidden bg-vat transition-colors duration-300 ${
            dragging ? "!bg-indigo" : ""
          }`}
        >
          {shown ? (
            <Image
              src={shown}
              alt="Your base avatar"
              fill
              sizes="(max-width: 1024px) 100vw, 560px"
              className={`object-cover transition-all duration-700 ${
                phase === "working" ? "opacity-45 saturate-0" : "opacity-100"
              }`}
              unoptimized={Boolean(preview)}
            />
          ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-5 p-8 text-center text-paper">
              <div
                aria-hidden
                className="absolute inset-0 opacity-[0.16]"
                style={{
                  backgroundImage:
                    "repeating-linear-gradient(135deg,#fff 0 1px,transparent 1px 9px)",
                }}
              />
              <Silhouette />
              <p className="display display-md relative">
                Drop your
                <br />
                <span className="aside">photograph.</span>
              </p>
              <button
                type="button"
                onClick={() => input.current?.click()}
                className="btn btn-invert relative"
              >
                <span className="spec">Choose a file</span>
                <span aria-hidden className="spec">↑</span>
              </button>
            </div>
          )}

          {phase === "working" && (
            <>
              <span aria-hidden className="scan absolute inset-x-0 top-0 z-10 h-px bg-turmeric" />
              <div className="absolute inset-x-0 bottom-0 z-10 bg-ink/85 p-4 text-paper">
                <ol className="space-y-2">
                  {STEPS.map((label, i) => (
                    <li key={label} className="flex items-center gap-2.5">
                      <span
                        className={`h-1.5 w-1.5 shrink-0 rounded-full transition-colors duration-500 ${
                          i < step
                            ? "bg-turmeric"
                            : i === step
                              ? "bg-madder"
                              : "bg-paper/25"
                        }`}
                      />
                      <span
                        className={`spec-sm transition-opacity duration-500 ${
                          i <= step ? "text-paper" : "text-paper/40"
                        }`}
                      >
                        {label}
                      </span>
                    </li>
                  ))}
                </ol>
              </div>
            </>
          )}
        </div>

        <input
          ref={input}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="sr-only"
          onChange={(e) => choose(e.target.files?.[0])}
        />

        {/* ── the actions under the plate ──────────────────────────────── */}
        <div className="mt-5">
          {error && (
            <p
              role="alert"
              className="mb-4 border-l-2 border-madder bg-madder/8 py-2 pl-3 text-[0.85rem] leading-snug text-madder"
            >
              {error}
            </p>
          )}

          {phase === "done" && result ? (
            <div className="rise">
              <div className="rule-heavy pt-4">
                <p className="spec-sm mb-2 text-ink-3">ANALYSIS COMPLETE</p>
                <p className="display display-md mb-5">
                  You are a{" "}
                  <span className="aside">{result.colorSeason?.name}.</span>
                </p>
                {result.colorSeason && <PaletteStrip season={result.colorSeason} />}
              </div>
              <div className="mt-6 flex flex-wrap gap-2.5">
                <a href="/wardrobe" className="btn">
                  <span className="spec">Open the wardrobe</span>
                  <span aria-hidden className="spec">→</span>
                </a>
                <button type="button" onClick={reset} className="btn btn-ghost">
                  <span className="spec">Shoot another</span>
                  <span aria-hidden className="spec">↺</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2.5">
              <button
                type="button"
                onClick={submit}
                disabled={!file || phase === "working"}
                className="btn"
              >
                <span className="spec">
                  {phase === "working" ? "In the vat" : "Make my avatar"}
                </span>
                <span aria-hidden className="spec">
                  {phase === "working" ? "···" : "→"}
                </span>
              </button>
              {file && phase !== "working" && (
                <button type="button" onClick={reset} className="btn btn-ghost">
                  <span className="spec">Discard</span>
                  <span aria-hidden className="spec">×</span>
                </button>
              )}
              {!file && existing && (
                <a href="/wardrobe" className="btn btn-ghost">
                  <span className="spec">Keep the current plate</span>
                  <span aria-hidden className="spec">→</span>
                </a>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Silhouette() {
  return (
    <svg
      width="54"
      height="88"
      viewBox="0 0 54 88"
      fill="none"
      aria-hidden
      className="relative opacity-45"
    >
      <circle cx="27" cy="13" r="9.5" stroke="currentColor" strokeWidth="1.2" />
      <path
        d="M9 87V44c0-9.4 8-17 18-17s18 7.6 18 17v43"
        stroke="currentColor"
        strokeWidth="1.2"
      />
      <path d="M9 52H1M45 52h8M27 27v60" stroke="currentColor" strokeWidth="0.8" opacity="0.55" />
    </svg>
  );
}
