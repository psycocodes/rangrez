"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";

import { saveCustomization } from "@/app/actions/profile";
import { AvatarPlate } from "./AvatarPlate";
import type { Avatar, AvatarCustomization } from "@/lib/types";

const BACKDROPS: Array<[AvatarCustomization["backdrop"], string, string]> = [
  ["paper", "Khadi", "#D8CFBA"],
  ["vat", "Vat", "#161D3D"],
  ["madder", "Madder", "#8E3520"],
  ["studio", "Studio", "#14120E"],
];

const CROPS: Array<[AvatarCustomization["crop"], string]> = [
  ["full", "Full length"],
  ["three-quarter", "Three-quarter"],
  ["bust", "Bust"],
];

/**
 * Live-previewing plate editor.
 *
 * Local state drives the same <AvatarPlate/> the rest of the app renders, so
 * what you see here is literally what a garment card will composite against —
 * no second implementation to drift out of sync.
 */
export function PlateCustomiser({ avatar }: { avatar: Avatar }) {
  const [draft, setDraft] = useState<AvatarCustomization>(avatar.customization);

  const set = <K extends keyof AvatarCustomization>(
    key: K,
    value: AvatarCustomization[K],
  ) => setDraft((d) => ({ ...d, [key]: value }));

  const dirty =
    JSON.stringify(draft) !== JSON.stringify(avatar.customization);

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_1.1fr] lg:gap-10">
      <div className="lg:order-2">
        <div className="mb-3 flex items-baseline justify-between">
          <span className="spec-sm text-ink-3">LIVE PREVIEW</span>
          <span className="spec-sm text-madder">{dirty ? "UNSAVED" : "SAVED"}</span>
        </div>
        <AvatarPlate avatar={avatar} override={draft} />
      </div>

      <form action={saveCustomization} className="lg:order-1">
        {/* Which plate this edits. Named explicitly rather than left to mean
            "the active one" — the shelf lets you edit a spare. */}
        <input type="hidden" name="id" value={avatar.id} />
        {/* Mirrors of the local state, so the server action gets the draft. */}
        <input type="hidden" name="backdrop" value={draft.backdrop} />
        <input type="hidden" name="crop" value={draft.crop} />
        <input type="hidden" name="grade" value={draft.grade} />

        <Row label="Backdrop" note="What the plate is composited against.">
          <div className="flex flex-wrap gap-1.5">
            {BACKDROPS.map(([key, label, hex]) => (
              <button
                key={key}
                type="button"
                onClick={() => set("backdrop", key)}
                data-on={draft.backdrop === key}
                className="chip"
              >
                <span
                  aria-hidden
                  className="block h-3 w-3 self-center border border-ink/25"
                  style={{ backgroundColor: hex }}
                />
                <span className="spec">{label}</span>
              </button>
            ))}
          </div>
        </Row>

        <Row label="Crop" note="How tight the plate frames the body.">
          <div className="flex flex-wrap gap-1.5">
            {CROPS.map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => set("crop", key)}
                data-on={draft.crop === key}
                className="chip"
              >
                <span className="spec">{label}</span>
              </button>
            ))}
          </div>
        </Row>

        <Row
          label="Grade"
          note="Warms or cools the plate. Match it to the light you usually dress in."
        >
          <div className="flex items-center gap-3">
            <span className="spec-sm text-indigo">COOL</span>
            <input
              type="range"
              min={-100}
              max={100}
              step={5}
              value={draft.grade}
              onChange={(e) => set("grade", Number(e.target.value))}
              className="h-1 flex-1 cursor-pointer appearance-none rounded-none bg-ink/20 accent-madder"
            />
            <span className="spec-sm text-turmeric">WARM</span>
            <span className="spec-sm w-9 text-right text-ink-3">
              {draft.grade > 0 ? `+${draft.grade}` : draft.grade}
            </span>
          </div>
        </Row>

        <Row label="Tailor's guides" note="Shoulder, waist and hem rules on the plate.">
          <label className="flex cursor-pointer items-center gap-2.5">
            <input
              type="checkbox"
              name="guides"
              checked={draft.guides}
              onChange={(e) => set("guides", e.target.checked)}
              className="h-4 w-4 accent-madder"
            />
            <span className="spec">{draft.guides ? "Shown" : "Hidden"}</span>
          </label>
        </Row>

        <Row label="Plate label" note="Printed under the avatar wherever it appears.">
          <input
            name="label"
            value={draft.label}
            onChange={(e) => set("label", e.target.value)}
            className="field"
            maxLength={40}
          />
        </Row>

        <div className="mt-7 flex flex-wrap gap-2.5">
          <Save dirty={dirty} />
          {dirty && (
            <button
              type="button"
              onClick={() => setDraft(avatar.customization)}
              className="btn btn-ghost"
            >
              <span className="spec">Revert</span>
              <span aria-hidden className="spec">↺</span>
            </button>
          )}
        </div>
      </form>
    </div>
  );
}

function Save({ dirty }: { dirty: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn" disabled={pending || !dirty}>
      <span className="spec">{pending ? "Setting" : "Set the plate"}</span>
      <span aria-hidden className="spec">{pending ? "···" : "→"}</span>
    </button>
  );
}

function Row({
  label,
  note,
  children,
}: {
  label: string;
  note: string;
  children: React.ReactNode;
}) {
  return (
    <div className="border-b border-ink/15 py-4 first:border-t-2 first:border-t-ink">
      <div className="mb-3">
        <p className="spec-sm text-ink">{label}</p>
        <p className="mt-1.5 max-w-[40ch] text-[0.78rem] leading-relaxed text-ink-3">
          {note}
        </p>
      </div>
      {children}
    </div>
  );
}
