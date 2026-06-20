import axios from "axios";
import { CONFIG, DEFAULT_MODEL_CONFIG, type ModelConfig } from "./config";

interface CacheEntry {
  config:    ModelConfig;
  blobId:    string;
  fetchedAt: number;
}

let cache: CacheEntry | null = null;

export async function uploadModelConfigToWalrus(config: ModelConfig): Promise<string> {
  const bytes = Buffer.from(JSON.stringify(config, null, 2), "utf-8");
  console.log("[Walrus] Uploading model config...");
  const res = await axios.put(
    `${CONFIG.WALRUS_PUBLISHER}/v1/blobs?epochs=5`,
    bytes,
    { headers: { "Content-Type": "application/octet-stream" }, timeout: 30_000 }
  );
  const blobId: string =
    res.data?.newlyCreated?.blobObject?.blobId ??
    res.data?.alreadyCertified?.blobId ?? "";
  if (!blobId) throw new Error("Walrus upload failed — no blobId in response");
  console.log(`[Walrus] ✅ Uploaded. Blob ID: ${blobId}`);
  return blobId;
}

export async function loadModelConfig(): Promise<ModelConfig> {
  const now = Date.now();
  if (cache && now - cache.fetchedAt < CONFIG.MODEL_CACHE_MS) return cache.config;

  const blobId = CONFIG.WALRUS_MODEL_BLOB_ID;
  if (!blobId || blobId === "placeholder") {
    console.warn("[ModelLoader] No blob ID — using defaults.");
    return DEFAULT_MODEL_CONFIG;
  }

  try {
    const url = `${CONFIG.WALRUS_AGGREGATOR}/v1/blobs/${blobId}`;
    const res = await axios.get(url, { responseType: "arraybuffer", timeout: 10_000 });
    const bytes = Buffer.from(res.data as ArrayBuffer);
    const configJson = bytes.toString("utf-8");
    const parsed = JSON.parse(configJson) as ModelConfig;
    if (!parsed.weights || !parsed.thresholds) throw new Error("Invalid config structure");
    cache = { config: parsed, blobId, fetchedAt: now };
    console.log(`[ModelLoader] ✅ Loaded from blob ${blobId}`);
    return parsed;
  } catch (err: any) {
    console.error("[ModelLoader] Walrus fetch failed — using defaults.", err?.message);
    return DEFAULT_MODEL_CONFIG;
  }
}

export function clearModelCache(): void { cache = null; }
export function getCachedBlobId(): string {
  return cache?.blobId ?? CONFIG.WALRUS_MODEL_BLOB_ID ?? "placeholder";
}