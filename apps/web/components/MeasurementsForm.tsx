"use client";

import { useState, useTransition } from "react";

import { saveMeasurements } from "@/app/actions/profile";
import {
  fromCm,
  MEASUREMENT_FIELDS,
  toCm,
  type MeasureUnit,
  type Measurements,
} from "@/lib/fit";

/**
 * The body, entered once.
 *
 * This is the least glamorous screen in the product and the one that makes the
 * extension worth installing: without it a product page can only ever show you
 * what a garment *looks* like, and with it the same page can tell you which
 * size to order. So the design's whole job is to make nine optional numbers
 * feel like three required ones.
 *
 * Three moves toward that:
 *
 *   · the three that matter are separated out and counted, so partial credit
 *     is visible — two of three is genuinely useful and should look it
 *   · centimetres and inches are a display toggle, not a stored preference
 *     that quietly rescales the numbers; storage is always cm
 *   · every field says where to put the tape, because "waist" means three
 *     different heights to three different people and the wrong one is worse
 *     than a blank
 */
export function MeasurementsForm({ measurements }: { measurements: Measurements }) {
  const [unit, setUnit] = useState<MeasureUnit>(measurements.unit ?? "cm");
  const [values, setValues] = useState<Record<string, string>>(() => {
    const seed: Record<string, string> = {};
    for (const field of MEASUREMENT_FIELDS) {
      const cm = measurements[field.key];
      seed[field.key] = typeof cm === "number" ? show(field.key, cm, measurements.unit ?? "cm") : "";
    }
    return seed;
  });
  const [saved, setSaved] = useState(false);
  const [pending, start] = useTransition();

  /** Re-express what is on screen, without touching what it means. */
  function switchUnit(next: MeasureUnit) {
    if (next === unit) return;
    setValues((current) => {
      const converted: Record<string, string> = {};
      for (const field of MEASUREMENT_FIELDS) {
        const raw = current[field.key];
        const n = Number(raw);
        if (!raw || !Number.isFinite(n) || isLiteral(field.key)) {
          converted[field.key] = raw;
          continue;
        }
        converted[field.key] = trim(fromCm(toCm(n, unit), next));
      }
      return converted;
    });
    setUnit(next);
    setSaved(false);
  }

  const core = MEASUREMENT_FIELDS.filter((f) => f.core);
  const extra = MEASUREMENT_FIELDS.filter((f) => !f.core);
  const filled = core.filter((f) => values[f.key]?.trim()).length;

  return (
    <form
      action={(data) => {
        setSaved(false);
        start(async () => {
          await saveMeasurements(data);
          setSaved(true);
        });
      }}
    >
      <input type="hidden" name="unit" value={unit} />

      <div className="mb-7 flex flex-wrap items-end justify-between gap-x-8 gap-y-4">
        <p className="max-w-[52ch] text-[0.9rem] leading-relaxed text-ink-2">
          A render shows you the jacket. Only these tell you whether to order
          the M. Fill in the first three and every product page you open gets a
          size recommendation — the rest sharpen it.
        </p>

        <div className="flex items-center gap-2.5">
          <span className="spec-sm text-ink-3">UNITS</span>
          <div className="flex">
            {(["cm", "in"] as const).map((u) => (
              <button
                key={u}
                type="button"
                onClick={() => switchUnit(u)}
                aria-pressed={unit === u}
                className={`spec-sm border px-2.5 py-1.5 transition-colors duration-300 ${
                  unit === u
                    ? "border-ink bg-ink text-paper"
                    : "border-ink/25 text-ink-3 hover:border-ink"
                } ${u === "in" ? "-ml-px" : ""}`}
              >
                {u.toUpperCase()}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── the three that do the work ─────────────────────────────────── */}
      <div className="mb-3 flex items-baseline justify-between gap-4">
        <span className="spec-sm text-madder">THE THREE THAT MATTER</span>
        <span className="spec-sm text-ink-3">{filled} OF {core.length}</span>
      </div>
      <div className="grid gap-px bg-ink/15 sm:grid-cols-3">
        {core.map((field) => (
          <Field
            key={field.key}
            field={field}
            unit={unit}
            value={values[field.key] ?? ""}
            onChange={(v) => {
              setValues((c) => ({ ...c, [field.key]: v }));
              setSaved(false);
            }}
          />
        ))}
      </div>

      {/* ── everything else ────────────────────────────────────────────── */}
      <p className="spec-sm mb-3 mt-8 text-ink-3">
        SHARPENS IT — ALL OPTIONAL
      </p>
      <div className="grid gap-px bg-ink/15 sm:grid-cols-3 lg:grid-cols-6">
        {extra.map((field) => (
          <Field
            key={field.key}
            field={field}
            unit={unit}
            value={values[field.key] ?? ""}
            onChange={(v) => {
              setValues((c) => ({ ...c, [field.key]: v }));
              setSaved(false);
            }}
          />
        ))}
      </div>

      <div className="mt-7 flex flex-wrap items-center gap-x-5 gap-y-3">
        <button type="submit" disabled={pending} className="btn disabled:opacity-40">
          <span className="spec">{pending ? "Saving" : "Save my measurements"}</span>
          <span aria-hidden className="spec">→</span>
        </button>
        {saved && !pending && (
          <span className="spec-sm text-ink-3">
            SAVED — EVERY PRODUCT PAGE NOW KNOWS
          </span>
        )}
        {measurements.updatedAt && !saved && (
          <span className="spec-sm text-ink-3">
            LAST MEASURED{" "}
            {new Date(measurements.updatedAt).toLocaleDateString("en-GB", {
              day: "2-digit",
              month: "short",
              year: "numeric",
            })}
          </span>
        )}
      </div>

      <p className="rule mt-7 max-w-[68ch] pt-3 text-[0.8rem] leading-relaxed text-ink-3">
        Kept on your row and nowhere else. The browser extension never holds
        these — it sends the shop&apos;s size chart to Rangrez and gets a size
        back, so a product page never sees your body.
      </p>
    </form>
  );
}

function Field({
  field,
  unit,
  value,
  onChange,
}: {
  field: (typeof MEASUREMENT_FIELDS)[number];
  unit: MeasureUnit;
  value: string;
  onChange: (v: string) => void;
}) {
  const suffix = unitFor(field.key, unit);
  return (
    <label className="group block bg-paper p-3.5 transition-colors duration-300 focus-within:bg-paper-2">
      <span className="spec-sm mb-2 block text-ink-3">
        {field.label.toUpperCase()} · {suffix.toUpperCase()}
      </span>
      <input
        name={field.key}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        inputMode="decimal"
        placeholder="—"
        aria-label={`${field.label} in ${suffix}`}
        className="display w-full bg-transparent text-[1.6rem] leading-none outline-none placeholder:text-ink-3/40"
      />
      <span className="mt-2 block text-[0.72rem] leading-snug text-ink-3">
        {field.hint}
      </span>
    </label>
  );
}

/* ── units ───────────────────────────────────────────────────────────────── */

/** Weight and shoe size are not lengths; the cm/in toggle must not touch them. */
const isLiteral = (key: string) => key === "weightKg" || key === "footEu";

function unitFor(key: string, unit: MeasureUnit): string {
  if (key === "weightKg") return "kg";
  if (key === "footEu") return "eu";
  return unit;
}

function show(key: string, cm: number, unit: MeasureUnit): string {
  return isLiteral(key) ? trim(cm) : trim(fromCm(cm, unit));
}

/** One decimal, and no trailing ".0" — nobody writes their chest as 98.0. */
function trim(n: number): string {
  return String(Math.round(n * 10) / 10);
}
