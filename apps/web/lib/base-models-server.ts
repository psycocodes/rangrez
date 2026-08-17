import "server-only";

import { promises as fs } from "node:fs";
import path from "node:path";

import { BASE_MODELS, modelPath, platePath, type BaseModel } from "./base-models";

/**
 * Which base models have a photograph yet.
 *
 * The catalog in lib/base-models.ts is the design — six bodies, their builds,
 * their framings. Whether any given one can actually be *used* is a question
 * about the disk, because the plate is a file someone drops in rather than
 * something in the repository. Checking here rather than hard-coding a list
 * means adding a body is copying a JPEG into public/base-models/ and nothing
 * else: no code change, no redeploy, no list to keep in agreement with itself.
 *
 * The 3D asset is looked for the same way and used for nothing yet — it is
 * reported so the picker can say "3D ready" the day one appears, and so that
 * whoever adds one can tell it was found.
 */

export interface BaseModelStatus extends BaseModel {
  /** A real photograph exists, so this body can be dressed. */
  ready: boolean;
  /** Where the photograph is, when there is one. */
  plateUrl?: string;
  /** Reserved: a 3D asset was found. Nothing renders it yet. */
  modelUrl?: string;
}

const PUBLIC = path.join(process.cwd(), "public");

async function exists(url: string): Promise<boolean> {
  try {
    await fs.access(path.join(PUBLIC, url));
    return true;
  } catch {
    return false;
  }
}

export async function listBaseModels(): Promise<BaseModelStatus[]> {
  return Promise.all(
    BASE_MODELS.map(async (model) => {
      const plate = platePath(model.id);
      const asset = modelPath(model.id);
      const [hasPlate, hasModel] = await Promise.all([exists(plate), exists(asset)]);
      return {
        ...model,
        ready: hasPlate,
        plateUrl: hasPlate ? plate : undefined,
        modelUrl: hasModel ? asset : undefined,
      };
    }),
  );
}

/** One model, only if it is actually usable. Used to gate adopting it. */
export async function usableBaseModel(
  id: string,
): Promise<BaseModelStatus | undefined> {
  const model = BASE_MODELS.find((m) => m.id === id);
  if (!model) return undefined;

  const plate = platePath(model.id);
  if (!(await exists(plate))) return undefined;

  return { ...model, ready: true, plateUrl: plate };
}
