"use client";

import { useTransition } from "react";
import { SEASONS } from "@/lib/palette";

export function SeasonPickerForm({
  currentSeason,
  action,
}: {
  currentSeason?: string;
  action: (formData: FormData) => void;
}) {
  const [isPending, startTransition] = useTransition();

  const handleAction = (formData: FormData) => {
    startTransition(() => {
      action(formData);
    });
  };

  return (
    <form action={handleAction} className="space-y-3">
      <p className="font-mono text-[0.68rem] font-black uppercase text-[#12100d]/60">
        OVERRIDE PALETTE SEASON
      </p>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {Object.values(SEASONS).map((s) => (
          <label
            key={s.name}
            className="flex items-center gap-2 rounded-xl border-2 border-[#12100d] bg-[#FAF6EF] p-2 font-mono text-[0.68rem] font-bold uppercase text-[#12100d] shadow-[1px_1px_0px_#12100d] hover:bg-[#FFDE59] cursor-pointer"
          >
            <input
              type="radio"
              name="season"
              value={s.name}
              defaultChecked={s.name === currentSeason}
              onChange={(e) => e.currentTarget.form?.requestSubmit()}
              className="accent-[#12100d]"
            />
            <span className="truncate">{s.name}</span>
          </label>
        ))}
      </div>
    </form>
  );
}
