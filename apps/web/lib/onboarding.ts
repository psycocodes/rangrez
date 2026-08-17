import { measurementCoverage } from "./fit.ts";
import type { User } from "./types";

/**
 * What a new account still needs before the app can do its job.
 *
 * ── why this is derived and not a flag ───────────────────────────────────
 *
 * The obvious design is an `onboarded` boolean set at the end of a wizard.
 * It is also the one that goes wrong: it records that somebody *saw* the
 * steps, not that the app has what it needs. Delete your only avatar and the
 * flag still says yes, while every try-on quietly stops working.
 *
 * So each step asks the data whether it is satisfied. That makes the flow
 * re-entrant — abandon it halfway, come back a week later, and it resumes at
 * the first thing still missing — and it makes "onboarded" mean something:
 * there is a body to dress and a size to check against.
 *
 * The one thing genuinely worth remembering is that somebody chose to skip,
 * and that is a cookie rather than a column, because it is a preference about
 * being nagged rather than a fact about the account.
 */

export const SKIP_COOKIE = "rangrez_onboarding_skipped";

export type StepId = "identity" | "measurements" | "body";

export interface Step {
  id: StepId;
  title: string;
  /** One line, in the second person, saying what this buys them. */
  blurb: string;
  /** True when the account already satisfies this. */
  done: boolean;
  /**
   * Whether the app is meaningfully broken without it. The identity step is
   * never required — a name and a picture are courtesies, not capabilities.
   */
  required: boolean;
}

/** Enough of the core fields filled in for a size call to mean anything. */
const MEASUREMENTS_ENOUGH = 0.6;

export function steps(user: User): Step[] {
  return [
    {
      id: "identity",
      title: "Who you are",
      blurb: "Your name and picture, as they appear on your wardrobe.",
      done: Boolean(user.name && user.name !== "You"),
      required: false,
    },
    {
      id: "measurements",
      title: "Your measurements",
      blurb:
        "Entered once, then checked against the size chart on every shop page you open.",
      done: measurementCoverage(user.measurements) >= MEASUREMENTS_ENOUGH,
      required: true,
    },
    {
      id: "body",
      title: "A body to dress",
      blurb: "One photograph. Every garment you save gets rendered onto it.",
      done: user.avatars.length > 0,
      required: true,
    },
  ];
}

/** The first step still outstanding, or null when there is nothing left. */
export function nextStep(user: User): Step | null {
  return steps(user).find((s) => !s.done) ?? null;
}

/**
 * Whether the app can actually work for this account.
 *
 * Only the required steps count. Somebody who never typed a display name is
 * not stuck; somebody with no measurements and no body is.
 */
export function isReady(user: User): boolean {
  return steps(user).every((s) => s.done || !s.required);
}

/** How far along, 0–1, for the progress rule at the top of the flow. */
export function progress(user: User): number {
  const all = steps(user);
  return all.filter((s) => s.done).length / all.length;
}

/**
 * Where to send someone who has just arrived or just signed in.
 *
 * Four places used to decide this independently with `user.avatar ? … : …`,
 * which meant the rule was "has a body" in all of them and could only ever
 * stay in agreement by coincidence. Onboarding asks for measurements too, so
 * the question is no longer a single field, and it is answered here.
 */
export function landingFor(user: User): "/wardrobe" | "/welcome" {
  return isReady(user) ? "/wardrobe" : "/welcome";
}
