// Supabase Edge Function: 生圖入口
// 驗證 JWT（含匿名訪客）、寫入 artwork_generations
// Replicate 路徑：讀 REPLICATE_API_TOKEN、組 prompt、呼叫 Replicate、輪詢、寫入 Storage + generated_artwork_images + 更新 status

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const REPLICATE_API = "https://api.replicate.com/v1";
const FLUX_MODEL = "black-forest-labs/flux-kontext-pro";
const POLL_INTERVAL_MS = 2000;
const POLL_MAX_WAIT_MS = 5 * 60 * 1000; // 5 分鐘

function jsonResponse(body: object, status = 200, headers = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders, ...headers },
  });
}

type PromptMaps = {
  orientationMap: Record<string, string>;
  roomStyleMap: Record<string, string>;
  frameDescMap: Record<string, string>;
  angleDescMap: Record<string, string>;
  promptParts: { header: string; wallMounted: string; holding: string; generalEnding: string; holdingEnding: string };
  negativeDefault: string;
  negativeHolding: string;
};

function buildPromptMapsFromRows(rows: { key: string; content: string }[]): PromptMaps {
  const byKey: Record<string, string> = {};
  for (const r of rows) byKey[r.key] = r.content;
  const orientationMap: Record<string, string> = {};
  for (const k of ["orientation_portrait", "orientation_landscape", "orientation_square"]) {
    const v = byKey[k];
    if (v) orientationMap[k.replace("orientation_", "")] = v;
  }
  const roomKeys = ["japanese", "nordic", "american", "rustic", "wooden-floor", "artist-holding", "bedroom-with-eaves"];
  const roomStyleMap: Record<string, string> = {};
  for (const r of roomKeys) if (byKey[`room_${r}`]) roomStyleMap[r] = byKey[`room_${r}`];
  const frameKeys = ["matte-gold", "matte-gray", "white", "brushed-silver", "matte-black", "black-walnut", "teak", "light-wood", "maple"];
  const frameDescMap: Record<string, string> = {};
  for (const f of frameKeys) if (byKey[`frame_${f}`]) frameDescMap[f] = byKey[`frame_${f}`];
  const angleDescMap: Record<string, string> = {};
  for (const a of ["left", "front", "right"]) if (byKey[`angle_${a}`]) angleDescMap[a] = byKey[`angle_${a}`];
  const promptParts = {
    header: byKey["prompt_header"] ?? "Professional product photography.",
    wallMounted: byKey["prompt_wallMounted"] ?? "A framed artwork mounted securely on a neutral off-white or warm white plaster wall.",
    holding: byKey["prompt_holding"] ?? "A person holding a framed artwork at chest level with both hands. Only hands and torso visible.",
    generalEnding: byKey["prompt_generalEnding"] ?? "Photorealistic professional photography with realistic depth of field, natural shadows, and authentic lighting.",
    holdingEnding: byKey["prompt_holdingEnding"] ?? "High-end editorial lifestyle photography. Natural wood grain texture visible.",
  };
  return {
    orientationMap,
    roomStyleMap,
    frameDescMap,
    angleDescMap,
    promptParts,
    negativeDefault: byKey["negative_default"] ?? "no white mat, no passe-partout, no border, no padding, no distorted perspective, no watermark, no logo",
    negativeHolding: byKey["negative_holding"] ?? "no mat, no white border, no inset artwork, no distortion, no watermark, no logo",
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  // 依 HTTP 規範 header 名稱不區分大小寫，但 Deno/Edge 可能只保留小寫
  const authHeader = req.headers.get("Authorization") ?? req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    const hasAuth = !!req.headers.get("Authorization") || !!req.headers.get("authorization");
    return jsonResponse(
      { error: hasAuth ? "Authorization must be: Bearer <token>" : "Missing Authorization header" },
      401
    );
  }
  const token = authHeader.slice(7).trim();

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data: { user }, error: userError } = await supabase.auth.getUser(token);
  if (userError || !user) {
    const msg = userError?.message ?? "Invalid or expired token";
    console.error("getUser failed:", msg);
    return jsonResponse({ error: `Invalid or expired token: ${msg}` }, 401);
  }

  // 已登入者皆可生圖（含匿名訪客 JWT）；管理員與提示詞後台權限由前端與 RLS 區分

  let body: {
    originalImageUrl?: string;
    originalImageKey?: string;
    originalImageBase64?: string;
    orientation?: string;
    frameColor?: string;
    roomStyle?: string;
    viewAngles?: string[];
    imageGenerationCore?: string;
    batchId?: string;
  };
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: "Invalid JSON body" }, 400);
  }

  const orientation = body.orientation ?? "portrait";
  const frameColor = body.frameColor ?? "matte-gold";
  const roomStyle = body.roomStyle ?? "japanese";
  const imageGenerationCore = body.imageGenerationCore ?? "replicate";
  const validOrientations = ["portrait", "landscape", "square"];
  const validRoomStyles = [
    "japanese", "nordic", "american", "rustic", "wooden-floor",
    "artist-holding", "bedroom-with-eaves",
  ];
  if (!body.originalImageUrl || !body.originalImageKey) {
    return jsonResponse({ error: "originalImageUrl and originalImageKey required" }, 400);
  }
  if (!validOrientations.includes(orientation)) {
    return jsonResponse({ error: "Invalid orientation" }, 400);
  }
  if (!validRoomStyles.includes(roomStyle)) {
    return jsonResponse({ error: "Invalid roomStyle" }, 400);
  }
  if (imageGenerationCore !== "openai" && imageGenerationCore !== "replicate") {
    return jsonResponse({ error: "imageGenerationCore must be openai or replicate" }, 400);
  }

  const viewAngles = (body.viewAngles && Array.isArray(body.viewAngles) && body.viewAngles.length > 0)
    ? body.viewAngles.filter((a: string) => ["left", "front", "right"].includes(a))
    : ["front"];
  if (viewAngles.length === 0) {
    return jsonResponse({ error: "viewAngles must include at least one of left, front, right" }, 400);
  }

  const { data: row, error: insertError } = await supabase
    .from("artwork_generations")
    .insert({
      auth_user_id: user.id,
      original_image_url: body.originalImageUrl,
      original_image_key: body.originalImageKey,
      orientation,
      frame_color: frameColor,
      room_style: roomStyle,
      status: "processing",
      batch_id: body.batchId ?? null,
      image_generation_core: imageGenerationCore,
    })
    .select("id")
    .single();

  if (insertError) {
    console.error("artwork_generations insert error:", insertError);
    return jsonResponse({ error: insertError.message }, 500);
  }

  const generationId = typeof row.id === "bigint" ? Number(row.id) : row.id;

  if (imageGenerationCore !== "replicate") {
    return jsonResponse({ generationId });
  }

  const replicateToken = Deno.env.get("REPLICATE_API_TOKEN");
  if (!replicateToken?.trim()) {
    await supabase
      .from("artwork_generations")
      .update({ status: "failed", error_message: "REPLICATE_API_TOKEN not set in Edge Function secrets", updated_at: new Date().toISOString() })
      .eq("id", generationId);
    return jsonResponse({ generationId, error: "Replicate 未設定（請在 Supabase Secrets 新增 REPLICATE_API_TOKEN）" }, 200);
  }

  const updateFailed = (msg: string) =>
    supabase.from("artwork_generations").update({ status: "failed", error_message: msg.slice(0, 500), updated_at: new Date().toISOString() }).eq("id", generationId);

  try {
    const { data: templateRows } = await supabase.from("prompt_templates").select("key, content").order("sort_order");
    const maps = templateRows?.length ? buildPromptMapsFromRows(templateRows) : buildPromptMapsFromRows([]);
    const orientationDesc = maps.orientationMap[orientation] ?? maps.orientationMap.portrait ?? "";
    const roomDesc = maps.roomStyleMap[roomStyle] ?? "";
    const frameDesc = maps.frameDescMap[frameColor] ?? "Frame style: aluminum frame, slim modern profile.";
    const negativePrompt = roomStyle === "artist-holding" ? maps.negativeHolding : maps.negativeDefault;
    const results: Record<string, { url: string; key: string }> = {};

    for (const angleName of viewAngles) {
      const angleDesc = maps.angleDescMap[angleName] ?? "";
      const prompt =
        roomStyle === "artist-holding"
          ? [maps.promptParts.header, maps.promptParts.holding, roomDesc, frameDesc, angleDesc, orientationDesc, maps.promptParts.holdingEnding].join(" ")
          : [maps.promptParts.header, maps.promptParts.wallMounted, roomDesc, frameDesc, angleDesc, orientationDesc, maps.promptParts.generalEnding].join(" ");
      const fullPrompt = `${prompt}\n\nNegative prompt: ${negativePrompt}`;

      const createRes = await fetch(`${REPLICATE_API}/predictions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${replicateToken}`,
        },
        body: JSON.stringify({
          version: FLUX_MODEL,
          input: {
            input_image: body.originalImageUrl,
            prompt: fullPrompt,
            output_format: "png",
          },
        }),
      });
      if (!createRes.ok) {
        const errText = await createRes.text();
        await updateFailed(`Replicate create failed: ${createRes.status} ${errText.slice(0, 200)}`);
        return jsonResponse({ generationId });
      }
      const pred = (await createRes.json()) as { id?: string; status?: string; output?: unknown; error?: string };
      const predId = pred.id;
      if (!predId) {
        await updateFailed("Replicate returned no prediction id");
        return jsonResponse({ generationId });
      }

      const started = Date.now();
      let last = pred as { status?: string; output?: unknown; error?: string };
      while (last.status !== "succeeded" && last.status !== "failed" && last.status !== "canceled") {
        if (Date.now() - started > POLL_MAX_WAIT_MS) {
          await updateFailed("Replicate prediction timeout");
          return jsonResponse({ generationId });
        }
        await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
        const getRes = await fetch(`${REPLICATE_API}/predictions/${predId}`, {
          headers: { Authorization: `Bearer ${replicateToken}` },
        });
        if (!getRes.ok) {
          await updateFailed(`Replicate get failed: ${getRes.status}`);
          return jsonResponse({ generationId });
        }
        last = (await getRes.json()) as { status?: string; output?: unknown; error?: string };
      }

      if (last.status !== "succeeded" || last.error) {
        await updateFailed(last.error ? String(last.error).slice(0, 500) : "Replicate prediction failed");
        return jsonResponse({ generationId });
      }

      let imageUrl: string | undefined;
      const out = last.output;
      if (typeof out === "string") imageUrl = out;
      else if (Array.isArray(out) && out.length > 0 && typeof out[0] === "string") imageUrl = out[0];
      if (!imageUrl) {
        await updateFailed("Replicate output had no image URL");
        return jsonResponse({ generationId });
      }

      const imgRes = await fetch(imageUrl);
      if (!imgRes.ok) {
        await updateFailed(`Failed to fetch Replicate image: ${imgRes.status}`);
        return jsonResponse({ generationId });
      }
      const imageBytes = new Uint8Array(await imgRes.arrayBuffer());
      const shortId = crypto.randomUUID().slice(0, 8);
      const storagePath = `artwork-mockups/${user.id}/${generationId}/${angleName}-${shortId}.png`;
      const { error: uploadErr } = await supabase.storage.from("artwork-mockups").upload(storagePath, imageBytes, {
        contentType: "image/png",
        upsert: true,
      });
      if (uploadErr) {
        await updateFailed(`Storage upload failed: ${uploadErr.message}`);
        return jsonResponse({ generationId });
      }
      const { data: urlData } = supabase.storage.from("artwork-mockups").getPublicUrl(storagePath);
      const publicUrl = urlData.publicUrl;
      results[angleName] = { url: publicUrl, key: storagePath };

      const { error: insertImgErr } = await supabase.from("generated_artwork_images").insert({
        artwork_generation_id: generationId,
        auth_user_id: user.id,
        storage_path: storagePath,
        public_url: publicUrl,
        angle: angleName,
      });
      if (insertImgErr) console.error("generated_artwork_images insert error:", insertImgErr);
    }

    const updatePayload: Record<string, unknown> = {
      status: "completed",
      updated_at: new Date().toISOString(),
    };
    if (results.left) {
      updatePayload.left_angle_image_url = results.left.url;
      updatePayload.left_angle_image_key = results.left.key;
    }
    if (results.front) {
      updatePayload.front_image_url = results.front.url;
      updatePayload.front_image_key = results.front.key;
    }
    if (results.right) {
      updatePayload.right_angle_image_url = results.right.url;
      updatePayload.right_angle_image_key = results.right.key;
    }
    await supabase.from("artwork_generations").update(updatePayload).eq("id", generationId);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("generate-mockups error:", msg);
    await updateFailed(msg);
  }

  return jsonResponse({ generationId });
});
