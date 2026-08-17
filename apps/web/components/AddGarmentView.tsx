"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useRef, useTransition } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Link as LinkIcon,
  UploadCloud,
  Sparkles,
  Check,
  Tag,
  Layers,
  Ruler,
  Maximize2,
} from "lucide-react";

import { extractGarment } from "@/lib/extract";
import { CUTS, type Cut } from "@/lib/fit";
import { UPLOAD_KINDS } from "@/lib/garment-kind";
import type { Avatar, User } from "@/lib/types";
import { Navbar } from "./Navbar";

type ImportMode = "link" | "upload";

export function AddGarmentView({
  user,
  token,
  apiBase,
}: {
  user: User;
  token?: string;
  apiBase?: string;
}) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [mode, setMode] = useState<ImportMode>("link");
  const [targetAvatarId, setTargetAvatarId] = useState(
    user.activeAvatarId ?? user.avatars[0]?.id,
  );

  // Link import state
  const [productUrl, setProductUrl] = useState("");
  const [fetchingLink, setFetchingLink] = useState(false);
  const [linkError, setLinkError] = useState<string | null>(null);
  const [fetchedImages, setFetchedImages] = useState<string[]>([]);
  const [selectedImageUrl, setSelectedImageUrl] = useState<string | null>(null);

  // Garment attributes state
  const [garmentName, setGarmentName] = useState("");
  const [kindId, setKindId] = useState("top");
  const [sizeLabel, setSizeLabel] = useState("M");
  const [cut, setCut] = useState<Cut>("regular");
  const [sourceUrl, setSourceUrl] = useState("");

  // Processed image state
  const [processedBlob, setProcessedBlob] = useState<Blob | null>(null);
  const [processedPreview, setProcessedPreview] = useState<string | null>(null);
  const [dominantColor, setDominantColor] = useState<string>("#6d6555");
  const [isMatted, setIsMatted] = useState(false);

  // Upload/Submit state
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isPending, startTransition] = useTransition();

  const activePlate =
    user.avatars.find((a) => a.id === targetAvatarId) ?? user.avatars[0];

  // Process raw image file or URL into white-background cutout
  const processImage = async (fileOrBlob: File | Blob, nameHint = "") => {
    try {
      const file =
        fileOrBlob instanceof File
          ? fileOrBlob
          : new File([fileOrBlob], nameHint || "product-item.jpg", {
              type: "image/jpeg",
            });
      const out = await extractGarment(file);
      setProcessedBlob(out.blob);
      setProcessedPreview(out.previewUrl);
      setDominantColor(out.dominantColor);
      setIsMatted(out.matted);
      if (out.suggestedName && !garmentName) setGarmentName(out.suggestedName);
      if (out.suggestedKindId && kindId === "top") setKindId(out.suggestedKindId);
    } catch (err) {
      console.error("Extraction error:", err);
      // Fallback: create object URL directly
      const url = URL.createObjectURL(fileOrBlob);
      setProcessedBlob(fileOrBlob);
      setProcessedPreview(url);
    }
  };

  // Fetch online shopping link
  const handleFetchLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!productUrl.trim()) return;

    setFetchingLink(true);
    setLinkError(null);
    setError(null);

    try {
      const res = await fetch("/api/wardrobe/fetch-product", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: productUrl.trim() }),
      });

      const data = await res.json();
      if (!res.ok)
        throw new Error(data.error || "Failed to fetch product information.");

      const { product } = data;
      setGarmentName(product.title || "Garment Piece");
      setKindId(product.suggestedKind || "top");
      setSourceUrl(product.sourceUrl || productUrl);
      setFetchedImages(product.images || [product.imageUrl]);
      setSelectedImageUrl(product.imageUrl);

      // Fetch proxied image for background cutout
      const proxyRes = await fetch(
        `/api/wardrobe/proxy-image?url=${encodeURIComponent(product.imageUrl)}`,
      );
      if (proxyRes.ok) {
        const blob = await proxyRes.blob();
        await processImage(blob, `${product.title || "item"}.jpg`);
      } else {
        setProcessedPreview(product.imageUrl);
      }
    } catch (err) {
      setLinkError(
        err instanceof Error ? err.message : "Failed to extract product link.",
      );
    } finally {
      setFetchingLink(false);
    }
  };

  // Switch selected image from gallery
  const handleSelectGalleryImage = async (imgUrl: string) => {
    setSelectedImageUrl(imgUrl);
    try {
      const proxyRes = await fetch(
        `/api/wardrobe/proxy-image?url=${encodeURIComponent(imgUrl)}`,
      );
      if (proxyRes.ok) {
        const blob = await proxyRes.blob();
        await processImage(blob, "gallery-item.jpg");
      } else {
        setProcessedPreview(imgUrl);
      }
    } catch {
      setProcessedPreview(imgUrl);
    }
  };

  // Handle local file selection
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSourceUrl("");
    await processImage(file, file.name);
  };

  // Handle local drop
  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    setSourceUrl("");
    await processImage(file, file.name);
  };

  // Commit and save garment to wardrobe
  const handleSaveGarment = async () => {
    if (!processedBlob && !selectedImageUrl) {
      setError("Please select or upload a garment image first.");
      return;
    }
    if (!garmentName.trim()) {
      setError("Please provide a name for this garment.");
      return;
    }

    setSaving(true);
    setError(null);

    const formData = new FormData();
    if (processedBlob) {
      formData.append("photo", processedBlob, "garment.jpg");
    } else if (selectedImageUrl) {
      formData.append("imageUrl", selectedImageUrl);
    }
    formData.append("name", garmentName.trim());
    formData.append("kind", kindId);
    formData.append("dominantColor", dominantColor);
    formData.append("sizeLabel", sizeLabel.trim());
    formData.append("cut", cut);
    if (sourceUrl) formData.append("sourceUrl", sourceUrl);
    if (targetAvatarId) formData.append("targetAvatarId", targetAvatarId);

    try {
      const res = await fetch("/api/wardrobe/upload", {
        method: "POST",
        body: formData,
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to save garment.");

      // Trigger automatic VTO render if avatar available
      if (activePlate && json.garment?.id) {
        fetch("/api/wardrobe/render", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: json.garment.id, avatarId: activePlate.id }),
        }).catch(() => {});
      }

      setSuccess(true);
      startTransition(() => {
        router.push("/wardrobe");
        router.refresh();
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save garment.");
      setSaving(false);
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-[#F4EFE6] text-[#12100d]">
      {/* ── Unified Floating Navbar ── */}
      <Navbar
        user={user}
        token={token}
        apiBase={apiBase}
        leftElement={
          <Link
            href="/wardrobe"
            className="flex items-center gap-1.5 rounded-xl border-2 border-[#12100d] bg-[#12100d] px-3.5 py-1.5 font-friday text-xs uppercase tracking-wider text-white shadow-[2px_2px_0px_#FFDE59] hover:bg-[#FFDE59] hover:text-[#12100d] active:translate-x-[1px] active:translate-y-[1px] transition-all cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Wardrobe</span>
          </Link>
        }
      />

      {/* ── Main Container (Proper breathing margins below floating navbar) ── */}
      <main className="flex-1 overflow-y-auto px-4 py-4 sm:py-6 mt-1">
        <div className="w-full max-w-5xl mx-auto space-y-5">
          {/* Avatar Target Switcher Bar */}
          {user.avatars.length > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border-[2.5px] border-[#12100d] bg-white p-3 sm:px-5 shadow-[4px_4px_0px_#12100d]">
              <div className="flex items-center gap-2">
                <span className="border-2 border-[#12100d] bg-[#FFDE59] px-2 py-0.5 font-mono text-[0.68rem] font-black uppercase text-[#12100d] shadow-[1px_1px_0px_#12100d]">
                  TARGET BODY
                </span>
                <span className="font-mono text-xs font-bold text-[#12100d]/70 hidden sm:inline">
                  Automated Try-On Plate:
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {user.avatars.map((av) => (
                  <button
                    key={av.id}
                    type="button"
                    onClick={() => setTargetAvatarId(av.id)}
                    className={`flex items-center gap-2 rounded-xl border-2 border-[#12100d] px-3 py-1 font-mono text-xs font-black uppercase transition-all shadow-[2px_2px_0px_#12100d] cursor-pointer ${
                      av.id === targetAvatarId
                        ? "bg-[#FFDE59] text-[#12100d]"
                        : "bg-[#FAF6EF] text-[#12100d]/70 hover:bg-white"
                    }`}
                  >
                    <span className="h-2 w-2 rounded-full bg-[#12100d]" />
                    <span>{av.customization.label}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Mode Switcher Tabs */}
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setMode("link")}
              className={`flex-1 flex items-center justify-center gap-2 rounded-2xl border-[3px] border-[#12100d] py-3 px-4 font-friday text-sm uppercase tracking-wider transition-all shadow-[4px_4px_0px_#12100d] cursor-pointer ${
                mode === "link"
                  ? "bg-[#FFDE59] text-[#12100d]"
                  : "bg-white text-[#12100d]/60 hover:bg-[#FAF6EF]"
              }`}
            >
              <LinkIcon className="w-4 h-4" />
              <span>Paste Online Shopping Link</span>
            </button>
            <button
              type="button"
              onClick={() => setMode("upload")}
              className={`flex-1 flex items-center justify-center gap-2 rounded-2xl border-[3px] border-[#12100d] py-3 px-4 font-friday text-sm uppercase tracking-wider transition-all shadow-[4px_4px_0px_#12100d] cursor-pointer ${
                mode === "upload"
                  ? "bg-[#FFDE59] text-[#12100d]"
                  : "bg-white text-[#12100d]/60 hover:bg-[#FAF6EF]"
              }`}
            >
              <UploadCloud className="w-4 h-4" />
              <span>Upload / Drop Photos</span>
            </button>
          </div>

          {/* ── Main Bento Grid ── */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
            {/* Left Column (5 cols): Input & Preprocessing Canvas */}
            <div className="lg:col-span-5 space-y-4">
              {mode === "link" ? (
                <div className="rounded-3xl border-[3px] border-[#12100d] bg-white p-5 sm:p-6 shadow-[6px_6px_0px_#12100d] space-y-4">
                  <h3 className="font-friday text-lg uppercase tracking-wide text-[#12100d]">
                    Online Product Link
                  </h3>
                  <p className="font-mono text-xs text-[#12100d]/60">
                    Paste any product URL from Zara, H&M, Myntra, Amazon, Uniqlo, or ASOS.
                  </p>

                  <form onSubmit={handleFetchLink} className="space-y-3">
                    <input
                      type="url"
                      value={productUrl}
                      onChange={(e) => setProductUrl(e.target.value)}
                      placeholder="https://www.zara.com/product/..."
                      required
                      className="w-full rounded-xl border-2 border-[#12100d] bg-[#FAF6EF] px-3.5 py-2 font-mono text-xs font-bold text-[#12100d] outline-none shadow-[2px_2px_0px_#12100d] focus:shadow-[3px_3px_0px_#12100d]"
                    />

                    <button
                      type="submit"
                      disabled={fetchingLink || !productUrl.trim()}
                      className="w-full flex items-center justify-center gap-2 rounded-xl border-2 border-[#12100d] bg-[#12100d] py-2.5 px-4 font-friday text-xs uppercase tracking-wider text-white shadow-[3px_3px_0px_#FFDE59] hover:bg-[#FFDE59] hover:text-[#12100d] active:translate-x-[1px] active:translate-y-[1px] transition-all cursor-pointer disabled:opacity-50"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>{fetchingLink ? "EXTRACTING GARMENT IMAGE..." : "FETCH PRODUCT"}</span>
                    </button>
                  </form>

                  {linkError && (
                    <p className="rounded-xl border-2 border-[#12100d] bg-[#FF5A5F] p-3 font-mono text-xs font-bold text-white shadow-[2px_2px_0px_#12100d]">
                      {linkError}
                    </p>
                  )}

                  {/* Gallery selector if multiple images found */}
                  {fetchedImages.length > 1 && (
                    <div className="pt-2 border-t-2 border-[#12100d]/15">
                      <p className="font-mono text-[0.65rem] font-black uppercase text-[#12100d]/60 mb-2">
                        Detected Product Shots:
                      </p>
                      <div className="flex gap-2 overflow-x-auto pb-1">
                        {fetchedImages.slice(0, 5).map((img, i) => (
                          <button
                            key={i}
                            type="button"
                            onClick={() => handleSelectGalleryImage(img)}
                            className={`relative h-14 w-14 shrink-0 rounded-lg border-2 border-[#12100d] overflow-hidden ${
                              selectedImageUrl === img ? "ring-2 ring-[#FFDE59]" : "opacity-70 hover:opacity-100"
                            }`}
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={img} alt="Product Shot" className="h-full w-full object-cover" />
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="rounded-3xl border-[3px] border-[#12100d] bg-white p-5 sm:p-6 shadow-[6px_6px_0px_#12100d] space-y-4">
                  <h3 className="font-friday text-lg uppercase tracking-wide text-[#12100d]">
                    Photo File Upload
                  </h3>
                  <div
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                    className="flex flex-col items-center justify-center p-8 rounded-2xl border-[3px] border-dashed border-[#12100d] bg-[#FAF6EF] hover:bg-[#F4EFE6] transition-all cursor-pointer text-center group shadow-[2px_2px_0px_#12100d]"
                  >
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl border-2 border-[#12100d] bg-[#FFDE59] text-xl font-black shadow-[2px_2px_0px_#12100d] group-hover:scale-110 transition-transform">
                      <UploadCloud className="w-6 h-6 text-[#12100d]" />
                    </div>
                    <span className="font-friday text-sm uppercase text-[#12100d] mt-3">
                      Drop Photo Here
                    </span>
                    <span className="font-mono text-[0.65rem] text-[#12100d]/60 mt-1">
                      or click to browse JPG, PNG, WebP
                    </span>
                  </div>

                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                </div>
              )}

              {/* Garment Cutout Preview Box */}
              <div className="rounded-3xl border-[3px] border-[#12100d] bg-white p-5 shadow-[6px_6px_0px_#12100d] flex flex-col items-center text-center">
                <span className="border-2 border-[#12100d] bg-[#7FE06E] px-2.5 py-0.5 font-mono text-[0.68rem] font-black uppercase text-[#12100d] shadow-[1px_1px_0px_#12100d] mb-3">
                  EXTRACTED CUTOUT (ON WHITE CANVAS)
                </span>

                <div className="relative aspect-square w-48 sm:w-56 overflow-hidden rounded-2xl border-2 border-[#12100d] bg-white p-3 shadow-[4px_4px_0px_#12100d] flex items-center justify-center">
                  {processedPreview ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={processedPreview}
                      alt="Garment Cutout"
                      className="h-full w-full object-contain drop-shadow-[0_8px_16px_rgba(0,0,0,0.12)]"
                    />
                  ) : (
                    <div className="flex flex-col items-center justify-center font-mono text-xs text-[#12100d]/40">
                      <span>Preview will appear here</span>
                    </div>
                  )}
                </div>

                {isMatted && (
                  <span className="mt-3 flex items-center gap-1 border border-[#12100d] bg-[#FAF6EF] px-2 py-0.5 font-mono text-[0.62rem] font-bold text-emerald-700">
                    <Check className="w-3 h-3 text-emerald-700" />
                    <span>Cleanly Cutout & Matted</span>
                  </span>
                )}
              </div>
            </div>

            {/* Right Column (7 cols): Garment Metadata & Settings */}
            <div className="lg:col-span-7 space-y-4">
              <div className="rounded-3xl border-[3px] border-[#12100d] bg-white p-6 sm:p-8 shadow-[6px_6px_0px_#12100d] space-y-5">
                <div className="border-b-2 border-[#12100d]/15 pb-3">
                  <h3 className="font-friday text-2xl uppercase tracking-wide text-[#12100d]">
                    Piece Specifications
                  </h3>
                  <p className="font-mono text-xs text-[#12100d]/60 mt-0.5">
                    Classify category, size and fit silhouette.
                  </p>
                </div>

                {/* Garment Name */}
                <div>
                  <label className="font-mono text-xs font-black uppercase text-[#12100d] block mb-1.5">
                    Garment Name / Title
                  </label>
                  <input
                    value={garmentName}
                    onChange={(e) => setGarmentName(e.target.value)}
                    placeholder="e.g. Classic Oxford Cotton Shirt"
                    required
                    maxLength={90}
                    className="w-full rounded-xl border-2 border-[#12100d] bg-[#FAF6EF] px-3.5 py-2 font-mono text-xs font-bold uppercase text-[#12100d] outline-none shadow-[2px_2px_0px_#12100d] focus:shadow-[3px_3px_0px_#12100d]"
                  />
                </div>

                {/* Rail / Category Selector */}
                <div>
                  <label className="font-mono text-xs font-black uppercase text-[#12100d] block mb-1.5">
                    Wardrobe Rail (Category)
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {UPLOAD_KINDS.map((k) => (
                      <button
                        key={k.id}
                        type="button"
                        onClick={() => setKindId(k.id)}
                        className={`rounded-xl border-2 border-[#12100d] p-2 font-mono text-xs font-black uppercase text-left transition-all shadow-[2px_2px_0px_#12100d] cursor-pointer ${
                          kindId === k.id
                            ? "bg-[#FFDE59] text-[#12100d]"
                            : "bg-[#FAF6EF] text-[#12100d]/70 hover:bg-white"
                        }`}
                      >
                        {k.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Size Label & Fit Cut */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="font-mono text-xs font-black uppercase text-[#12100d] block mb-1.5">
                      Size Label
                    </label>
                    <input
                      value={sizeLabel}
                      onChange={(e) => setSizeLabel(e.target.value)}
                      placeholder="e.g. M, 32, 40R, EU 42"
                      maxLength={15}
                      className="w-full rounded-xl border-2 border-[#12100d] bg-[#FAF6EF] px-3.5 py-2 font-mono text-xs font-bold uppercase text-[#12100d] outline-none shadow-[2px_2px_0px_#12100d]"
                    />
                  </div>

                  <div>
                    <label className="font-mono text-xs font-black uppercase text-[#12100d] block mb-1.5">
                      Fit Silhouette (Cut)
                    </label>
                    <select
                      value={cut}
                      onChange={(e) => setCut(e.target.value as Cut)}
                      className="w-full rounded-xl border-2 border-[#12100d] bg-[#FAF6EF] px-3.5 py-2 font-mono text-xs font-bold uppercase text-[#12100d] outline-none shadow-[2px_2px_0px_#12100d] cursor-pointer"
                    >
                      {CUTS.map((c) => (
                        <option key={c} value={c}>
                          {c.toUpperCase()} CUT
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {error && (
                  <p className="rounded-xl border-2 border-[#12100d] bg-[#FF5A5F] p-3 font-mono text-xs font-bold text-white shadow-[2px_2px_0px_#12100d]">
                    {error}
                  </p>
                )}

                {/* Submit Action Button */}
                <button
                  type="button"
                  onClick={handleSaveGarment}
                  disabled={saving || isPending || (!processedBlob && !selectedImageUrl)}
                  className="w-full flex items-center justify-center gap-2 rounded-2xl border-[3px] border-[#12100d] bg-[#FFDE59] py-3.5 font-friday text-sm uppercase tracking-wider text-[#12100d] shadow-[4px_4px_0px_#12100d] hover:bg-[#FFE57F] hover:shadow-[6px_6px_0px_#12100d] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all cursor-pointer disabled:opacity-50 disabled:pointer-events-none"
                >
                  <span>
                    {saving
                      ? "DIGITISING & RENDERING ON YOUR BODY..."
                      : "HANG IN WARDROBE"}
                  </span>
                  {!saving && <ArrowRight className="w-4 h-4" />}
                </button>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
