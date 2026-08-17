"use client";

import Image from "next/image";
import Link from "next/link";
import { useState, useTransition } from "react";

import { saveDisplayName } from "@/app/actions/profile";
import { MeasurementsForm } from "./MeasurementsForm";
import { profilePhoto } from "@/lib/profile-photo";
import { steps as buildSteps } from "@/lib/onboarding";
import type { User } from "@/lib/types";

/**
 * First run.
 *
 * Three steps, and the order is the order of consequence rather than the order
 * of effort: who you are, what size you are, what body the clothes go on. The
 * last one is the slowest and the most valuable, which is exactly why it is
 * not first — a wizard that opens on "upload a full-length photograph of
 * yourself" is a wizard people close.
 *
 * Every step is skippable and the whole flow is re-entrant, because each one
 * reads its done-ness off the account rather than off a counter (see
 * lib/onboarding.ts). Somebody who bails after measurements and comes back
 * next week lands on the body step, not at the beginning.
 */
export function Onboarding({ user }: { user: User }) {
  const steps = buildSteps(user);
  const firstUndone = steps.findIndex((s) => !s.done);
  const [at, setAt] = useState(firstUndone === -1 ? 0 : firstUndone);
  const [name, setName] = useState(user.name === "You" ? "" : user.name);
  const [pending, start] = useTransition();

  const step = steps[at];
  const last = at === steps.length - 1;

  const go = (n: number) => setAt(Math.max(0, Math.min(steps.length - 1, n)));

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8">
      {/* ── where you are ─────────────────────────────────────────────── */}
      <ol className="mb-8 flex items-stretch gap-2" aria-label="Setup progress">
        {steps.map((s, i) => (
          <li key={s.id} className="flex-1">
            <button
              type="button"
              onClick={() => go(i)}
              aria-current={i === at ? "step" : undefined}
              className={`w-full rounded-brut border-[3px] border-abyss px-3 py-2 text-left transition-[translate,box-shadow] ${
                i === at
                  ? "bg-brass shadow-brut"
                  : s.done
                    ? "bg-leaf shadow-brut-sm"
                    : "bg-paper/60 shadow-brut-sm"
              }`}
            >
              <span className="spec-sm block opacity-60">
                {String(i + 1).padStart(2, "0")}
                {s.done ? " · DONE" : s.required ? " · NEEDED" : " · OPTIONAL"}
              </span>
              <span className="spec block truncate">{s.title}</span>
            </button>
          </li>
        ))}
      </ol>

      <div className="rounded-brut border-[3px] border-abyss bg-leaf p-5 shadow-brut sm:p-7">
        <h1 className="display text-[clamp(1.6rem,4vw,2.4rem)]">{step.title}</h1>
        <p className="mt-1 text-[0.95rem] text-ink-3">{step.blurb}</p>

        <div className="mt-6">
          {step.id === "identity" && (
            <IdentityStep
              user={user}
              name={name}
              onName={setName}
              pending={pending}
              onSave={() => {
                const fd = new FormData();
                fd.set("name", name.trim());
                start(async () => {
                  await saveDisplayName(fd);
                  go(at + 1);
                });
              }}
            />
          )}

          {step.id === "measurements" && (
            /* The same form the profile page uses. A second, simpler copy for
               onboarding would be two forms to keep in agreement about what a
               chest measurement is. */
            <MeasurementsForm measurements={user.measurements} />
          )}

          {step.id === "body" && <BodyStep user={user} />}
        </div>

        {/* ── moving on ─────────────────────────────────────────────────── */}
        <div className="mt-7 flex flex-wrap items-center justify-between gap-3 border-t-[3px] border-abyss pt-5">
          <button
            type="button"
            onClick={() => go(at - 1)}
            disabled={at === 0}
            className="btn btn-ghost disabled:cursor-not-allowed disabled:opacity-40"
          >
            ← Back
          </button>

          <div className="flex items-center gap-3">
            {/* Skipping is a first-class exit, not a dark pattern. Anything
                skipped is still outstanding next time, because the step reads
                the account rather than a "seen" flag. */}
            <Link href="/wardrobe" className="spec-sm underline underline-offset-4 opacity-70">
              {step.required ? "Skip for now" : "Skip"}
            </Link>

            {last ? (
              <Link href="/wardrobe" className="btn">
                Open the wardrobe →
              </Link>
            ) : (
              <button type="button" onClick={() => go(at + 1)} className="btn">
                Next →
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function IdentityStep({
  user,
  name,
  onName,
  onSave,
  pending,
}: {
  user: User;
  name: string;
  onName: (v: string) => void;
  onSave: () => void;
  pending: boolean;
}) {
  const photo = profilePhoto(user);
  const fromGoogle = Boolean(user.googlePhotoUrl);

  return (
    <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
      <div className="relative h-28 w-28 shrink-0 overflow-hidden rounded-full border-[3px] border-abyss shadow-brut">
        <Image src={photo} alt="" fill sizes="112px" className="object-cover" />
      </div>

      <div className="min-w-0 flex-1">
        <label className="spec-sm block" htmlFor="onboarding-name">
          Display name
        </label>
        <input
          id="onboarding-name"
          value={name}
          onChange={(e) => onName(e.target.value)}
          placeholder="What should we call you?"
          className="field mt-1 w-full"
          autoComplete="name"
        />
        <p className="spec-sm mt-2 opacity-70">
          {fromGoogle
            ? "Picture taken from your Google account. You can replace it later in your profile."
            : "No Google picture on this account — a drawing stands in until you upload one."}
        </p>

        <button
          type="button"
          onClick={onSave}
          disabled={pending || !name.trim()}
          className="btn mt-4 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {pending ? "Saving…" : "Save and continue →"}
        </button>
      </div>
    </div>
  );
}

function BodyStep({ user }: { user: User }) {
  const has = user.avatars.length > 0;

  return (
    <div>
      {has ? (
        <p className="text-[0.95rem]">
          You have {user.avatars.length === 1 ? "a body" : `${user.avatars.length} bodies`} set up.
          Every garment you save from now on is rendered onto{" "}
          {user.avatars.length === 1 ? "it" : "the active one"}.
        </p>
      ) : (
        <p className="text-[0.95rem]">
          One full-length photograph, taken straight on. It becomes the body every
          garment is rendered onto — so it is worth doing once, properly.
        </p>
      )}

      {/* A link rather than the form inline: shooting an avatar has its own
          crop, framing and confirmation steps, and nesting all of that inside a
          wizard card gives two scroll containers fighting each other. */}
      <Link href="/atelier" className="btn mt-4 inline-flex">
        {has ? "Add another body" : "Set up your body →"}
      </Link>
    </div>
  );
}
