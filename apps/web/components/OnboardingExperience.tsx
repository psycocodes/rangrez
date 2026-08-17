"use client";

import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Upload,
  Loader2,
  X,
} from "lucide-react";

import { cutout } from "@/lib/cutout";
import type { MeasureUnit } from "@/lib/fit";
import type { AvatarFraming, User } from "@/lib/types";

interface BaseModelOption {
  id: string;
  label: string;
  note: string;
  framing: AvatarFraming;
  heightCm: number;
  vtoGender: "male" | "female";
  plateUrl: string;
}

const STOCK_BASE_MODELS: BaseModelOption[] = [
  {
    id: "avatar-01",
    label: "Avatar 01",
    note: "Studio portrait, crewneck, balanced proportions",
    framing: "full",
    heightCm: 178,
    vtoGender: "male",
    plateUrl: "/assets/avatar-01.jpg",
  },
  {
    id: "atlas",
    label: "Atlas",
    note: "Tall, square shoulders, full length",
    framing: "full",
    heightCm: 186,
    vtoGender: "male",
    plateUrl: "/base-models/atlas.jpg",
  },
  {
    id: "meera",
    label: "Meera",
    note: "Full length, narrow shoulder, soft hip",
    framing: "full",
    heightCm: 168,
    vtoGender: "female",
    plateUrl: "/base-models/meera.jpg",
  },
  {
    id: "kabir",
    label: "Kabir",
    note: "Average build, knee up",
    framing: "knee",
    heightCm: 174,
    vtoGender: "male",
    plateUrl: "/base-models/kabir.jpg",
  },
  {
    id: "noor",
    label: "Noor",
    note: "Average build, full length",
    framing: "full",
    heightCm: 163,
    vtoGender: "female",
    plateUrl: "/base-models/noor.jpg",
  },
  {
    id: "dev",
    label: "Dev",
    note: "Broad through chest, athletic",
    framing: "full",
    heightCm: 178,
    vtoGender: "male",
    plateUrl: "/base-models/dev.jpg",
  },
];

type OnboardingStep = 1 | 2;

