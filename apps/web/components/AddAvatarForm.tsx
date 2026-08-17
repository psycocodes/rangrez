"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useRef, useTransition } from "react";

import { cutout } from "@/lib/cutout";
import type { Avatar, AvatarFraming, Measurements, User } from "@/lib/types";
import { Navbar } from "./Navbar";

export function AddAvatarForm({
  user,
  replacing,
  token,
  apiBase,
}: {
  user: User;
  replacing?: Avatar;
  token?: string;
  apiBase?: string;
}) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [photo, setPhoto] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(
    replacing?.renderUrl ?? null,
  );
  const [label, setLabel] = useState<string>(
    replacing?.customization.label ?? `Plate 0${user.avatars.length + 1}`,
  );
  const [framing, setFraming] = useState<AvatarFraming>(
    replacing?.framing ?? "full",
  );
  const [useGlobal, setUseGlobal] = useState(
    replacing?.useGlobalMeasurements ?? true,
  );
  const [heightCm, setHeightCm] = useState(
    replacing?.measurements?.heightCm ?? user.measurements.heightCm ?? 175,
  );
  const [chestCm, setChestCm] = useState(
    replacing?.measurements?.chestCm ?? user.measurements.chestCm ?? 96,
  );
  const [waistCm, setWaistCm] = useState(
    replacing?.measurements?.waistCm ?? user.measurements.waistCm ?? 82,
  );
  const [hipCm, setHipCm] = useState(
    replacing?.measurements?.hipCm ?? user.measurements.hipCm ?? 98,
  );

  const [removingBg, setRemovingBg] = useState(false);
  const [isBgRemoved, setIsBgRemoved] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhoto(file);
    setPreviewUrl(URL.createObjectURL(file));
    setIsBgRemoved(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    setPhoto(file);
    setPreviewUrl(URL.createObjectURL(file));
    setIsBgRemoved(false);
  };

  const handleRemoveBackground = async () => {
    if (!photo && !previewUrl) return;
    setRemovingBg(true);
    setError(null);
    try {
      let sourceFile = photo;
      if (!sourceFile && previewUrl) {
        const res = await fetch(previewUrl);
        const blob = await res.blob();
        sourceFile = new File([blob], "avatar.jpg", { type: "image/jpeg" });
      }
      if (!sourceFile) throw new Error("No photo found to process.");

      const res = await cutout(sourceFile, { square: false, pad: 0.04 });
      setPreviewUrl(res.previewUrl);
      const newFile = new File([res.blob], "avatar-cutout.png", { type: "image/png" });
      setPhoto(newFile);
      setIsBgRemoved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Background remover could not extract subject.");
    } finally {
      setRemovingBg(false);
    }
  };

  const handleClearPhoto = () => {
    setPhoto(null);
    setPreviewUrl(null);
    setIsBgRemoved(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!photo && !replacing) {
      setError("Please choose or drop a body photograph first.");
      return;
    }

    setLoading(true);
    setError(null);

    const formData = new FormData();
    if (photo) formData.set("photo", photo);
    if (replacing) formData.set("replace", replacing.id);
    formData.set("label", label);
    formData.set("framing", framing);
    formData.set("useGlobalMeasurements", String(useGlobal));

    if (!useGlobal) {
      formData.set("heightCm", String(heightCm));
      formData.set("chestCm", String(chestCm));
      formData.set("waistCm", String(waistCm));
      formData.set("hipCm", String(hipCm));
    }

    try {
      const res = await fetch("/api/avatar", {
        method: "POST",
        body: formData,
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error ?? "Failed to create avatar plate.");
      }

      startTransition(() => {
        router.push("/avatar");
        router.refresh();
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed.");
      setLoading(false);
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-col justify-between overflow-hidden bg-[#F4EFE6] text-[#12100d]">
      {/* ── Unified Floating Navbar ── */}
      <Navbar
        user={user}
        token={token}
        apiBase={apiBase}
        leftElement={
          <Link
            href="/avatar"
            className="flex items-center gap-2 rounded-xl border-2 border-[#12100d] bg-[#12100d] px-3.5 py-1 font-friday text-xs uppercase tracking-wider text-white shadow-[2px_2px_0px_#FFDE59] hover:bg-[#FFDE59] hover:text-[#12100d] active:translate-x-[1px] active:translate-y-[1px] transition-all cursor-pointer"
          >
            <span>← Back to Avatars</span>
          </Link>
        }
      />

      {/* ── Main Container (Fits cleanly on screen) ── */}
      <main className="flex-1 overflow-y-auto px-4 sm:px-6 py-2 min-h-0 flex items-center justify-center">
        <form onSubmit={handleSubmit} className="w-full max-w-5xl mx-auto my-auto space-y-4">
          {/* Bento Grid: 3 Components */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-5 items-stretch">
            {/* ── Component 1 & 2 Left Side (5 cols) ── */}
            <div className="lg:col-span-5 flex flex-col justify-between space-y-3">
              {/* Tile 1: Photo Upload & Background Remover */}
              <div className="rounded-3xl border-[3px] border-[#12100d] bg-white p-4 sm:p-5 shadow-[6px_6px_0px_#12100d] flex flex-col items-center text-center">
                <div
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={handleDrop}
                  onClick={() => {
                    if (!previewUrl) fileInputRef.current?.click();
                  }}
                  className="relative flex aspect-[3/4] w-40 sm:w-48 flex-col items-center justify-center overflow-hidden rounded-2xl border-[3px] border-dashed border-[#12100d] bg-[#F4EFE6] shadow-[3px_3px_0px_#12100d] hover:bg-[#EBE3D5] transition-all cursor-pointer group"
                >
                  {previewUrl ? (
                    <Image
                      src={previewUrl}
                      alt="Avatar Preview"
                      fill
                      className="object-contain p-2"
                    />
                  ) : (
                    <div className="flex flex-col items-center p-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-[#12100d] bg-[#FFDE59] text-lg font-black shadow-[2px_2px_0px_#12100d] group-hover:scale-110 transition-transform">
                        ↑
                      </div>
                      <span className="font-friday text-xs uppercase text-[#12100d] mt-2">
                        Upload Photo
                      </span>
                      <span className="font-mono text-[0.6rem] text-[#12100d]/50 mt-0.5 uppercase">
                        Click or drop
                      </span>
                    </div>
                  )}
                </div>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={handleFileChange}
                  className="hidden"
                />

                {/* Control Action Buttons */}
                <div className="mt-3 flex flex-wrap items-center justify-center gap-1.5 w-full">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="flex-1 rounded-xl border-2 border-[#12100d] bg-[#FAF6EF] px-2.5 py-1 font-mono text-[0.65rem] font-bold uppercase text-[#12100d] shadow-[2px_2px_0px_#12100d] hover:bg-[#FFDE59] transition-all cursor-pointer"
                  >
                    {previewUrl ? "Change Photo" : "Browse Device"}
                  </button>

                  {previewUrl && (
                    <>
                      <button
                        type="button"
                        onClick={handleRemoveBackground}
                        disabled={removingBg || isBgRemoved}
                        className={`flex-1 rounded-xl border-2 border-[#12100d] px-2.5 py-1 font-mono text-[0.65rem] font-bold uppercase shadow-[2px_2px_0px_#12100d] transition-all cursor-pointer ${
                          isBgRemoved
                            ? "bg-[#7FE06E] text-[#12100d]"
                            : "bg-[#FFDE59] text-[#12100d] hover:bg-[#FFE57F]"
                        }`}
                      >
                        {removingBg ? "Matting..." : isBgRemoved ? "Cutout Done ✓" : "Remove BG ✨"}
                      </button>

                      <button
                        type="button"
                        onClick={handleClearPhoto}
                        className="rounded-xl border-2 border-[#12100d] bg-[#FF5A5F] px-2 py-1 font-mono text-[0.65rem] font-bold uppercase text-white shadow-[2px_2px_0px_#12100d] hover:bg-[#FF3B42] cursor-pointer"
                        title="Re-Submit / Clear"
                      >
                        Re-Submit ↺
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* Tile 2: Rules & Photo Checklist (Directly below upload tile) */}
              <div className="rounded-3xl border-[3px] border-[#12100d] bg-white p-3.5 sm:p-4 shadow-[4px_4px_0px_#12100d] space-y-1.5">
                <p className="font-mono text-[0.68rem] font-black uppercase text-[#12100d]">
                  Photo Rules & Checklist:
                </p>
                <ul className="space-y-1 font-mono text-[0.65rem] text-[#12100d]/80">
                  <li className="flex items-center gap-1.5">
                    <span className="text-emerald-600 font-bold">✓</span> 1. Adequate, even indoor or daylight lighting
                  </li>
                  <li className="flex items-center gap-1.5">
                    <span className="text-emerald-600 font-bold">✓</span> 2. Plain background (or use our cutout tool)
                  </li>
                  <li className="flex items-center gap-1.5">
                    <span className="text-emerald-600 font-bold">✓</span> 3. Form-fitting clothes for accurate body contouring
                  </li>
                </ul>
                <p className="border-t border-[#12100d]/15 pt-1.5 font-mono text-[0.6rem] font-bold text-[#FF5A5F] uppercase">
                  * Note: Strongly advised to submit a cutout or clean background for best try-on quality.
                </p>
              </div>
            </div>

            {/* ── Component 3 Right Side (7 cols): Calibration & Measurements ── */}
            <div className="lg:col-span-7 flex flex-col justify-between">
              <div className="rounded-3xl border-[3px] border-[#12100d] bg-white p-5 sm:p-6 shadow-[6px_6px_0px_#12100d] space-y-4">
                <div className="border-b-2 border-[#12100d]/15 pb-2.5">
                  <h3 className="font-friday text-xl sm:text-2xl uppercase tracking-wide text-[#12100d]">
                    Body Calibration Specs
                  </h3>
                  <p className="font-mono text-xs text-[#12100d]/60 mt-0.5">
                    Configure plate label, framing and measurements profile.
                  </p>
                </div>

                {/* Avatar Label Input */}
                <div>
                  <label className="font-mono text-[0.68rem] font-black uppercase text-[#12100d] block mb-1">
                    Avatar Label / Plate Name
                  </label>
                  <input
                    value={label}
                    onChange={(e) => setLabel(e.target.value)}
                    placeholder="e.g. Full Length Studio"
                    required
                    maxLength={40}
                    className="w-full rounded-xl border-2 border-[#12100d] bg-[#FAF6EF] px-3 py-1.5 font-mono text-xs font-bold uppercase text-[#12100d] outline-none shadow-[2px_2px_0px_#12100d]"
                  />
                </div>

                {/* Framing Selector */}
                <div>
                  <label className="font-mono text-[0.68rem] font-black uppercase text-[#12100d] block mb-1">
                    Body Framing
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { key: "full", label: "Full Length", desc: "Tops, Bottoms & Shoes" },
                      { key: "knee", label: "Waist / Knee Up", desc: "Tops & Bottoms" },
                      { key: "bust", label: "Head & Bust", desc: "Tops Only" },
                    ].map((f) => (
                      <button
                        key={f.key}
                        type="button"
                        onClick={() => setFraming(f.key as AvatarFraming)}
                        className={`flex flex-col p-2 rounded-xl border-2 border-[#12100d] text-left transition-all shadow-[2px_2px_0px_#12100d] cursor-pointer ${
                          framing === f.key
                            ? "bg-[#FFDE59] text-[#12100d]"
                            : "bg-[#FAF6EF] text-[#12100d]/70 hover:bg-white"
                        }`}
                      >
                        <span className="font-friday text-xs uppercase">{f.label}</span>
                        <span className="font-mono text-[0.58rem] opacity-70 mt-0.5">
                          {f.desc}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Body Measurements Profile */}
                <div className="border-t-2 border-[#12100d]/15 pt-3 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-[0.68rem] font-black uppercase text-[#12100d]">
                      Body Measurements Profile
                    </span>
                    <span className="border border-[#12100d] bg-[#FFDE59] px-2 py-0.2 font-mono text-[0.6rem] font-bold">
                      {useGlobal ? "USING GLOBAL SPEC" : "CUSTOM PLATE SPEC"}
                    </span>
                  </div>

                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setUseGlobal(true)}
                      className={`flex-1 border-2 border-[#12100d] py-1.5 px-2 rounded-xl font-mono text-[0.68rem] font-bold uppercase shadow-[2px_2px_0px_#12100d] transition-all cursor-pointer ${
                        useGlobal
                          ? "bg-[#12100d] text-white"
                          : "bg-[#FAF6EF] text-[#12100d] hover:bg-white"
                      }`}
                    >
                      Use Global Specs
                    </button>

                    <button
                      type="button"
                      onClick={() => setUseGlobal(false)}
                      className={`flex-1 border-2 border-[#12100d] py-1.5 px-2 rounded-xl font-mono text-[0.68rem] font-bold uppercase shadow-[2px_2px_0px_#12100d] transition-all cursor-pointer ${
                        !useGlobal
                          ? "bg-[#12100d] text-white"
                          : "bg-[#FAF6EF] text-[#12100d] hover:bg-white"
                      }`}
                    >
                      Set Custom Specs
                    </button>
                  </div>

                  {!useGlobal && (
                    <div className="grid grid-cols-4 gap-2 pt-1">
                      <div>
                        <label className="font-mono text-[0.6rem] font-black uppercase text-[#12100d]/60 block mb-0.5">
                          Height (cm)
                        </label>
                        <input
                          type="number"
                          value={heightCm}
                          onChange={(e) => setHeightCm(Number(e.target.value))}
                          className="w-full rounded-lg border-2 border-[#12100d] bg-[#FAF6EF] p-1.5 font-mono text-xs font-bold"
                        />
                      </div>
                      <div>
                        <label className="font-mono text-[0.6rem] font-black uppercase text-[#12100d]/60 block mb-0.5">
                          Chest (cm)
                        </label>
                        <input
                          type="number"
                          value={chestCm}
                          onChange={(e) => setChestCm(Number(e.target.value))}
                          className="w-full rounded-lg border-2 border-[#12100d] bg-[#FAF6EF] p-1.5 font-mono text-xs font-bold"
                        />
                      </div>
                      <div>
                        <label className="font-mono text-[0.6rem] font-black uppercase text-[#12100d]/60 block mb-0.5">
                          Waist (cm)
                        </label>
                        <input
                          type="number"
                          value={waistCm}
                          onChange={(e) => setWaistCm(Number(e.target.value))}
                          className="w-full rounded-lg border-2 border-[#12100d] bg-[#FAF6EF] p-1.5 font-mono text-xs font-bold"
                        />
                      </div>
                      <div>
                        <label className="font-mono text-[0.6rem] font-black uppercase text-[#12100d]/60 block mb-0.5">
                          Hips (cm)
                        </label>
                        <input
                          type="number"
                          value={hipCm}
                          onChange={(e) => setHipCm(Number(e.target.value))}
                          className="w-full rounded-lg border-2 border-[#12100d] bg-[#FAF6EF] p-1.5 font-mono text-xs font-bold"
                        />
                      </div>
                    </div>
                  )}
                </div>

                {error && (
                  <p className="border-2 border-[#12100d] bg-[#FF5A5F] px-3 py-2 rounded-xl font-mono text-xs font-black text-white shadow-[2px_2px_0px_#12100d]">
                    {error}
                  </p>
                )}

                {/* Submit Action CTA */}
                <button
                  type="submit"
                  disabled={loading || isPending || (!photo && !replacing)}
                  className="w-full border-[3px] border-[#12100d] bg-[#FFDE59] py-3 rounded-2xl font-friday text-sm uppercase tracking-wider text-[#12100d] shadow-[4px_4px_0px_#12100d] hover:bg-[#FFE57F] hover:shadow-[6px_6px_0px_#12100d] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all cursor-pointer disabled:opacity-50"
                >
                  {loading ? "DIGITISING BODY & CALIBRATING..." : "ADD AVATAR BODY →"}
                </button>
              </div>
            </div>
          </div>
        </form>
      </main>
    </div>
  );
}
