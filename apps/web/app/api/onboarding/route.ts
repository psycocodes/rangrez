import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { usableBaseModel } from "@/lib/base-models-server";
import { newId, recomputePalette, updateUser } from "@/lib/db";
import { fetchImage } from "@/lib/fetch-image";
import { buildSeason } from "@/lib/palette";
import { storeUpload } from "@/lib/uploads";
import { createAvatar } from "@/lib/youcam";
import type { MeasureUnit } from "@/lib/fit";
import type { Avatar, AvatarFraming, Measurements } from "@/lib/types";

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized. Please sign in." }, { status: 401 });
    }

    const contentType = req.headers.get("content-type") ?? "";
    let baseModelId = "";
    let avatarName = "";
    let framing: AvatarFraming = "full";
    let photo: File | null = null;
    let cutout: File | null = null;
    let measurements: Measurements = { unit: "cm" };

    if (contentType.includes("multipart/form-data")) {
      const form = await req.formData();
      baseModelId = String(form.get("baseModel") ?? "").trim();
      avatarName = String(form.get("avatarName") ?? form.get("label") ?? "").trim();
      framing = (String(form.get("framing") ?? "full") as AvatarFraming) || "full";
      
      const photoField = form.get("photo");
      if (photoField instanceof File && photoField.size > 0) {
        photo = photoField;
      }

      const cutoutField = form.get("cutout");
      if (cutoutField instanceof File && cutoutField.size > 0) {
        cutout = cutoutField;
      }

      const unit = (String(form.get("unit") ?? "cm") as MeasureUnit) || "cm";
      measurements = {
        unit,
        heightCm: Number(form.get("heightCm")) || (unit === "cm" ? 175 : Math.round(69 * 2.54)),
        chestCm: Number(form.get("chestCm")) || (unit === "cm" ? 96 : Math.round(38 * 2.54)),
        waistCm: Number(form.get("waistCm")) || (unit === "cm" ? 82 : Math.round(32 * 2.54)),
        hipCm: Number(form.get("hipCm")) || (unit === "cm" ? 98 : Math.round(39 * 2.54)),
        inseamCm: Number(form.get("inseamCm")) || (unit === "cm" ? 78 : Math.round(31 * 2.54)),
        updatedAt: new Date().toISOString(),
      };
    } else {
      const json = await req.json();
      baseModelId = String(json.baseModel ?? "").trim();
      avatarName = String(json.avatarName ?? json.label ?? "").trim();
      framing = (json.framing as AvatarFraming) || "full";
      measurements = {
        unit: json.measurements?.unit || "cm",
        heightCm: Number(json.measurements?.heightCm) || 175,
        chestCm: Number(json.measurements?.chestCm) || 96,
        waistCm: Number(json.measurements?.waistCm) || 82,
        hipCm: Number(json.measurements?.hipCm) || 98,
        inseamCm: Number(json.measurements?.inseamCm) || 78,
        updatedAt: new Date().toISOString(),
      };
    }

    // Resolve plate URL and bytes
    let plateUrl = "/assets/avatar-01.jpg";
    let bytes: Buffer | null = null;
    let mime = "image/jpeg";
    let cutoutUrl: string | undefined = undefined;

    const model = baseModelId ? await usableBaseModel(baseModelId) : undefined;

    if (model?.plateUrl) {
      plateUrl = model.plateUrl;
      const img = await fetchImage(model.plateUrl);
      bytes = img.bytes;
      mime = img.contentType;
      framing = model.framing;
    } else if (photo) {
      const stored = await storeUpload(photo);
      plateUrl = stored.url;
      bytes = stored.bytes;
      mime = stored.contentType;
    } else {
      // Fallback default avatar-01
      plateUrl = "/assets/avatar-01.jpg";
      const img = await fetchImage("/assets/avatar-01.jpg");
      bytes = img.bytes;
      mime = img.contentType;
    }

    if (cutout && cutout instanceof File && cutout.size > 0) {
      try {
        cutoutUrl = (await storeUpload(cutout)).url;
      } catch (err) {
        console.warn("[onboarding] cutout store error:", err);
      }
    }

    // Call createAvatar
    const youcamRes = bytes
      ? await createAvatar(bytes, mime)
      : {
          renderUrl: plateUrl,
          taskId: "local",
          colorSeason: buildSeason("Cool Summer"),
          mocked: true,
        };

    const avatarId = newId();
    const avatar: Avatar = {
      id: avatarId,
      sourceUrl: plateUrl,
      renderUrl: youcamRes.renderUrl || plateUrl,
      cutoutUrl,
      baseModelId: model?.id,
      status: "rendered",
      taskId: youcamRes.taskId,
      colorSeason: youcamRes.colorSeason,
      framing,
      measurements,
      useGlobalMeasurements: true,
      createdAt: new Date().toISOString(),
      customization: {
        backdrop: "paper",
        crop: "three-quarter",
        grade: 0,
        guides: true,
        label: avatarName || model?.label || "Primary Fit Model",
      },
    };

    // Save to database
    await updateUser(user.id, (u) => {
      u.avatars = [avatar];
      u.activeAvatarId = avatar.id;
      u.measurements = measurements;
      if (model) {
        u.preferences.vtoGender = model.vtoGender;
      }
    });

    await recomputePalette(user.id, youcamRes.colorSeason);

    return NextResponse.json({
      success: true,
      avatar,
      measurements,
      redirect: "/trialroom",
    });
  } catch (err) {
    console.error("[api/onboarding] error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Onboarding failed." },
      { status: 500 },
    );
  }
}