export function OnboardingExperience({
  user,
}: {
  user: User | null;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [step, setStep] = useState<OnboardingStep>(
    searchParams.get("step") === "2" ? 2 : 1,
  );

  // Step 1 State
  const [avatarName, setAvatarName] = useState("");
  const [selectedPhoto, setSelectedPhoto] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>("/assets/avatar-01.jpg");
  const [selectedBaseModel, setSelectedBaseModel] = useState<BaseModelOption | null>(
    STOCK_BASE_MODELS[0],
  );
  const [modelPickerOpen, setModelPickerOpen] = useState(false);
  const [removingBg, setRemovingBg] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Step 2 State
  const [unit, setUnit] = useState<MeasureUnit>("cm");
  const [chest, setChest] = useState("96");
  const [waist, setWaist] = useState("82");
  const [hips, setHips] = useState("98");
  const [inseam, setInseam] = useState("78");
  const [height, setHeight] = useState("175");

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSelectedPhoto(file);
    setSelectedBaseModel(null);
    setPreviewUrl(URL.createObjectURL(file));
  };

  const handleSelectBaseModel = (model: BaseModelOption) => {
    setSelectedBaseModel(model);
    setSelectedPhoto(null);
    setPreviewUrl(model.plateUrl);
    if (!avatarName) setAvatarName(model.label);
    setModelPickerOpen(false);
  };

  const handleRemoveBackground = async () => {
    if (!selectedPhoto && !previewUrl) return;
    setRemovingBg(true);
    try {
      let sourceFile = selectedPhoto;
      if (!sourceFile && previewUrl) {
        const res = await fetch(previewUrl);
        const blob = await res.blob();
        sourceFile = new File([blob], "avatar.jpg", { type: "image/jpeg" });
      }
      if (!sourceFile) return;
      const res = await cutout(sourceFile, { square: false, pad: 0.04 });
      setPreviewUrl(res.previewUrl);
      const newFile = new File([res.blob], "avatar-cutout.png", { type: "image/png" });
      setSelectedPhoto(newFile);
    } catch (err) {
      console.warn("Cutout error:", err);
    } finally {
      setRemovingBg(false);
    }
  };

  const handleFinishOnboarding = async (skipMeasurements = false) => {
    setSubmitting(true);
    setError(null);

    const formData = new FormData();
    if (selectedPhoto) {
      formData.set("photo", selectedPhoto);
    } else if (selectedBaseModel) {
      formData.set("baseModel", selectedBaseModel.id);
    }
    formData.set("avatarName", avatarName || selectedBaseModel?.label || "Primary Fit Model");
    formData.set("framing", selectedBaseModel?.framing || "full");
    formData.set("unit", unit);

    if (skipMeasurements) {
      formData.set("heightCm", "175");
      formData.set("chestCm", "96");
      formData.set("waistCm", "82");
      formData.set("hipCm", "98");
      formData.set("inseamCm", "78");
    } else {
      const h = Number(height) || 175;
      const c = Number(chest) || 96;
      const w = Number(waist) || 82;
      const hp = Number(hips) || 98;
      const ins = Number(inseam) || 78;

      formData.set("heightCm", String(unit === "in" ? Math.round(h * 2.54) : h));
      formData.set("chestCm", String(unit === "in" ? Math.round(c * 2.54) : c));
      formData.set("waistCm", String(unit === "in" ? Math.round(w * 2.54) : w));
      formData.set("hipCm", String(unit === "in" ? Math.round(hp * 2.54) : hp));
      formData.set("inseamCm", String(unit === "in" ? Math.round(ins * 2.54) : ins));
    }

    try {
      const res = await fetch("/api/onboarding", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save initial avatar.");

      router.push("/trialroom");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Onboarding failed.");
      setSubmitting(false);
    }
  };

  return (
    <div className="relative h-screen w-full flex items-center justify-center bg-[#F4EFE6] text-[#14120E] selection:bg-[#FFDE59] overflow-hidden p-3 sm:p-5">
      {/* Background Texture */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 opacity-[0.4]"
        style={{
          backgroundImage: "url('/assets/backgrounds/wardrobe-background.png')",
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      />

      {/* Main Card Container */}
      <motion.div
        key={`onboarding-step-${step}`}
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -12 }}
        transition={{ duration: 0.2 }}
        className="relative z-10 flex flex-col w-full max-w-3xl rounded-3xl border-[3.5px] border-[#14120E] bg-white p-6 sm:p-8 shadow-[8px_8px_0px_#14120E] max-h-[92vh] overflow-hidden"
      >
        {/* TWO STEPS ON TOP (Screenshot 2) */}
        <div className="flex items-center justify-between pb-3 mb-4 border-b-2 border-[#14120E]/15">
          <div className="flex items-center gap-3">
            {/* Step 1 Tab */}
            <div
              className={`flex items-center gap-1.5 rounded-xl border-2 border-[#14120E] px-3 py-1 text-xs font-bold transition-all ${
                step === 1
                  ? "bg-[#FFDE59] text-[#14120E] shadow-[2px_2px_0px_#14120E]"
                  : "bg-[#FAF8F5] text-[#14120E]/50"
              }`}
              style={{ fontFamily: "var(--font-clash), sans-serif" }}
            >
              <span>upload avatar</span>
            </div>

            <span className="font-mono text-xs font-bold text-[#14120E]/40">/</span>

            {/* Step 2 Tab */}
            <div
              className={`flex items-center gap-1.5 rounded-xl border-2 border-[#14120E] px-3 py-1 text-xs font-bold transition-all ${
                step === 2
                  ? "bg-[#FFDE59] text-[#14120E] shadow-[2px_2px_0px_#14120E]"
                  : "bg-[#FAF8F5] text-[#14120E]/50"
              }`}
              style={{ fontFamily: "var(--font-clash), sans-serif" }}
            >
              <span>Enter proportions</span>
            </div>
          </div>

          <span
            className="text-xs font-bold uppercase tracking-wider text-[#14120E]/70"
            style={{ fontFamily: "var(--font-clash), sans-serif" }}
          >
            Step {step} of 2
          </span>
        </div>

        {error && (
          <div className="mb-3 rounded-xl border-2 border-[#14120E] bg-[#FF5A5F] p-2.5 text-xs font-bold text-white shadow-[2px_2px_0px_#14120E]">
            {error}
          </div>
        )}

        {/* ─────────────────────────────────────────────────────────────────
         *  STEP 1: UPLOAD AVATAR (Screenshot 2 Left)
         * ───────────────────────────────────────────────────────────────── */}
        {step === 1 ? (
          <div className="flex-1 flex flex-col justify-between overflow-y-auto pr-1">
            <div>
              {/* Title */}
              <h1 className="text-4xl sm:text-5xl font-normal tracking-tight text-[#14120E]">
                <span style={{ fontFamily: "var(--font-clash), sans-serif", fontWeight: 700 }}>
                  Upload{" "}
                </span>
                <span
                  className="italic text-[#CA761E]"
                  style={{ fontFamily: "var(--font-instrument), serif" }}
                >
                  avatar
                </span>
              </h1>

              {/* Grid */}
              <div className="mt-4 grid grid-cols-1 sm:grid-cols-[1fr_1.1fr] gap-6 items-center">
                {/* Left: Avatar Disc Upload */}
                <div className="flex flex-col items-center justify-center">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handlePhotoUpload}
                    className="hidden"
                  />

                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="group relative flex h-48 w-48 sm:h-52 sm:w-52 flex-col items-center justify-center rounded-full border-[3px] border-[#14120E] bg-[#D4D4D4] shadow-[4px_4px_0px_#14120E] hover:scale-102 hover:bg-[#C8C8C8] transition-all cursor-pointer overflow-hidden"
                  >
                    {previewUrl ? (
                      <>
                        <Image
                          src={previewUrl}
                          alt="Avatar"
                          fill
                          className="object-cover"
                        />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center text-white p-2 text-center">
                          <Upload className="h-7 w-7 mb-1" />
                          <span className="text-[11px] font-black uppercase">Change Photo</span>
                        </div>
                      </>
                    ) : (
                      <div className="flex flex-col items-center justify-center text-[#14120E]">
                        <Upload className="h-10 w-10 mb-1 stroke-[2.5]" />
                        <span
                          className="text-xs font-black uppercase tracking-wider"
                          style={{ fontFamily: "var(--font-clash), sans-serif" }}
                        >
                          Upload Avatar
                        </span>
                      </div>
                    )}
                  </div>

                  {previewUrl && (
                    <button
                      type="button"
                      onClick={handleRemoveBackground}
                      disabled={removingBg}
                      className="mt-2 text-[11px] font-bold underline text-[#14120E] hover:text-[#CA761E] cursor-pointer"
                    >
                      {removingBg ? "Removing Background..." : "⚡ Remove Background"}
                    </button>
                  )}
                </div>

                {/* Right: Name Input, Checklist, Rules */}
                <div className="space-y-3.5">
                  <div>
                    <label
                      className="block text-[11px] font-bold uppercase text-[#14120E]"
                      style={{ fontFamily: "var(--font-clash), sans-serif" }}
                    >
                      Name
                    </label>
                    <input
                      type="text"
                      value={avatarName}
                      onChange={(e) => setAvatarName(e.target.value)}
                      placeholder="Value"
                      className="mt-1 w-full rounded-xl border-2 border-[#14120E] bg-[#FAF8F5] px-3 py-2 text-xs font-medium text-[#14120E] focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-[#FFDE59]"
                    />
                  </div>

                  {/* Checklist */}
                  <div className="space-y-1 pt-1">
                    <div className="flex items-center gap-2 text-xs font-bold text-[#14120E]">
                      <span className="h-4 w-4 rounded bg-[#14120E] text-white flex items-center justify-center text-[10px]">
                        ✓
                      </span>
                      <span>Shirts</span>
                      <span className="text-[#1E3A8A]">✓</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs font-bold text-[#14120E]">
                      <span className="h-4 w-4 rounded bg-[#14120E] text-white flex items-center justify-center text-[10px]">
                        ✓
                      </span>
                      <span>Pants</span>
                      <span className="text-[#1E3A8A]">✓</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs font-bold text-[#14120E]">
                      <span className="h-4 w-4 rounded bg-[#14120E] text-white flex items-center justify-center text-[10px]">
                        ✓
                      </span>
                      <span>Shoes</span>
                      <span className="text-[#1E3A8A]">✓</span>
                    </div>
                  </div>

                  {/* Rules */}
                  <div className="pt-2">
                    <p
                      className="text-xs font-black uppercase text-[#14120E]"
                      style={{ fontFamily: "var(--font-clash), sans-serif" }}
                    >
                      Rules:
                    </p>
                    <ol className="mt-0.5 text-xs text-[#14120E]/80 font-medium space-y-0.5">
                      <li>1. Adequate Lighting</li>
                      <li>2. Body should be visible</li>
                    </ol>
                  </div>
                </div>
              </div>
            </div>

            {/* Bottom Buttons */}
            <div className="mt-6 flex items-center justify-end gap-3 pt-3 border-t-2 border-[#14120E]/15">
              <button
                type="button"
                onClick={() => setModelPickerOpen(true)}
                className="rounded-2xl border-2 border-[#14120E] bg-[#14120E] px-5 py-2.5 text-xs font-bold uppercase tracking-wider text-white shadow-[2.5px_2.5px_0px_#14120E] hover:bg-[#2A2824] hover:-translate-y-0.5 active:translate-x-1 active:translate-y-1 cursor-pointer"
                style={{ fontFamily: "var(--font-clash), sans-serif" }}
              >
                Select Model →
              </button>

              <button
                type="button"
                onClick={() => setStep(2)}
                className="rounded-2xl border-2 border-[#14120E] bg-[#14120E] px-6 py-2.5 text-xs font-bold uppercase tracking-wider text-white shadow-[2.5px_2.5px_0px_#14120E] hover:bg-[#2A2824] hover:-translate-y-0.5 active:translate-x-1 active:translate-y-1 cursor-pointer"
                style={{ fontFamily: "var(--font-clash), sans-serif" }}
              >
                Proceed →
              </button>
            </div>
          </div>
        ) : (
          /* ─────────────────────────────────────────────────────────────────
           *  STEP 2: ENTER PROPORTIONS (Screenshot 2 Right)
           * ───────────────────────────────────────────────────────────────── */
          <div className="flex-1 flex flex-col justify-between overflow-y-auto pr-1">
            <div>
              {/* Title */}
              <h1 className="text-4xl sm:text-5xl font-normal tracking-tight text-[#14120E]">
                <span style={{ fontFamily: "var(--font-clash), sans-serif", fontWeight: 700 }}>
                  Enter{" "}
                </span>
                <span
                  className="italic text-[#CA761E]"
                  style={{ fontFamily: "var(--font-instrument), serif" }}
                >
                  proportions
                </span>
              </h1>

              {/* Subtitle / Badge */}
              <div className="mt-1 flex items-center justify-between">
                <span
                  className="rounded-lg border border-[#14120E] bg-[#0284C7] px-2.5 py-0.5 text-xs font-bold text-white shadow-[1.5px_1.5px_0px_#14120E]"
                  style={{ fontFamily: "var(--font-clash), sans-serif" }}
                >
                  Update your Measurements
                </span>

                {/* Unit toggle */}
                <div className="flex items-center gap-1 rounded-xl border border-[#14120E] bg-[#FAF8F5] p-0.5">
                  <button
                    type="button"
                    onClick={() => setUnit("cm")}
                    className={`px-2 py-0.5 text-[10px] font-black rounded-lg ${
                      unit === "cm" ? "bg-[#14120E] text-white" : "text-[#14120E]/60"
                    }`}
                  >
                    CM
                  </button>
                  <button
                    type="button"
                    onClick={() => setUnit("in")}
                    className={`px-2 py-0.5 text-[10px] font-black rounded-lg ${
                      unit === "in" ? "bg-[#14120E] text-white" : "text-[#14120E]/60"
                    }`}
                  >
                    IN
                  </button>
                </div>
              </div>

              {/* Grid: T-shirt diagram + Input fields */}
              <div className="mt-4 grid grid-cols-1 sm:grid-cols-[1fr_1.3fr] gap-6 items-center">
                {/* Left: Diagram */}
                <div className="relative flex flex-col items-center justify-center p-3">
                  <div className="relative h-44 w-36 overflow-hidden rounded-xl border-2 border-[#14120E] bg-white shadow-[3px_3px_0px_#14120E]">
                    <Image
                      src="/seed/Pink Shirt.png"
                      alt="T-shirt"
                      fill
                      className="object-contain p-2"
                    />
                  </div>

                  <div className="mt-2 rounded-lg border border-[#14120E] bg-[#0284C7] px-3 py-1 text-xs font-bold text-white shadow-[2px_2px_0px_#14120E]">
                    409 × 96
                  </div>
                </div>

                {/* Right: Input fields */}
                <div className="space-y-2">
                  <div>
                    <label
                      className="block text-[11px] font-bold uppercase text-[#14120E]/80"
                      style={{ fontFamily: "var(--font-clash), sans-serif" }}
                    >
                      Chest
                    </label>
                    <input
                      type="text"
                      value={chest}
                      onChange={(e) => setChest(e.target.value)}
                      placeholder="Value"
                      className="w-full rounded-xl border-2 border-[#14120E] bg-[#FAF8F5] px-3 py-1.5 text-xs font-medium text-[#14120E] focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-[#FFDE59]"
                    />
                  </div>

                  <div>
                    <label
                      className="block text-[11px] font-bold uppercase text-[#14120E]/80"
                      style={{ fontFamily: "var(--font-clash), sans-serif" }}
                    >
                      Waist
                    </label>
                    <input
                      type="text"
                      value={waist}
                      onChange={(e) => setWaist(e.target.value)}
                      placeholder="Value"
                      className="w-full rounded-xl border-2 border-[#14120E] bg-[#FAF8F5] px-3 py-1.5 text-xs font-medium text-[#14120E] focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-[#FFDE59]"
                    />
                  </div>

                  <div>
                    <label
                      className="block text-[11px] font-bold uppercase text-[#14120E]/80"
                      style={{ fontFamily: "var(--font-clash), sans-serif" }}
                    >
                      Hips
                    </label>
                    <input
                      type="text"
                      value={hips}
                      onChange={(e) => setHips(e.target.value)}
                      placeholder="Value"
                      className="w-full rounded-xl border-2 border-[#14120E] bg-[#FAF8F5] px-3 py-1.5 text-xs font-medium text-[#14120E] focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-[#FFDE59]"
                    />
                  </div>

                  <div>
                    <label
                      className="block text-[11px] font-bold uppercase text-[#14120E]/80"
                      style={{ fontFamily: "var(--font-clash), sans-serif" }}
                    >
                      Inseam
                    </label>
                    <input
                      type="text"
                      value={inseam}
                      onChange={(e) => setInseam(e.target.value)}
                      placeholder="Value"
                      className="w-full rounded-xl border-2 border-[#14120E] bg-[#FAF8F5] px-3 py-1.5 text-xs font-medium text-[#14120E] focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-[#FFDE59]"
                    />
                  </div>

                  <div>
                    <label
                      className="block text-[11px] font-bold uppercase text-[#14120E]/80"
                      style={{ fontFamily: "var(--font-clash), sans-serif" }}
                    >
                      Height
                    </label>
                    <input
                      type="text"
                      value={height}
                      onChange={(e) => setHeight(e.target.value)}
                      placeholder="Value"
                      className="w-full rounded-xl border-2 border-[#14120E] bg-[#FAF8F5] px-3 py-1.5 text-xs font-medium text-[#14120E] focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-[#FFDE59]"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Bottom Buttons */}
            <div className="mt-6 flex items-center justify-end gap-3 pt-3 border-t-2 border-[#14120E]/15">
              <button
                type="button"
                disabled={submitting}
                onClick={() => handleFinishOnboarding(true)}
                className="rounded-2xl border-2 border-[#14120E] bg-[#14120E] px-5 py-2.5 text-xs font-bold uppercase tracking-wider text-white shadow-[2.5px_2.5px_0px_#14120E] hover:bg-[#2A2824] hover:-translate-y-0.5 active:translate-x-1 active:translate-y-1 cursor-pointer disabled:opacity-50"
                style={{ fontFamily: "var(--font-clash), sans-serif" }}
              >
                Skip →
              </button>

              <button
                type="button"
                disabled={submitting}
                onClick={() => handleFinishOnboarding(false)}
                className="rounded-2xl border-2 border-[#14120E] bg-[#14120E] px-6 py-2.5 text-xs font-bold uppercase tracking-wider text-white shadow-[2.5px_2.5px_0px_#14120E] hover:bg-[#2A2824] hover:-translate-y-0.5 active:translate-x-1 active:translate-y-1 cursor-pointer disabled:opacity-50"
                style={{ fontFamily: "var(--font-clash), sans-serif" }}
              >
                {submitting ? (
                  <span className="flex items-center gap-1.5">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Saving...
                  </span>
                ) : (
                  "Proceed →"
                )}
              </button>
            </div>
          </div>
        )}
      </motion.div>

      {/* Base Model Selector Modal */}
      <AnimatePresence>
        {modelPickerOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
            <motion.div
              initial={{ scale: 0.94, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.94, opacity: 0 }}
              className="relative w-full max-w-xl max-h-[85vh] flex flex-col rounded-3xl border-[3.5px] border-[#14120E] bg-white p-5 shadow-[8px_8px_0px_#14120E] overflow-hidden"
            >
              <div className="flex items-center justify-between pb-2.5 border-b-2 border-[#14120E]/15">
                <div>
                  <h3
                    className="text-xl font-black uppercase text-[#14120E]"
                    style={{ fontFamily: "var(--font-clash), sans-serif" }}
                  >
                    Select Base Model
                  </h3>
                  <p className="text-xs text-[#14120E]/70 font-medium">
                    Pick a stock avatar body to start styling instantly.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setModelPickerOpen(false)}
                  className="flex h-7 w-7 items-center justify-center rounded-xl border-2 border-[#14120E] bg-white text-[#14120E] shadow-[1.5px_1.5px_0px_#14120E] hover:bg-[#FF5A5F] hover:text-white transition-colors cursor-pointer"
                >
                  <X className="h-3.5 w-3.5 stroke-[3]" />
                </button>
              </div>

              {/* Grid */}
              <div className="mt-3.5 grid grid-cols-2 sm:grid-cols-3 gap-3 overflow-y-auto pr-1">
                {STOCK_BASE_MODELS.map((model) => (
                  <div
                    key={model.id}
                    onClick={() => handleSelectBaseModel(model)}
                    className="group relative flex flex-col rounded-2xl border-2 border-[#14120E] bg-[#FAF8F5] p-2 shadow-[2.5px_2.5px_0px_#14120E] hover:shadow-[4px_4px_0px_#14120E] hover:-translate-y-0.5 hover:bg-[#FFDE59]/20 transition-all cursor-pointer"
                  >
                    <div className="relative aspect-[3/4] w-full overflow-hidden rounded-xl border border-[#14120E] bg-white">
                      <Image
                        src={model.plateUrl}
                        alt={model.label}
                        fill
                        className="object-cover transition-transform group-hover:scale-105"
                      />
                      <span className="absolute top-1 left-1 rounded bg-[#14120E] px-1.5 py-0.5 text-[8px] font-black uppercase text-white">
                        {model.framing}
                      </span>
                    </div>

                    <div className="mt-1.5 text-left">
                      <p
                        className="text-xs font-black uppercase text-[#14120E] truncate"
                        style={{ fontFamily: "var(--font-clash), sans-serif" }}
                      >
                        {model.label}
                      </p>
                      <p className="text-[9px] text-[#14120E]/60 font-bold">
                        {model.heightCm} cm · {model.vtoGender}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
