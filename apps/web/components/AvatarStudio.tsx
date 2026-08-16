"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import { PaletteStrip } from "./PaletteStrip";
import { guessFraming } from "@/lib/avatar-framing";
import { cutout } from "@/lib/cutout";
import {
  FRAMING,
  MAX_AVATARS,
  type Avatar,
  type AvatarFraming,
} from "@/lib/types";

type Phase = "idle" | "chosen" | "working" | "done" | "error";

/** Mirrors what the server is actually doing, in order. */
const STEPS = [
  "Uploading the plate",
  "Calibration render · Apparel VTO",
  "Skin tone & personal colour",
  "Re-ranking your wardrobe",
] as const;

export function AvatarStudio({
  avatars,
  replacing,
  userName,
  full,
  mocked,
}: {
  avatars: Avatar[];
  /** Set when re-shooting an existing plate rather than adding one. */
  replacing?: Avatar;
  userName: string;
  /** All MAX_AVATARS slots are taken and this isn't a re-shoot. */
  full: boolean;
  mocked: boolean;
}) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);

  const slot = replacing
    ? avatars.findIndex((a) => a.id === replacing.id) + 1
    : avatars.length + 1;

  const [phase, setPhase] = useState<Phase>("idle");
  const [preview, setPreview] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [label, setLabel] = useState(
    replacing?.customization.label ??
      (avatars.length === 0
        ? userName
        : `Plate ${String(slot).padStart(2, "0")}`),
  );
  const [step, setStep] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Avatar | null>(null);
  const [dragging, setDragging] = useState(false);
  const [framing, setFraming] = useState<AvatarFraming>(
    replacing?.framing ?? "full",
  );
  /** Whether the framing on screen is our guess or the user's own choice. */
  const [framingGuessed, setFramingGuessed] = useState(false);

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

      // Read the framing off the photograph so the question below it arrives
      // already answered. It is only ever a default — the control stays live.
      void guessFraming(f)
        .then((guess) => {
          setFraming(guess.framing);
          setFramingGuessed(true);
        })
        .catch(() => {
          // A photo we can't read is not a reason to block the upload; the
          // user answers the question themselves.
          setFramingGuessed(false);
        });
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
    body.append("label", label.trim());
    body.append("framing", framing);
    if (replacing) body.append("replace", replacing.id);

    // Cut the figure out of its backdrop, here, before anything is sent.
    //
    // Presentation only — YouCam gets the untouched photograph, because a
    // matte that clipped a shoulder is a matte it would fit a jacket to. This
    // is what lets the look creator stand you *in* its gradient instead of on
    // a rectangle of your hallway, and a photograph too busy to matte simply
    // doesn't send one: `confident` is false, nothing is attached, and every
    // surface falls back to the plate.
    try {
      const matte = await cutout(file, { square: false, pad: 0.02, maxSize: 1400 });
      if (matte.confident) {
        body.append("cutout", matte.blob, "cutout.png");
      }
      URL.revokeObjectURL(matte.previewUrl);
    } catch (err) {
      console.warn("[atelier] couldn't matte the plate:", err);
    }

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

  const shown = preview ?? replacing?.renderUrl ?? null;

  return (
    <div className="grid gap-10 lg:grid-cols-[1fr_1.05fr] lg:gap-16">
      {/* ── left: the brief ─────────────────────────────────────────────── */}
      <div>
        <p className="spec mb-6 text-madder">
          {replacing
            ? `Re-shooting ${replacing.customization.label}`
            : avatars.length === 0
              ? "One photograph, once"
              : `Plate ${String(slot).padStart(2, "0")} of ${MAX_AVATARS}`}
        </p>
        <h1 className="display display-lg">
          Give us
          <br />
          <span className="aside">
            {avatars.length === 0 || replacing ? "a body." : "another."}
          </span>
        </h1>
        <p className="mt-7 max-w-[46ch] text-[0.98rem] leading-relaxed text-ink-2">
          {avatars.length === 0 ? (
            <>
              This is the only photo Rangrez needs. Every garment you ever
              catalogue or try on gets composited onto it — so the shirt from
              your closet and the coat from a shop page hang on the same
              shoulders. Get this one right and you never think about it again.
            </>
          ) : (
            <>
              A second body is for a different context, not a better photograph
              — a full length next to a studio crop, or the light you actually
              dress in. Keep up to {MAX_AVATARS}; whichever is in use is what the
              wardrobe renders against.
            </>
          )}
        </p>

        {full && (
          <p className="mt-6 border-l-2 border-madder bg-madder/8 py-2.5 pl-3 text-[0.85rem] leading-relaxed text-ink-2">
            <span className="spec-sm mr-2 text-madder">SHELF FULL</span>
            All {MAX_AVATARS} plates are taken. Retire one in{" "}
            <a
              href="/profile"
              className="text-ink underline decoration-madder underline-offset-4"
            >
              your profile
            </a>
            , or re-shoot a plate you already have.
          </p>
        )}

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
            PLATE {String(slot).padStart(2, "0")} ·{" "}
            {phase === "done" ? "SET" : replacing ? "RE-SHOOT" : "UNSET"}
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
          {/* Only asked for once a shelf exists — naming your one and only
              plate is a question with no purpose. */}
          {(avatars.length > 0 || replacing) && phase !== "done" && (
            <label className="mb-5 block">
              <span className="spec-sm mb-2.5 block text-ink-3">
                CALL THIS PLATE
              </span>
              <input
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                maxLength={40}
                placeholder="Studio, full length, summer…"
                className="field"
              />
              <span className="mt-2 block text-[0.78rem] leading-relaxed text-ink-3">
                This is the name the browser extension offers when it asks which
                body to render on.
              </span>
            </label>
          )}

          {/* Asked as soon as there is a photograph to ask about, and before
              the render — this decides what the look creator will let them
              build, so it must not be a thing they discover afterwards. */}
          {phase !== "done" && (file || replacing) && (
            <fieldset className="mb-5">
              <legend className="spec-sm mb-2.5 text-ink-3">
                HOW MUCH OF YOU IS IN SHOT
              </legend>

              <div className="flex flex-col gap-px bg-ink/15">
                {(Object.keys(FRAMING) as AvatarFraming[]).map((key) => (
                  <label
                    key={key}
                    className="flex cursor-pointer items-start gap-3 bg-paper p-3 transition-colors duration-300 hover:bg-paper-2 has-checked:bg-ink has-checked:text-paper"
                  >
                    <input
                      type="radio"
                      name="framing"
                      value={key}
                      checked={framing === key}
                      onChange={() => {
                        setFraming(key);
                        setFramingGuessed(false);
                      }}
                      className="mt-0.5 h-3.5 w-3.5 shrink-0 accent-madder"
                    />
                    <span className="min-w-0">
                      <span className="spec block">{FRAMING[key].label}</span>
                      <span className="mt-1.5 block text-[0.78rem] leading-relaxed opacity-70">
                        {FRAMING[key].note}
                      </span>
                    </span>
                  </label>
                ))}
              </div>

              <p className="mt-2.5 max-w-[46ch] text-[0.78rem] leading-relaxed text-ink-3">
                {framingGuessed ? (
                  <>
                    <span className="spec-sm mr-2 text-madder">READ FROM YOUR PHOTO</span>
                    Measured off the size of your head in the frame. Change it if
                    that&apos;s wrong.
                  </>
                ) : (
                  <>
                    A try-on can only dress what the camera can see. Trousers on a
                    head-and-shoulders plate spend a render to produce a guess.
                  </>
                )}
              </p>
            </fieldset>
          )}

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
              <p className="mt-5 text-[0.85rem] leading-relaxed text-ink-2">
                <b className="tight">{result.customization.label}</b> is now the
                plate in use. Everything you try on from here lands on this body.
              </p>
              <div className="mt-6 flex flex-wrap gap-2.5">
                <a href="/wardrobe" className="btn">
                  <span className="spec">Open the wardrobe</span>
                  <span aria-hidden className="spec">→</span>
                </a>
                <a href="/profile" className="btn btn-ghost">
                  <span className="spec">Manage plates</span>
                  <span aria-hidden className="spec">◐</span>
                </a>
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2.5">
              <button
                type="button"
                onClick={submit}
                disabled={!file || phase === "working" || full}
                className="btn"
              >
                <span className="spec">
                  {phase === "working"
                    ? "In the vat"
                    : replacing
                      ? "Replace this plate"
                      : avatars.length === 0
                        ? "Make my avatar"
                        : "Add this plate"}
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
              {!file && avatars.length > 0 && (
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
