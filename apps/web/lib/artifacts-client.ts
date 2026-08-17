import type { ArtifactItem } from "./types";

const LOCAL_STORAGE_KEY = "rangrez_minted_artifacts";

export function getLocalArtifacts(): ArtifactItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch (err) {
    console.error("Failed to parse local artifacts", err);
    return [];
  }
}

export function saveLocalArtifact(artifact: ArtifactItem): void {
  if (typeof window === "undefined") return;
  try {
    const current = getLocalArtifacts();
    // Prepend if not exists, otherwise update
    const filtered = current.filter((a) => a.id !== artifact.id);
    const updated = [artifact, ...filtered];
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(updated));
    // Trigger custom event so all pages and Navbar can react immediately
    window.dispatchEvent(new CustomEvent("rangrez-artifacts-updated", { detail: updated }));
  } catch (err) {
    console.error("Failed to save local artifact", err);
  }
}

export function removeLocalArtifact(id: string): void {
  if (typeof window === "undefined") return;
  try {
    const current = getLocalArtifacts();
    const updated = current.filter((a) => a.id !== id);
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(updated));
    window.dispatchEvent(new CustomEvent("rangrez-artifacts-updated", { detail: updated }));
  } catch (err) {
    console.error("Failed to remove local artifact", err);
  }
}
