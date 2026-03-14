/**
 * Image generation helper using OpenAI DALL-E 2 API
 * 
 * DALL-E 2 supports image editing for creating realistic mockups
 * while preserving the original artwork content.
 *
 * Example usage:
 *   const { url: imageUrl } = await generateImageWithOpenAI({
 *     prompt: "Modern living room with artwork on wall",
 *     imageBase64: "base64-encoded-image-data"
 *   });
 */
import OpenAI, { toFile } from "openai";
import { storagePut } from "server/storage";
import { ENV } from "./env";
import sharp from "sharp";

export type OpenAIGenerateImageOptions = {
  prompt: string;
  /** Base64 編碼的原始圖片（不包含 data:image/...;base64, 前綴） */
  imageBase64: string;
  size?: "1024x1024" | "256x256" | "512x512" | "1536x1024" | "1024x1536";
};

export type OpenAIGenerateImageResponse = {
  url?: string;
};

export async function generateImageWithOpenAI(
  options: OpenAIGenerateImageOptions
): Promise<OpenAIGenerateImageResponse> {
  if (!ENV.openaiApiKey) {
    throw new Error("OPENAI_API_KEY is not configured");
  }

  const client = new OpenAI({
    apiKey: ENV.openaiApiKey,
  });

  try {
    console.log(`[DALL-E 2] Starting image generation...`);
    console.log(`[DALL-E 2] Prompt length: ${options.prompt.length} chars`);
    console.log(`[DALL-E 2] Image base64 length: ${options.imageBase64.length} chars`);

    // Convert base64 to Buffer
    const originalBuffer = Buffer.from(options.imageBase64, "base64");
    console.log(`[DALL-E 2] Original buffer size: ${(originalBuffer.length / (1024 * 1024)).toFixed(2)} MB`);

    // Convert to PNG format using sharp (DALL-E 2 requires PNG with RGBA format)
    const pngBuffer = await sharp(originalBuffer)
      .ensureAlpha() // Add alpha channel to convert RGB to RGBA
      .png()
      .resize(1024, 1024, { fit: "inside" }) // Ensure size is reasonable
      .toBuffer();

    // Debug: Log buffer size
    const bufferSizeMB = pngBuffer.length / (1024 * 1024);
    console.log(`[DALL-E 2] PNG buffer size: ${bufferSizeMB.toFixed(2)} MB (${pngBuffer.length} bytes)`);

    // Convert Buffer to File object for OpenAI API
    const artworkFile = await toFile(pngBuffer, "artwork.png", {
      type: "image/png",
    });

    // Debug: Log file details
    console.log(`[DALL-E 2] File created: name=${artworkFile.name}, type=${artworkFile.type}, size=${artworkFile.size} bytes`);

    // Full prompt with mockup instructions
    const fullPrompt = `
Create a photorealistic interior mockup.
Place the provided artwork naturally on the wall.
Keep the artwork design exactly the same. Do not alter the artwork content.
Preserve proportions and details. Add realistic shadows.
${options.prompt}
    `.trim();

    // Call OpenAI images.edit API
    const result = await client.images.edit({
      model: "dall-e-2",
      prompt: fullPrompt,
      image: artworkFile,
      size: (options.size as any) || "1024x1024",
      response_format: "b64_json",
    });

    if (!result.data || result.data.length === 0) {
      throw new Error("No image generated from OpenAI DALL-E 2");
    }

    // Get base64 encoded image
    const imageData = result.data[0];
    if (!imageData.b64_json) {
      throw new Error("No b64_json data returned from OpenAI");
    }

    // Convert base64 to buffer for S3 upload
    const buffer = Buffer.from(imageData.b64_json, "base64");

    // Save to S3
    const { url } = await storagePut(
      `openai-generated/${Date.now()}.png`,
      buffer,
      "image/png"
    );

    return {
      url,
    };
  } catch (error: any) {
    // Provide more detailed error message
    console.error(`[DALL-E 2] Error occurred:`, error);
    const errorMessage = error?.message || String(error);
    const errorDetails = error?.response?.data ? JSON.stringify(error.response.data) : "";
    throw new Error(
      `OpenAI DALL-E 2 request failed: ${errorMessage}${errorDetails ? ` - ${errorDetails}` : ""}`
    );
  }
}
