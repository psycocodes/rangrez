"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";

import { signIn, signUp, type AuthState } from "@/app/actions/auth";

type Mode = "in" | "up";

export function AuthDoor() {
  const [mode, setMode] = useState<Mode>("up");

  // One state slot per mode so switching tabs doesn't carry the other form's
  // error across with it.
  const [inState, inAction] = useActionState<AuthState, FormData>(signIn, {});
  const [upState, upAction] = useActionState<AuthState, FormData>(signUp, {});

  const isUp = mode === "up";
  const state = isUp ? upState : inState;

  return (
    <div className="flex h-full flex-col justify-between p-7 lg:p-12">
      <header className="flex items-baseline justify-between">
        <span className="spec text-ink-3">01 / The door</span>
        <span className="spec-sm text-ink-3">
          {isUp ? "NEW HAND" : "RETURNING"}
        </span>
      </header>

      <div className="py-8">
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

        {/* Mode switch, rendered as a ruled tab pair rather than a link. */}
        <div className="mb-7 flex rule-heavy">
          {(
            [
              ["up", "Create account"],
              ["in", "Sign in"],
            ] as const
          ).map(([m, label]) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              data-on={mode === m}
              className="spec flex-1 py-3 text-left transition-colors duration-300 data-[on=false]:text-ink-3 data-[on=true]:text-ink"
            >
              <span className="mr-2 opacity-45">{m === "up" ? "A" : "B"}</span>
              {label}
              {mode === m && (
                <span className="mt-2 block h-[2px] w-full bg-madder" />
              )}
            </button>
          ))}
        </div>

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

      <footer className="rule pt-5">
        <p className="max-w-[46ch] text-[0.8rem] leading-relaxed text-ink-3">
          <span className="spec-sm mr-2 text-madder">NOTE</span>
          Email and password is a placeholder while we build. Sign in with Google
          replaces it — the rest of the app never touches this code path.
        </p>
      </footer>
    </div>
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
