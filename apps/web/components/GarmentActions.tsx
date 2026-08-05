"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { useFormStatus } from "react-dom";

import {
  moveGarment,
  removeGarment,
  saveGarment,
  wearGarment,
  type WardrobeState,
} from "@/app/actions/wardrobe";
import { DYES } from "@/lib/seed";
import {
  SEASON_LABEL,
  ZONE_LABEL,
  ZONES,
  type Dye,
  type Garment,
  type SeasonTag,
} from "@/lib/types";

const DYE_LIST = Object.values(DYES) as Dye[];
const SEASONS: SeasonTag[] = ["spring", "summer", "autumn", "winter", "yearround"];

/* ═══ the ⋯ menu ═════════════════════════════════════════════════════════ */

export function GarmentMenu({
  garment,
  onEdit,
}: {
  garment: Garment;
  onEdit: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [moving, setMoving] = useState(false);
  const [pending, start] = useTransition();
  const root = useRef<HTMLDivElement>(null);

  // Click-away and Escape. Registered only while open so 26 cards don't each
  // hold a document listener.
  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => {
      if (!root.current?.contains(e.target as Node)) {
        setOpen(false);
        setMoving(false);
      }
    };
    const esc = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        setMoving(false);
      }
    };
    document.addEventListener("mousedown", away);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", away);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);

  const run = (fn: () => Promise<void>) => {
    setOpen(false);
    setMoving(false);
    start(() => void fn());
  };

  return (
    <div ref={root} className="absolute right-0 top-0 z-[5]">
      <button
        type="button"
        aria-label={`Actions for ${garment.name}`}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        data-on={open}
        className="flex h-7 w-7 items-center justify-center bg-paper text-ink transition-colors duration-200 hover:bg-ink hover:text-paper data-[on=true]:bg-ink data-[on=true]:text-paper"
      >
        <span className="spec-sm leading-none tracking-normal">
          {pending ? "·" : "···"}
        </span>
      </button>

      {open && (
        <div className="absolute right-0 top-7 w-48 border border-ink bg-paper shadow-[0_18px_40px_-18px_rgba(20,18,14,0.55)]">
          {moving ? (
            <>
              <p className="spec-sm border-b border-ink/15 px-3 py-2.5 text-ink-3">
                MOVE TO
              </p>
              {ZONES.filter((z) => z !== garment.zone).map((z) => (
                <MenuItem
                  key={z}
                  onClick={() => run(() => moveGarment(garment.id, z))}
                >
                  {ZONE_LABEL[z]}
                </MenuItem>
              ))}
              <MenuItem onClick={() => setMoving(false)} muted>
                ← Back
              </MenuItem>
            </>
          ) : (
            <>
              <MenuItem
                onClick={() => {
                  setOpen(false);
                  onEdit();
                }}
              >
                Edit details
              </MenuItem>
              <MenuItem onClick={() => setMoving(true)}>Move to…</MenuItem>
              <MenuItem onClick={() => run(() => wearGarment(garment.id))}>
                Mark as worn
              </MenuItem>
              {garment.sourceUrl && (
                <MenuItem
                  onClick={() => {
                    setOpen(false);
                    window.open(garment.sourceUrl, "_blank", "noopener,noreferrer");
                  }}
                >
                  Open source page ↗
                </MenuItem>
              )}
              <MenuItem
                danger
                onClick={() => {
                  if (
                    confirm(`Remove "${garment.name}" from your wardrobe?`)
                  ) {
                    run(() => removeGarment(garment.id));
                  }
                }}
              >
                Delete
              </MenuItem>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function MenuItem({
  children,
  onClick,
  danger,
  muted,
}: {
  children: React.ReactNode;
  onClick: () => void;
  danger?: boolean;
  muted?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`spec block w-full border-b border-ink/12 px-3 py-2.5 text-left transition-colors duration-200 last:border-b-0 hover:bg-ink hover:text-paper ${
        danger ? "text-madder hover:!bg-madder" : muted ? "text-ink-3" : "text-ink"
      }`}
    >
      {children}
    </button>
  );
}

/* ═══ the editor ═════════════════════════════════════════════════════════ */

export function GarmentEditor({
  garment,
  onClose,
}: {
  garment: Garment;
  onClose: () => void;
}) {
  const [state, action] = useActionState<WardrobeState, FormData>(saveGarment, {});
  const [dye, setDye] = useState(garment.dye.name);

  useEffect(() => {
    if (state.ok) onClose();
  }, [state.ok, onClose]);

  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", esc);
    return () => document.removeEventListener("keydown", esc);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[80] flex items-end justify-center bg-ink/45 p-0 backdrop-blur-[2px] sm:items-center sm:p-6"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        role="dialog"
        aria-label={`Edit ${garment.name}`}
        className="rise max-h-[92dvh] w-full max-w-[30rem] overflow-y-auto border border-ink bg-paper"
      >
        <header className="flex items-baseline justify-between border-b border-ink px-4 py-3">
          <span className="spec text-ink-3">Edit piece</span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="spec text-ink-3 transition-colors hover:text-madder"
          >
            ✕
          </button>
        </header>

        <form action={action} className="flex flex-col gap-6 p-4">
          <input type="hidden" name="id" value={garment.id} />
          <input type="hidden" name="dye" value={dye} />

          <label className="block">
            <span className="spec-sm mb-2.5 block text-ink-3">NAME</span>
            <input name="name" defaultValue={garment.name} className="field" required />
          </label>

          <fieldset>
            <legend className="spec-sm mb-3 text-ink-3">RAIL</legend>
            <div className="flex flex-wrap gap-1.5">
              {ZONES.map((z) => (
                <label key={z} className="chip has-checked:!bg-ink has-checked:!text-paper">
                  <input
                    type="radio"
                    name="zone"
                    value={z}
                    defaultChecked={garment.zone === z}
                    className="h-3 w-3 self-center accent-madder"
                  />
                  <span className="spec">{ZONE_LABEL[z]}</span>
                </label>
              ))}
            </div>
          </fieldset>

          <fieldset>
            <legend className="spec-sm mb-3 text-ink-3">DYE</legend>
            <div className="grid grid-cols-7 gap-1.5">
              {DYE_LIST.map((d) => (
                <button
                  key={d.name}
                  type="button"
                  title={`${d.name} · ${d.hex}`}
                  onClick={() => setDye(d.name)}
                  className={`aspect-square w-full border transition-transform duration-200 ${
                    dye === d.name
                      ? "scale-110 border-ink"
                      : "border-ink/20 hover:scale-105"
                  }`}
                  style={{ backgroundColor: d.hex }}
                />
              ))}
            </div>
            <p className="spec-sm mt-2.5 text-ink-3">{dye.toUpperCase()}</p>
          </fieldset>

          <fieldset>
            <legend className="spec-sm mb-3 text-ink-3">SEASON</legend>
            <div className="flex flex-wrap gap-1.5">
              {SEASONS.map((s) => (
                <label key={s} className="chip has-checked:!bg-ink has-checked:!text-paper">
                  <input
                    type="radio"
                    name="season"
                    value={s}
                    defaultChecked={garment.season === s}
                    className="h-3 w-3 self-center accent-madder"
                  />
                  <span className="spec">
                    {s === "yearround" ? "All year" : s} · {SEASON_LABEL[s]}
                  </span>
                </label>
              ))}
            </div>
          </fieldset>

          <label className="block">
            <span className="spec-sm mb-2.5 block text-ink-3">MATERIAL NOTE</span>
            <input
              name="material"
              defaultValue={garment.material}
              placeholder="14oz selvedge, unwashed"
              className="field"
            />
          </label>

          <label className="block">
            <span className="spec-sm mb-2.5 block text-ink-3">TIMES WORN</span>
            <input
              name="wornCount"
              type="number"
              min={0}
              max={9999}
              defaultValue={garment.wornCount}
              className="field"
            />
          </label>

          {garment.sourceUrl && (
            <p className="rule pt-3 text-[0.78rem] leading-relaxed text-ink-3">
              <span className="spec-sm mr-2 text-madder">FROM A SHOP</span>
              <a
                href={garment.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="break-all text-ink underline decoration-madder underline-offset-4"
              >
                {garment.sourceUrl.replace(/^https?:\/\//, "").slice(0, 60)}
              </a>
            </p>
          )}

          {state.error && (
            <p
              role="alert"
              className="border-l-2 border-madder bg-madder/8 py-2 pl-3 text-[0.85rem] text-madder"
            >
              {state.error}
            </p>
          )}

          <div className="flex gap-2">
            <Save />
            <button type="button" onClick={onClose} className="btn btn-ghost">
              <span className="spec">Cancel</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Save() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn flex-1" disabled={pending}>
      <span className="spec">{pending ? "Saving" : "Save changes"}</span>
      <span aria-hidden className="spec">{pending ? "···" : "→"}</span>
    </button>
  );
}
