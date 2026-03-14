import { COOKIE_NAME } from "../shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router, protectedProcedure } from "./_core/trpc";
import { z } from "zod";
import { storagePut } from "./storage";
import { recordGeneratedArtworkImage, getPromptTemplates, buildPromptMaps, getFallbackPromptMaps, updatePromptTemplate, listGeneratedArtworkImagesByMonth } from "./supabase";
import { generateImageWithOpenAI } from "./_core/dalleImageGeneration";
import { generateImageWithReplicate } from "./_core/replicateImageGeneration";
import {
  createArtworkGeneration,
  updateArtworkGeneration,
  getUserArtworkGenerations,
  deleteArtworkGeneration,
  getArtworkGenerationById,
} from "./db";
import { nanoid } from "nanoid";
import { ENV } from "./_core/env";

function toFriendlyErrorMsg(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  if (msg.includes("OPENAI_API_KEY")) return "未設定 OpenAI API。請在環境變數設定 OPENAI_API_KEY。";
  if (msg.includes("REPLICATE_API_TOKEN")) return "未設定 Replicate API。請在環境變數設定 REPLICATE_API_TOKEN。";
  return msg;
}


export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),

  artwork: router({
    uploadOriginalImage: protectedProcedure
      .input(z.object({ imageData: z.string(), mimeType: z.string() }))
      .mutation(async ({ input, ctx }) => {
        const base64Data = input.imageData.replace(/^data:image\/\w+;base64,/, "");
        const buffer = Buffer.from(base64Data, "base64");
        const fileKey = `artwork-originals/${ctx.user.id}/${nanoid()}.${input.mimeType.split("/")[1]}`;
        const { url } = await storagePut(fileKey, buffer, input.mimeType);
        return { url, key: fileKey, base64Data };
      }),

    generateMockups: protectedProcedure
      .input(
        z.object({
          originalImageUrl: z.string(),
          originalImageKey: z.string(),
          originalImageBase64: z.string(),
          orientation: z.enum(["portrait", "landscape", "square"]),
          frameColor: z.enum(["matte-gold", "matte-gray", "white", "brushed-silver", "matte-black", "black-walnut", "teak", "light-wood", "maple"]),
          roomStyle: z.enum(["japanese", "nordic", "american", "rustic", "wooden-floor", "artist-holding", "bedroom-with-eaves"]),
          viewAngles: z.array(z.enum(["left", "front", "right"])).min(1),
          imageGenerationCore: z.enum(["openai", "replicate"]).default("replicate"),
          batchId: z.string().optional(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        const generation = await createArtworkGeneration({
          userId: ctx.user.id,
          originalImageUrl: input.originalImageUrl,
          originalImageKey: input.originalImageKey,
          orientation: input.orientation,
          frameColor: input.frameColor,
          roomStyle: input.roomStyle,
          status: "processing",
          batchId: input.batchId,
          imageGenerationCore: input.imageGenerationCore,
        });

        (async () => {
          try {
            if (input.imageGenerationCore === "openai" && !ENV.openaiApiKey) {
              await updateArtworkGeneration(generation.id, {
                status: "failed",
                errorMessage: "未設定 OpenAI API。請在環境變數設定 OPENAI_API_KEY。",
              });
              return;
            }
            if (input.imageGenerationCore === "replicate" && !ENV.replicateApiToken) {
              await updateArtworkGeneration(generation.id, {
                status: "failed",
                errorMessage: "未設定 Replicate API。請在環境變數設定 REPLICATE_API_TOKEN。",
              });
              return;
            }

            const templates = await getPromptTemplates();
            const maps = templates.length > 0 ? buildPromptMaps(templates) : getFallbackPromptMaps();
            const orientationDesc = maps.orientationMap[input.orientation] ?? maps.orientationMap.portrait;
            const roomDesc = maps.roomStyleMap[input.roomStyle] ?? "";
            const frameDesc = maps.frameDescMap[input.frameColor] || "Frame style: aluminum frame, slim modern profile.";
            const angleDescMap = maps.angleDescMap;
            const angles = input.viewAngles.map((angle) => ({ name: angle, desc: angleDescMap[angle] ?? "" }));
            const negativePrompt =
              input.roomStyle === "artist-holding" ? maps.negativeHolding : maps.negativeDefault;
            const promptParts = maps.promptParts;
            const results: Record<string, { url: string; key: string }> = {};

            for (const angle of angles) {
              const prompt =
                input.roomStyle === "artist-holding"
                  ? [promptParts.header, promptParts.holding, roomDesc, frameDesc, angle.desc, orientationDesc, promptParts.holdingEnding].join(" ")
                  : [promptParts.header, promptParts.wallMounted, roomDesc, frameDesc, angle.desc, orientationDesc, promptParts.generalEnding].join(" ");

              let generatedUrl: string | undefined;
              let buffer: Buffer;

              if (input.imageGenerationCore === "openai") {
                const base64Data = input.originalImageBase64.replace(/^data:image\/\w+;base64,/, "");
                const shortRoom = maps.roomStyleShort[input.roomStyle] || "Modern room";
                const finalPrompt =
                  input.roomStyle === "artist-holding"
                    ? `${shortRoom}. ${frameDesc} frame. ${angle.desc}. Keep artwork same. Photorealistic.`
                    : `${shortRoom}. ${frameDesc} frame on wall. Artwork fills frame, no mat. ${angle.desc}. Keep artwork same. Photorealistic.`;
                const { url: openaiUrl } = await generateImageWithOpenAI({ prompt: finalPrompt, imageBase64: base64Data, size: "1024x1024" });
                generatedUrl = openaiUrl;
              } else {
                // Replicate：使用完整 prompt（含提示詞管理），先上傳取得公開 URL
                const base64Data = input.originalImageBase64.replace(/^data:image\/\w+;base64,/, "");
                const buf = Buffer.from(base64Data, "base64");
                const { url: uploadedImageUrl } = await storagePut(`original/${Date.now()}.jpg`, buf, "image/jpeg");
                const fullPrompt = `${prompt}\n\nNegative prompt: ${negativePrompt}`;
                const { url: replicateUrl } = await generateImageWithReplicate({
                  prompt: fullPrompt,
                  imageInput: uploadedImageUrl,
                });
                generatedUrl = replicateUrl;
              }

              if (!generatedUrl) throw new Error("Failed to generate image");
              const response = await fetch(generatedUrl);
              if (!response.ok) throw new Error(`Failed to fetch generated image: ${response.status}`);
              buffer = Buffer.from(await response.arrayBuffer());
              const fileKey = `artwork-mockups/${ctx.user.id}/${generation.id}/${angle.name}-${nanoid()}.png`;
              const { url } = await storagePut(fileKey, buffer, "image/png");
              results[angle.name] = { url, key: fileKey };
              await recordGeneratedArtworkImage({
                artworkGenerationId: generation.id,
                userId: ctx.user.id,
                storagePath: fileKey,
                publicUrl: url,
                angle: angle.name,
              });
            }

            const updateData: Record<string, unknown> = { status: "completed" };
            if (results.left) {
              updateData.leftAngleImageUrl = results.left.url;
              updateData.leftAngleImageKey = results.left.key;
            }
            if (results.front) {
              updateData.frontImageUrl = results.front.url;
              updateData.frontImageKey = results.front.key;
            }
            if (results.right) {
              updateData.rightAngleImageUrl = results.right.url;
              updateData.rightAngleImageKey = results.right.key;
            }
            await updateArtworkGeneration(generation.id, updateData as any);
          } catch (error) {
            console.error("Failed to generate mockups:", error);
            await updateArtworkGeneration(generation.id, { status: "failed", errorMessage: toFriendlyErrorMsg(error) });
          }
        })();

        return { generationId: generation.id };
      }),

    getGeneration: protectedProcedure.input(z.object({ id: z.number() })).query(async ({ input, ctx }) => {
      const generation = await getArtworkGenerationById(input.id);
      if (!generation || generation.userId !== ctx.user!.id) throw new Error("Generation not found");
      return generation;
    }),

    listGenerations: protectedProcedure.query(async ({ ctx }) => getUserArtworkGenerations(ctx.user!.id)),

    deleteGeneration: protectedProcedure.input(z.object({ id: z.number() })).mutation(async ({ input, ctx }) => {
      const generation = await getArtworkGenerationById(input.id);
      if (!generation || generation.userId !== ctx.user!.id) throw new Error("Generation not found");
      await deleteArtworkGeneration(input.id, ctx.user!.id);
      return { success: true };
    }),

    /** 月度歸檔：從 Supabase generated_artwork_images 依月份回傳當前用戶的生成圖 */
    getArchiveByMonth: protectedProcedure.query(async ({ ctx }) => {
      return listGeneratedArtworkImagesByMonth(ctx.user!.id);
    }),
  }),

  prompt: router({
    list: protectedProcedure.query(async () => getPromptTemplates()),
    update: protectedProcedure
      .input(z.object({ key: z.string(), content: z.string() }))
      .mutation(async ({ input }) => {
        await updatePromptTemplate(input.key, input.content);
        return { success: true };
      }),
  }),
});

export type AppRouter = typeof appRouter;
