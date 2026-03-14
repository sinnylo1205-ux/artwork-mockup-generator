import OpenAI, { toFile } from "openai";
import { storagePut } from "../storage";
import { ENV } from "./env";
import sharp from "sharp";

export type OpenAIGenerateImageOptions = {
  prompt: string;
  imageBase64: string;
  size?: "1024x1024" | "256x256" | "512x512" | "1536x1024" | "1024x1536";
};

export type OpenAIGenerateImageResponse = {
  url?: string;
};

export async function generateImageWithOpenAI(
  options: OpenAIGenerateImageOptions
): Promise<OpenAIGenerateImageResponse> {
  if (!ENV.openaiApiKey) throw new Error("OPENAI_API_KEY is not configured");

  const client = new OpenAI({ apiKey: ENV.openaiApiKey });

  const originalBuffer = Buffer.from(options.imageBase64, "base64");
  const pngBuffer = await sharp(originalBuffer)
    .ensureAlpha()
    .png()
    .resize(1024, 1024, { fit: "inside" })
    .toBuffer();

  const artworkFile = await toFile(pngBuffer, "artwork.png", { type: "image/png" });

  const fullPrompt = `
Create a photorealistic interior mockup.
Place the provided artwork naturally on the wall.
Keep the artwork design exactly the same. Do not alter the artwork content.
Preserve proportions and details. Add realistic shadows.
${options.prompt}
  `.trim();

  console.log("[OpenAI DALL-E] fullPrompt sent to API:", fullPrompt);

  const result = await client.images.edit({
    model: "dall-e-2",
    prompt: fullPrompt,
    image: artworkFile,
    size: (options.size as "1024x1024") || "1024x1024",
    response_format: "b64_json",
  });

  if (!result.data?.length || !result.data[0].b64_json) {
    throw new Error("No image generated from OpenAI DALL-E 2");
  }

  const buffer = Buffer.from(result.data[0].b64_json, "base64");
  const { url } = await storagePut(`openai-generated/${Date.now()}.png`, buffer, "image/png");
  return { url };
}
