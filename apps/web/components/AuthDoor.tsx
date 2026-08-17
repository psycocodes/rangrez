"use client";

import { useActionState, useState, useTransition } from "react";
import { useFormStatus } from "react-dom";

import {
  signIn,
  signInWithGoogle,
  signUp,
  type AuthState,
} from "@/app/actions/auth";

type Mode = "in" | "up";

export function AuthDoor({
  oauthError,
  google,
}: {
  oauthError?: string;
  /** Only offered when the project actually has the provider switched on. */
  google?: boolean;
}) {
  const [mode, setMode] = useState<Mode>("up");

  // One state slot per mode so switching tabs doesn't carry the other form's
  // error across with it.
  const [inState, inAction] = useActionState<AuthState, FormData>(signIn, {});
  const [upState, upAction] = useActionState<AuthState, FormData>(signUp, {});

  const isUp = mode === "up";
  const state = isUp ? upState : inState;

  return (
    <div className="flex h-full flex-col p-7 lg:p-12">
      <header className="flex items-baseline justify-between">
        <span className="spec text-ink-3">01 / The door</span>
        <span className="spec-sm text-ink-3">
          {isUp ? "NEW HAND" : "RETURNING"}
        </span>
      </header>

      <div className="flex flex-1 flex-col justify-center py-8">
        <div className="mb-7">
          <h2 className="display display-door">
            {isUp ? (
              <>
                Open an
                <br />
                <span className="aside">account.</span>
              </>
            ) : (
              <>
                Back to
                <br />
                <span className="aside">the table.</span>
              </>
            )}
          </h2>
        </div>

        {/* Mode switch.
            This was a pair of 10px mono labels under a rule — in the house
            voice, but so quiet that people didn't register there was a choice
            at all. It is now a segmented control: a hard border around both,
            the active half filled solid, and the madder rule kept on top of it
            so it still reads as Rangrez rather than as a default toggle. */}
        <div
          role="tablist"
          aria-label="Sign in or create an account"
          className="mb-7 grid max-w-[30rem] grid-cols-2 border border-ink"
        >
          {(
            [
              ["up", "Create account"],
              ["in", "Sign in"],
            ] as const
          ).map(([m, label]) => (
            <button
              key={m}
              type="button"
              role="tab"
              aria-selected={mode === m}
              onClick={() => setMode(m)}
              data-on={mode === m}
              className="group relative py-3.5 text-center transition-colors duration-300 data-[on=false]:text-ink-2 data-[on=false]:hover:bg-ink/8 data-[on=true]:bg-ink data-[on=true]:text-paper"
            >
              {mode === m && (
                <span className="absolute inset-x-0 top-0 h-[3px] bg-madder" />
              )}
              <span className="font-mono text-[0.7rem] font-semibold uppercase tracking-[0.16em]">
                {label}
              </span>
            </button>
          ))}
        </div>

        {oauthError && (
          <p
            role="alert"
            className="mb-5 max-w-[30rem] border-l-2 border-madder bg-madder/8 py-2 pl-3 text-[0.85rem] leading-snug text-madder"
          >
            {oauthError}
          </p>
        )}

        {!google && process.env.NODE_ENV === "development" && (
          <p className="mb-7 max-w-[30rem] border-l-2 border-turmeric bg-turmeric/12 py-2.5 pl-3 text-[0.8rem] leading-relaxed text-ink-2">
            <span className="spec-sm mr-2 text-ink">GOOGLE IS OFF</span>
            Supabase reports the provider disabled, so the button is hidden
            rather than sending you to a dead end. Paste the client ID and
            secret into <b>Authentication → Sign In / Providers → Google</b> and
            reload — nothing to change here.
          </p>
        )}

        {google && (
          <>
            <GoogleButton mode={mode} />
            <div className="my-7 flex max-w-[30rem] items-center gap-4">
              <span className="h-px flex-1 bg-ink/20" />
              <span className="spec-sm text-ink-3">or with an email</span>
              <span className="h-px flex-1 bg-ink/20" />
            </div>
          </>
        )}

        <form
          key={mode}
          action={isUp ? upAction : inAction}
          className="flex max-w-[30rem] flex-col gap-7"
        >
          {isUp && (
            <Field
              label="What we print under the plate"
              name="name"
              autoComplete="name"
              placeholder="Your name"
              required
            />
          )}
          <Field
            label="Email"
            name="email"
            type="email"
            autoComplete="email"
            placeholder="you@somewhere.com"
            required
          />
          <Field
            label={isUp ? "Password · eight characters minimum" : "Password"}
            name="password"
            type="password"
            autoComplete={isUp ? "new-password" : "current-password"}
            placeholder="••••••••"
            required
          />

          {state.notice && (
            <p
              role="status"
              className="border-l-2 border-turmeric bg-turmeric/12 py-2 pl-3 text-[0.85rem] leading-relaxed text-ink-2"
            >
              {state.notice}
            </p>
          )}

          {state.error && (
            <p
              role="alert"
              className="border-l-2 border-madder bg-madder/8 py-2 pl-3 text-[0.85rem] leading-snug text-madder"
            >
              {state.error}
            </p>
          )}

          <Submit label={isUp ? "Open the account" : "Sign in"} />
        </form>
      </div>

    </div>
  );
}

/**
 * Google is the fast path, so it sits above the email form rather than under
 * it. Deliberately the one control on this page in the *opposite* skin to the
 * submit button — paper on ink below, ink on paper here — so the two never
 * compete for the same glance.
 */
function GoogleButton({ mode }: { mode: Mode }) {
  const [pending, start] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => start(() => void signInWithGoogle())}
      className="group flex w-full max-w-[30rem] items-center justify-center gap-3 border border-ink bg-paper py-3.5 transition-colors duration-300 hover:bg-ink/8 disabled:opacity-50"
    >
      <GoogleMark />
      <span className="font-mono text-[0.7rem] font-semibold uppercase tracking-[0.16em]">
        {pending
          ? "Taking you to Google"
          : mode === "up"
            ? "Continue with Google"
            : "Sign in with Google"}
      </span>
    </button>
  );
}

function GoogleMark() {
  return (
    <svg width="16" height="16" viewBox="0 0 18 18" aria-hidden className="shrink-0">
      <path
        fill="#4285F4"
        d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62Z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18Z"
      />
      <path
        fill="#FBBC05"
        d="M3.97 10.72a5.4 5.4 0 0 1 0-3.44V4.95H.96a9 9 0 0 0 0 8.1l3.01-2.33Z"
      />
      <path
        fill="#EA4335"
        d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.59C13.46.9 11.43 0 9 0A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58Z"
      />
    </svg>
  );
}

function Field({
  label,
  ...props
}: { label: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="block">
      <span className="spec-sm mb-2.5 block text-ink-3">{label}</span>
      <input className="field" {...props} />
    </label>
  );
}

function Submit({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn w-full max-w-[22rem]" disabled={pending}>
      <span className="spec">{pending ? "Working" : label}</span>
      <span aria-hidden className="spec">
        {pending ? "···" : "→"}
      </span>
    </button>
  );
}
