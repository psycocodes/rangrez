import Link from "next/link";

import { Knot } from "@/components/Wordmark";
import { dbReady } from "@/lib/db";
import { hasSupabase } from "@/lib/supabase";

export const metadata = { title: "Setup — Rangrez" };
export const dynamic = "force-dynamic";

/**
 * The wall you hit before the database exists.
 *
 * Rangrez authenticates with its own cookie rather than Supabase Auth, so
 * there's no row policy that can key off a user — which means the server needs
 * the secret key and the publishable one can't stand in. Rather than throw a
 * stack trace at whoever cloned this, say exactly what's missing.
 */
export default async function SetupPage() {
  const configured = hasSupabase();
  const probe = configured ? await dbReady() : "No Supabase credentials found.";
  const ready = probe === true;

  const hasSecret = Boolean(
    process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY,
  );

  const steps: Array<[string, string, boolean]> = [
    [
      "Add the project URL and keys",
      "NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY in apps/web/.env.local. The secret key is under Project Settings → API keys → secret. The publishable key ships to the browser and cannot read a table with RLS on, so the server needs the secret one.",
      hasSecret,
    ],
    [
      "Run the schema",
      "Paste apps/web/supabase/schema.sql into the Supabase SQL editor and run it. It's idempotent — safe to run twice.",
      ready,
    ],
    [
      "Bring your existing wardrobe over (optional)",
      "node apps/web/scripts/migrate-json-to-supabase.mjs — moves anything still in .data/db.json, including your avatar and colour season.",
      false,
    ],
  ];

  return (
    <main className="weave grain min-h-dvh px-5 py-10 lg:px-10 lg:py-16">
      <div className="mx-auto max-w-[52rem]">
        <div className="flex items-center justify-between border-b border-ink/15 pb-3">
          <span className="inline-flex items-center gap-2">
            <Knot size={15} />
            <span className="spec">RANGREZ</span>
          </span>
          <span className="spec-sm text-ink-3">SETUP</span>
        </div>

        <h1 className="display display-lg mt-12">
          The dye house
          <br />
          <span className="aside">isn&apos;t open yet.</span>
        </h1>

        <p className="mt-7 max-w-[52ch] text-[0.98rem] leading-relaxed text-ink-2">
          Rangrez stores wardrobes in Supabase. Three short steps and it&apos;s
          running — the app will pick this up on the next reload, no restart
          needed for the schema step.
        </p>

        <div className="mt-10 border-t-2 border-ink">
          {steps.map(([title, body, done], i) => (
            <div key={title} className="flex gap-4 border-b border-ink/15 py-5">
              <span
                className={`spec-sm w-7 shrink-0 pt-1 ${done ? "text-turmeric" : "text-madder"}`}
              >
                {done ? "✓" : String(i + 1).padStart(2, "0")}
              </span>
              <div>
                <p className="tight text-[0.98rem]">{title}</p>
                <p className="mt-2 max-w-[62ch] font-mono text-[0.78rem] leading-relaxed text-ink-3">
                  {body}
                </p>
              </div>
            </div>
          ))}
        </div>

        {!ready && (
          <div className="mt-8 border-l-2 border-madder bg-madder/8 py-3 pl-4">
            <p className="spec-sm mb-2 text-madder">WHAT SUPABASE SAID</p>
            <p className="font-mono text-[0.78rem] leading-relaxed text-ink-2">
              {typeof probe === "string" ? probe : "—"}
            </p>
          </div>
        )}

        {ready && (
          <Link href="/" className="btn mt-10">
            <span className="spec">Everything&apos;s ready — open Rangrez</span>
            <span aria-hidden className="spec">→</span>
          </Link>
        )}
      </div>
    </main>
  );
}
