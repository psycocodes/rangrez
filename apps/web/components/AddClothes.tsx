"use client";

import { createContext, useContext, useState } from "react";

import { UploadDock } from "./UploadDock";
import type { Avatar } from "@/lib/types";

/**
 * One upload dock for the whole wardrobe page.
 *
 * Two places offer to open it — the masthead, which leads with it because it
 * is the point of the page, and the sticky filter bar, which keeps it reachable
 * once you've scrolled past the masthead. Both are separated from the dock by a
 * server component, so the shared state lives in a provider wrapped around the
 * page rather than being threaded through props that don't cross that boundary.
 */

interface Dock {
  open: () => void;
}

const DockContext = createContext<Dock | null>(null);

export function AddClothesProvider({
  avatars,
  activeAvatarId,
  children,
}: {
  avatars: Avatar[];
  activeAvatarId?: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);

  return (
    <DockContext.Provider value={{ open: () => setOpen(true) }}>
      {children}
      {open && (
        <UploadDock
          avatars={avatars}
          activeAvatarId={activeAvatarId}
          onClose={() => setOpen(false)}
        />
      )}
    </DockContext.Provider>
  );
}

/** Null outside the provider, so a consumer can render nothing rather than throw. */
export function useDock(): Dock | null {
  return useContext(DockContext);
}

/** The masthead's primary call to action. */
export function AddClothesButton() {
  const dock = useDock();
  if (!dock) return null;

  return (
    <button type="button" onClick={dock.open} className="btn">
      <span className="spec">Add clothes from your photos</span>
      <span aria-hidden className="spec">+</span>
    </button>
  );
}
