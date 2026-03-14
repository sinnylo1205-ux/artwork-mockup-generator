import Replicate from "replicate";
import { storagePut } from "../storage";
import { ENV } from "./env";

export type ReplicateGenerateImageOptions = {
  prompt: string;
  /** 圖片 URL（需為 Replicate 可存取的公開 https 網址）或 data URL */
  imageInput: string;
};

export type ReplicateGenerateImageResponse = {
  url?: string;
};

/** 使用 Replicate Flux img2img 生成模擬圖（高品質） */
export async function generateImageWithReplicate(
  options: ReplicateGenerateImageOptions
): Promise<ReplicateGenerateImageResponse> {
  if (!ENV.replicateApiToken) throw new Error("REPLICATE_API_TOKEN is not configured");
  if (!options.imageInput.startsWith("https://")) {
    throw new Error("Replicate 需要公開圖片 URL（https），無法使用 localhost。請在 .env 設定 SUPABASE_URL 與 SUPABASE_ANON_KEY，圖片會上傳至 Supabase 後再傳給 Replicate。");
  }

  const client = new Replicate({ auth: ENV.replicateApiToken });

  console.log("[Replicate Flux] prompt sent to API:", options.prompt.slice(0, 200) + (options.prompt.length > 200 ? "..." : ""));

  // black-forest-labs/flux-kontext-pro：官方圖像編輯模型，input_image 需為公開 URL（Replicate 無法存取 localhost）
  const output = await client.run("black-forest-labs/flux-kontext-pro" as `${string}/${string}`, {
    input: {
      input_image: options.imageInput,
      prompt: options.prompt,
      output_format: "png",
    },
  });

  if (!output) {
    throw new Error("No image generated from Replicate Flux");
  }

  let imageUrl: string;
  const first = Array.isArray(output) ? output[0] : output;
  if (typeof first === "string") {
    imageUrl = first;
  } else if (first && typeof (first as { url?: () => string }).url === "function") {
    imageUrl = (first as { url: () => string }).url();
  } else {
    throw new Error("No image generated from Replicate Flux");
  }
  const response = await fetch(imageUrl);
  if (!response.ok) throw new Error(`Failed to fetch Replicate output: ${response.status}`);
  const buffer = Buffer.from(await response.arrayBuffer());
  const { url } = await storagePut(`replicate-generated/${Date.now()}.png`, buffer, "image/png");
  return { url };
}
