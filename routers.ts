import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router, protectedProcedure } from "./_core/trpc";
import { z } from "zod";
import { storagePut } from "./storage";
import { generateImage } from "./_core/imageGeneration";
import { generateImageWithOpenAI } from "./_core/dalleImageGeneration";
import { 
  createArtworkGeneration, 
  updateArtworkGeneration, 
  getUserArtworkGenerations,
  deleteArtworkGeneration,
  getArtworkGenerationById
} from "./db";
import { nanoid } from "nanoid";

export const appRouter = router({
    // if you need to use socket.io, read and register route in server/_core/index.ts, all api should start with '/api/' so that the gateway can route correctly
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
  }),

  artwork: router({
    // 上傳原始作品圖片到 S3
    uploadOriginalImage: protectedProcedure
      .input(z.object({
        imageData: z.string(), // base64 encoded image
        mimeType: z.string(),
      }))
      .mutation(async ({ input, ctx }) => {
        const { imageData, mimeType } = input;
        
        // 將 base64 轉換為 Buffer
        const base64Data = imageData.replace(/^data:image\/\w+;base64,/, "");
        const buffer = Buffer.from(base64Data, "base64");
        
        // 上傳到 S3
        const fileKey = `artwork-originals/${ctx.user.id}/${nanoid()}.${mimeType.split("/")[1]}`;
        const { url } = await storagePut(fileKey, buffer, mimeType);
        
        // 返回 URL、key 和 base64 數據供後續使用
        return { url, key: fileKey, base64Data };
      }),

    // 創建一個新的作品生成記錄並生成三個視角的圖片
    generateMockups: protectedProcedure
      .input(z.object({
        originalImageUrl: z.string(),
        originalImageKey: z.string(),
        originalImageBase64: z.string(), // base64 編碼的圖片數據
        orientation: z.enum(["portrait", "landscape", "square"]),
        frameColor: z.enum(["matte-gold", "matte-gray", "white", "brushed-silver", "matte-black", "black-walnut", "teak", "light-wood", "maple"]),
        roomStyle: z.enum(["japanese", "nordic", "american", "rustic", "wooden-floor", "artist-holding", "bedroom-with-eaves"]),
        viewAngles: z.array(z.enum(["left", "front", "right"])).min(1), // 勾選的視角
        imageGenerationCore: z.enum(["manus", "openai"]).default("manus"), // 生圖核心
        batchId: z.string().optional(), // 批次 ID（用於分組同一次生成的多條記錄）
      }))
      .mutation(async ({ input, ctx }) => {
        // 創建初始記錄
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

        // 在背景中生成圖片（不阻塞回應）
        (async () => {
          try {
            // 準備 prompt 參數
            const orientationMap = {
              portrait: "Artwork orientation: vertical (50x70cm)",
              landscape: "Artwork orientation: horizontal (70x50cm)",
              square: "Artwork orientation: square (50x50cm)",
            };
            
            const roomStyleMap = {
              japanese: "Minimalist Japanese interior with tatami mats, natural wood textures, and soft ambient daylight. Calm and quiet atmosphere.",
              nordic: "Scandinavian interior with light wood flooring, large windows, and soft natural daylight. Minimal styling. Airy and bright space.",
              american: "Modern American living room with contemporary furniture and neutral tones. Hardwood flooring and subtle sophisticated lighting.",
              rustic: "Rustic country interior with exposed wooden beams and warm cozy lighting. Natural textures and earthy tones.",
              "wooden-floor": "A framed artwork mounted securely on a neutral off-white or warm white plaster wall in a photorealistic interior photography scene with calm minimalist aesthetic. Dark natural teak wood flooring. Soft natural daylight from the right, creating a bright sunlit patch on the floor and gentle shadows. Warm, airy, quiet atmosphere. Minimal interior styling: a simple wooden chair on the right, a small stack of books on the floor to the left. Lots of negative space, uncluttered composition. Scandinavian-inspired, modern, calm aesthetic. The artwork is the clear visual focus.",
              "artist-holding": "The artwork is printed full-bleed and mounted without any mat or margin. ASPECT RATIO LOCK — 5:7 (ABSOLUTE): The artwork has a FIXED physical aspect ratio of 5:7. This ratio must be preserved exactly. No cropping. No resizing. No padding. No scaling. No re-centering. The frame must match the exact same 5:7 proportion. Photorealistic lifestyle product photography in a wider environment. A person holding a framed artwork at chest level with both hands. Only hands and torso visible. Face softly out of focus or partially cropped. Slim modern profile. NO mat. NO passe-partout. NO white border. Artwork fills the frame edge-to-edge. WIDER SCENE FOR VIDEO USE: Wide-angle interior view. Visible room depth. Foreground, mid-ground, and background layers. More breathing space around the subject. The subject is centered but not filling the entire frame. Spacious Scandinavian studio interior. Visible desk, shelves, soft furnishings, floor texture, and wall space. Large window light from the side. Soft diffused daylight. Natural ambient atmosphere. Shallow depth of field but not overly blurred. Realistic spatial perspective. Balanced composition with cinematic negative space. Final output aspect ratio: 1:1 square. Do NOT crop the artwork to fit the square. Expand the environment instead. High-end editorial lifestyle photography. Natural wood grain texture visible. Premium clean presentation.",
              "bedroom-with-eaves": "Photorealistic interior wall art photography. Minimalist Japanese-style bedroom. Artwork has exact 5:7 physical aspect ratio. Frame custom-built to match 5:7 dimensions. Framed artwork mounted on beige plaster wall above wooden headboard. Warm neutral palette. Light oak flooring. Built-in wooden headboard. Clean architectural ceiling with wooden eaves. Low platform bed with white bedding and brown blanket. Ribbed glass wardrobe panels. Soft natural daylight from left side. Japanese-Scandinavian fusion interior. Thin light natural oak wood frame. No mat. No passe-partout. No white border. Full-bleed artwork inside frame. Eye-level perspective. 24mm wide angle. Professional interior photography. High realism. Soft natural color grading. Final output 1:1 square aspect ratio.",
            };

            const orientationDesc = orientationMap[input.orientation];
            const roomDesc = roomStyleMap[input.roomStyle];
            
            // 框架風格描述（簡潔版本）
            const frameDescMap: Record<string, string> = {
              "matte-gold": "Frame style: matte bronze-gold aluminum frame, slim modern profile.",
              "matte-gray": "Frame style: brushed gray aluminum frame with subtle blue tint, slim modern profile.",
              "white": "Frame style: white aluminum frame, slim modern profile.",
              "brushed-silver": "Frame style: brushed silver aluminum frame, slim modern profile.",
              "matte-black": "Frame style: brushed black aluminum frame, slim modern profile.",
              "black-walnut": "Frame style: black walnut solid wood frame with slim modern profile.",
              "teak": "Frame style: teak wood frame, slim modern profile.",
              "light-wood": "Frame style: light natural wood frame, slim modern profile.",
              "maple": "Frame style: maple wood frame, slim modern profile.",
            };
            const frameDesc = frameDescMap[input.frameColor] || "Frame style: aluminum frame, slim modern profile.";

            // 根據勾選的視角生成圖片
            const angleDescMap = {
              left: "Camera angle: 45-degree left perspective.",
              front: "Camera angle: straight-on front view.",
              right: "Camera angle: 45-degree right perspective.",
            };
            const angles = input.viewAngles.map(angle => ({
              name: angle,
              desc: angleDescMap[angle],
            }));

            const results: Record<string, { url: string; key: string }> = {};

            // 根據房間風格選擇不同的負向提示詞
            const negativePrompt = input.roomStyle === "artist-holding" 
              ? "no mat, no white border, no inset artwork, no inner frame shadow, no distortion, no warped perspective, no extra artwork, no watermark, no logo, no illustration style, no 3D render, no overexposure"
              : "no white mat, no passe-partout, no border, no padding, no cropped frame, no blurry edges, no distorted perspective, no missing frame edges, no reinterpreted artwork, no recomposed artwork, no adapted artwork, no overexposure, no underexposure, no color shift, no people, no text, no watermark, no logo, no extra artwork";

            // 定義 prompt 組成部分
            const promptParts = {
              // 列 0（開頭）- 通用開頭
              header: "Professional product photography.",
              // 列 23（掛牆）- 掛牆場景
              wallMounted: "A framed artwork mounted securely on a neutral off-white or warm white plaster wall.",
              // 列 24（手拿）- 手拿場景
              holding: "A person holding a framed artwork at chest level with both hands. Only hands and torso visible.",
              // 列 25A（一般房間結尾）
              generalEnding: "Photorealistic professional photography with realistic depth of field, natural shadows, and authentic lighting. Ultra-high quality, 8K resolution, photographic realism.",
              // 列 25B（holding 結尾）
              holdingEnding: "High-end editorial lifestyle photography. Natural wood grain texture visible. Premium clean presentation.",
            };

            // 只有勾選的視角才會被生成
            for (const angle of angles) {
              // 根據房間風格選擇不同的 prompt 組合框架
              let prompt: string;
              
              if (input.roomStyle === "artist-holding") {
                // artist-holding 模式：列 0 + 列 24 + 框架 + 視角 + 作品方向 + 列 25B
                prompt = [
                  promptParts.header,
                  promptParts.holding,
                  roomDesc,
                  frameDesc,
                  angle.desc,
                  orientationDesc,
                  promptParts.holdingEnding
                ].join(" ");
              } else {
                // 一般房間模式：列 0 + 列 23 + 房間風格 + 框架 + 視角 + 作品方向 + 列 25A
                prompt = [
                  promptParts.header,
                  promptParts.wallMounted,
                  roomDesc,
                  frameDesc,
                  angle.desc,
                  orientationDesc,
                  promptParts.generalEnding
                ].join(" ");
              }

              // 根據選擇的生圖核心選擇不同的生成方案
              let generatedUrl: string | undefined;
              let buffer: Buffer;

              if (input.imageGenerationCore === "openai") {
                // 使用 OpenAI gpt-image-1 模型
                // 提取 base64 圖片數據（移除 data URL 前綴）
                const base64Data = input.originalImageBase64.replace(/^data:image\/\w+;base64,/, "");
                
                // 根據房間風格調整 prompt（縮短版本，確保在 1000 字符以內）
                const roomStyleShort: Record<string, string> = {
                  "japanese": "Japanese room",
                  "nordic": "Scandinavian room",
                  "scandinavian": "Scandinavian room",
                  "american": "Modern urban room",
                  "rustic": "Rustic room",
                  "wooden-floor": "Wood floor room",
                  "wood-floor": "Wood floor room",
                  "artist-holding": "Artist holding",
                  "bedroom-with-eaves": "Rooftop bedroom",
                  "rooftop-bedroom": "Rooftop bedroom"
                };
                const roomDesc = roomStyleShort[input.roomStyle] || "Modern room";
                
                const finalPrompt = input.roomStyle === "artist-holding"
                  ? `${roomDesc}. ${frameDesc} frame. ${angle.desc}. Keep artwork same. Photorealistic.`
                  : `${roomDesc}. ${frameDesc} frame on wall. Artwork fills frame, no mat. ${angle.desc}. Keep artwork same. Photorealistic.`;
                
                try {
                  const { url: openaiUrl } = await generateImageWithOpenAI({
                    prompt: finalPrompt,
                    imageBase64: base64Data,
                    size: "1024x1024",
                  });
                  generatedUrl = openaiUrl;
                } catch (error) {
                  console.error("OpenAI gpt-image-1 generation failed, falling back to Manus:", error);
                  // 失敗時退回使用 Manus 內建，並更新記錄中的核心類型
                  await updateArtworkGeneration(generation.id, {
                    imageGenerationCore: "manus",
                    errorMessage: "OpenAI gpt-image-1 不可用，已自動切換至 Manus 內建核心",
                  });
                  
                  // 先將 base64 圖片上傳到 S3，然後使用 URL 方式調用 API
                  const base64Data = input.originalImageBase64.replace(/^data:image\/\w+;base64,/, "");
                  const buffer = Buffer.from(base64Data, "base64");
                  const { url: uploadedImageUrl } = await storagePut(
                    `original/${Date.now()}.jpg`,
                    buffer,
                    "image/jpeg"
                  );

                  const fullPrompt = `${prompt}\n\nNegative prompt: ${negativePrompt}`;
                  const result = await generateImage({
                    prompt: fullPrompt,
                    originalImages: [{
                      url: uploadedImageUrl,
                      mimeType: "image/jpeg",
                    }],
                  });
                  generatedUrl = result.url;
                }
              } else {
                // 使用 Manus 內建
                // 先將 base64 圖片上傳到 S3，然後使用 URL 方式調用 API
                const base64Data = input.originalImageBase64.replace(/^data:image\/\w+;base64,/, "");
                const buffer = Buffer.from(base64Data, "base64");
                const { url: uploadedImageUrl } = await storagePut(
                  `original/${Date.now()}.jpg`,
                  buffer,
                  "image/jpeg"
                );

                const fullPrompt = `${prompt}\n\nNegative prompt: ${negativePrompt}`;
                const { url: manusUrl } = await generateImage({
                  prompt: fullPrompt,
                  originalImages: [{
                    url: uploadedImageUrl,
                    mimeType: "image/jpeg",
                  }],
                });
                generatedUrl = manusUrl;
              }

              if (!generatedUrl) {
                throw new Error("Failed to generate image");
              }

              // 下載生成的圖片並上傳到 S3
              const response = await fetch(generatedUrl);
              if (!response.ok) {
                throw new Error(`Failed to fetch generated image: ${response.status} ${response.statusText}`);
              }
              const arrayBuffer = await response.arrayBuffer();
              buffer = Buffer.from(arrayBuffer);
              
              const fileKey = `artwork-mockups/${ctx.user.id}/${generation.id}/${angle.name}-${nanoid()}.png`;
              const { url } = await storagePut(fileKey, buffer, "image/png");
              
              results[angle.name] = { url, key: fileKey };
            }

            // 更新記錄（只更新勾選的視角）
            const updateData: any = { status: "completed" };
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
            await updateArtworkGeneration(generation.id, updateData);
          } catch (error) {
            console.error("Failed to generate mockups:", error);
            await updateArtworkGeneration(generation.id, {
              status: "failed",
              errorMessage: error instanceof Error ? error.message : "Unknown error",
            });
          }
        })();

        return { generationId: generation.id };
      }),

    // 獲取單個生成記錄
    getGeneration: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input, ctx }) => {
        const generation = await getArtworkGenerationById(input.id);
        
        if (!generation || generation.userId !== ctx.user!.id) {
          throw new Error("Generation not found");
        }
        
        return generation;
      }),

    // 獲取用戶的所有生成記錄
    listGenerations: protectedProcedure
      .query(async ({ ctx }) => {
        return await getUserArtworkGenerations(ctx.user!.id);
      }),

    // 刪除生成記錄
    deleteGeneration: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input, ctx }) => {
        const generation = await getArtworkGenerationById(input.id);
        
        if (!generation || generation.userId !== ctx.user!.id) {
          throw new Error("Generation not found");
        }
        
        await deleteArtworkGeneration(input.id, ctx.user!.id);
        
        return { success: true };
      }),
  }),
});

export type AppRouter = typeof appRouter;

