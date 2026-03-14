import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { ENV } from "./_core/env";

let _client: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient | null {
  if (!ENV.supabaseUrl || !ENV.supabaseAnonKey) return null;
  if (!_client) _client = createClient(ENV.supabaseUrl, ENV.supabaseAnonKey);
  return _client;
}

/** 以使用者 JWT 建立 Supabase 客戶端，用於 RLS 下查/寫 artwork_user_log_in */
export function getSupabaseClientForUser(accessToken: string): SupabaseClient | null {
  if (!ENV.supabaseUrl || !ENV.supabaseAnonKey) return null;
  return createClient(ENV.supabaseUrl, ENV.supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  });
}

export type ArtworkUserLogInRow = {
  id: number;
  auth_user_id: string;
  email: string | null;
  is_admin: boolean;
  created_at: string;
  updated_at: string;
};

/** 取得或建立 artwork_user_log_in 列（需使用帶有該用戶 JWT 的 client） */
export async function getOrCreateArtworkUser(
  client: SupabaseClient,
  authUserId: string,
  email: string | null
): Promise<ArtworkUserLogInRow | null> {
  const { data: existing } = await client
    .from("artwork_user_log_in")
    .select("id, auth_user_id, email, is_admin, created_at, updated_at")
    .eq("auth_user_id", authUserId)
    .maybeSingle();
  if (existing) return existing as ArtworkUserLogInRow;
  const { error: insertErr } = await client.from("artwork_user_log_in").insert({
    auth_user_id: authUserId,
    email: email ?? null,
    is_admin: false,
  });
  if (insertErr) {
    console.warn("[Supabase] getOrCreateArtworkUser insert:", insertErr.message);
    return null;
  }
  const { data: row } = await client
    .from("artwork_user_log_in")
    .select("id, auth_user_id, email, is_admin, created_at, updated_at")
    .eq("auth_user_id", authUserId)
    .single();
  return (row ?? null) as ArtworkUserLogInRow | null;
}

export type GeneratedImageRow = {
  id: number;
  artwork_generation_id: number;
  user_id: number | null;
  public_url: string;
  angle: string;
  created_at: string;
};

/** 依月份歸檔：從 generated_artwork_images 依 user_id 查詢並按 created_at 分月 */
export async function listGeneratedArtworkImagesByMonth(userId: number): Promise<{ monthKey: string; images: GeneratedImageRow[] }[]> {
  const client = getSupabaseClient();
  if (!client) return [];
  const { data, error } = await client
    .from("generated_artwork_images")
    .select("id, artwork_generation_id, user_id, public_url, angle, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) {
    console.warn("[Supabase] listGeneratedArtworkImagesByMonth:", error.message);
    return [];
  }
  const rows = (data ?? []) as GeneratedImageRow[];
  const byMonth = new Map<string, GeneratedImageRow[]>();
  for (const r of rows) {
    const t = r.created_at ? new Date(r.created_at) : new Date();
    const y = t.getFullYear();
    const m = String(t.getMonth() + 1).padStart(2, "0");
    const key = `${y}-${m}`;
    if (!byMonth.has(key)) byMonth.set(key, []);
    byMonth.get(key)!.push(r);
  }
  return Array.from(byMonth.entries())
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([monthKey, images]) => ({ monthKey, images }));
}

const BUCKET = ENV.supabaseBucket;

export async function uploadToSupabaseStorage(
  path: string,
  buffer: Buffer,
  mimeType: string
): Promise<{ url: string }> {
  const client = getSupabaseClient();
  if (!client) throw new Error("Supabase not configured");
  const { data, error } = await client.storage.from(BUCKET).upload(path, buffer, {
    contentType: mimeType,
    upsert: true,
  });
  if (error) throw error;
  const { data: urlData } = client.storage.from(BUCKET).getPublicUrl(data.path);
  return { url: urlData.publicUrl };
}

export async function recordGeneratedArtworkImage(params: {
  artworkGenerationId: number;
  userId: number;
  storagePath: string;
  publicUrl: string;
  angle: string;
}): Promise<void> {
  const client = getSupabaseClient();
  if (!client) return;
  await client.from("generated_artwork_images").insert({
    artwork_generation_id: params.artworkGenerationId,
    user_id: params.userId,
    storage_path: params.storagePath,
    public_url: params.publicUrl,
    angle: params.angle,
  });
}

export type PromptTemplate = { id: number; key: string; type: string; content: string; sort_order: number; updated_at: string | null };

export async function getPromptTemplates(): Promise<PromptTemplate[]> {
  const client = getSupabaseClient();
  if (!client) return [];
  const { data, error } = await client.from("prompt_templates").select("id, key, type, content, sort_order, updated_at").order("sort_order");
  if (error) {
    console.warn("[Supabase] getPromptTemplates:", error.message);
    return [];
  }
  return (data ?? []) as PromptTemplate[];
}

export async function updatePromptTemplate(key: string, content: string): Promise<void> {
  const client = getSupabaseClient();
  if (!client) throw new Error("Supabase not configured");
  const { error } = await client.from("prompt_templates").update({ content, updated_at: new Date().toISOString() }).eq("key", key);
  if (error) throw error;
}

const FALLBACK_SEED_KEYS = [
  "orientation_portrait", "orientation_landscape", "orientation_square",
  "room_japanese", "room_nordic", "room_american", "room_rustic", "room_wooden-floor", "room_artist-holding", "room_bedroom-with-eaves",
  "frame_matte-gold", "frame_matte-gray", "frame_white", "frame_brushed-silver", "frame_matte-black", "frame_black-walnut", "frame_teak", "frame_light-wood", "frame_maple",
  "angle_left", "angle_front", "angle_right",
  "prompt_header", "prompt_wallMounted", "prompt_holding", "prompt_generalEnding", "prompt_holdingEnding",
  "negative_default", "negative_holding",
  "room_short_japanese", "room_short_nordic", "room_short_american", "room_short_rustic", "room_short_wooden-floor", "room_short_artist-holding", "room_short_bedroom-with-eaves",
] as const;
const FALLBACK_CONTENT: Record<string, string> = {
  orientation_portrait: "Artwork orientation: vertical (50x70cm)",
  orientation_landscape: "Artwork orientation: horizontal (70x50cm)",
  orientation_square: "Artwork orientation: square (50x50cm)",
  room_japanese: "Minimalist Japanese interior with tatami mats, natural wood textures, and soft ambient daylight. Calm and quiet atmosphere.",
  room_nordic: "Scandinavian interior with light wood flooring, large windows, and soft natural daylight. Minimal styling. Airy and bright space.",
  room_american: "Modern American living room with contemporary furniture and neutral tones. Hardwood flooring and subtle sophisticated lighting.",
  room_rustic: "Rustic country interior with exposed wooden beams and warm cozy lighting. Natural textures and earthy tones.",
  "room_wooden-floor": "A framed artwork mounted securely on a neutral off-white or warm white plaster wall in a photorealistic interior photography scene with calm minimalist aesthetic. Dark natural teak wood flooring. Soft natural daylight from the right.",
  "room_artist-holding": "Photorealistic lifestyle product photography. A person holding a framed artwork at chest level with both hands. Only hands and torso visible. Artwork fills the frame edge-to-edge.",
  "room_bedroom-with-eaves": "Photorealistic interior wall art photography. Minimalist Japanese-style bedroom. Framed artwork mounted on beige plaster wall above wooden headboard.",
  "frame_matte-gold": "Frame style: matte bronze-gold aluminum frame, slim modern profile.",
  "frame_matte-gray": "Frame style: brushed gray aluminum frame with subtle blue tint, slim modern profile.",
  frame_white: "Frame style: white aluminum frame, slim modern profile.",
  "frame_brushed-silver": "Frame style: brushed silver aluminum frame, slim modern profile.",
  "frame_matte-black": "Frame style: brushed black aluminum frame, slim modern profile.",
  "frame_black-walnut": "Frame style: black walnut solid wood frame with slim modern profile.",
  frame_teak: "Frame style: teak wood frame, slim modern profile.",
  "frame_light-wood": "Frame style: light natural wood frame, slim modern profile.",
  frame_maple: "Frame style: maple wood frame, slim modern profile.",
  angle_left: "Camera angle: 45-degree left perspective.",
  angle_front: "Camera angle: straight-on front view.",
  angle_right: "Camera angle: 45-degree right perspective.",
  prompt_header: "Professional product photography.",
  prompt_wallMounted: "A framed artwork mounted securely on a neutral off-white or warm white plaster wall.",
  prompt_holding: "A person holding a framed artwork at chest level with both hands. Only hands and torso visible.",
  prompt_generalEnding: "Photorealistic professional photography with realistic depth of field, natural shadows, and authentic lighting.",
  prompt_holdingEnding: "High-end editorial lifestyle photography. Natural wood grain texture visible.",
  negative_default: "no white mat, no passe-partout, no border, no padding, no distorted perspective, no watermark, no logo",
  negative_holding: "no mat, no white border, no inset artwork, no distortion, no watermark, no logo",
  room_short_japanese: "Japanese room",
  room_short_nordic: "Scandinavian room",
  room_short_american: "Modern urban room",
  room_short_rustic: "Rustic room",
  "room_short_wooden-floor": "Wood floor room",
  "room_short_artist-holding": "Artist holding",
  "room_short_bedroom-with-eaves": "Rooftop bedroom",
};

/** 無 DB 時的預設提示詞 map（與 SQL seed 一致） */
export function getFallbackPromptMaps() {
  const rows: PromptTemplate[] = FALLBACK_SEED_KEYS.map((key, i) => ({
    id: i,
    key,
    type: key.split("_")[0],
    content: FALLBACK_CONTENT[key] ?? "",
    sort_order: i,
    updated_at: null,
  }));
  return buildPromptMaps(rows);
}

/** 從 DB 的 prompt_templates 組出 generateMockups 用的 map，key 前綴對應 type（如 orientation_ portrait -> orientationMap.portrait） */
export function buildPromptMaps(rows: PromptTemplate[]): {
  orientationMap: Record<string, string>;
  roomStyleMap: Record<string, string>;
  frameDescMap: Record<string, string>;
  angleDescMap: Record<string, string>;
  roomStyleShort: Record<string, string>;
  promptParts: { header: string; wallMounted: string; holding: string; generalEnding: string; holdingEnding: string };
  negativeDefault: string;
  negativeHolding: string;
} {
  const byKey: Record<string, string> = {};
  for (const r of rows) byKey[r.key] = r.content;
  const strip = (prefix: string) => (key: string) => (key.startsWith(prefix) ? key.slice(prefix.length) : key);
  const orientationMap: Record<string, string> = {};
  for (const k of ["orientation_portrait", "orientation_landscape", "orientation_square"]) {
    const v = byKey[k];
    if (v) orientationMap[strip("orientation_")(k)] = v;
  }
  const roomStyleMap: Record<string, string> = {};
  const roomKeys = ["japanese", "nordic", "american", "rustic", "wooden-floor", "artist-holding", "bedroom-with-eaves"];
  for (const r of roomKeys) {
    const v = byKey[`room_${r}`];
    if (v) roomStyleMap[r] = v;
  }
  const frameDescMap: Record<string, string> = {};
  const frameKeys = ["matte-gold", "matte-gray", "white", "brushed-silver", "matte-black", "black-walnut", "teak", "light-wood", "maple"];
  for (const f of frameKeys) {
    const v = byKey[`frame_${f}`];
    if (v) frameDescMap[f] = v;
  }
  const angleDescMap: Record<string, string> = {};
  for (const a of ["left", "front", "right"]) {
    const v = byKey[`angle_${a}`];
    if (v) angleDescMap[a] = v;
  }
  const roomStyleShort: Record<string, string> = {};
  for (const r of roomKeys) {
    const v = byKey[`room_short_${r}`];
    if (v) roomStyleShort[r] = v;
  }
  const promptParts = {
    header: byKey["prompt_header"] ?? "Professional product photography.",
    wallMounted: byKey["prompt_wallMounted"] ?? "A framed artwork mounted securely on a neutral off-white or warm white plaster wall.",
    holding: byKey["prompt_holding"] ?? "A person holding a framed artwork at chest level with both hands. Only hands and torso visible.",
    generalEnding: byKey["prompt_generalEnding"] ?? "Photorealistic professional photography with realistic depth of field, natural shadows, and authentic lighting.",
    holdingEnding: byKey["prompt_holdingEnding"] ?? "High-end editorial lifestyle photography. Natural wood grain texture visible.",
  };
  const negativeDefault = byKey["negative_default"] ?? "no white mat, no passe-partout, no border, no padding, no distorted perspective, no watermark, no logo";
  const negativeHolding = byKey["negative_holding"] ?? "no mat, no white border, no inset artwork, no distortion, no watermark, no logo";
  return {
    orientationMap,
    roomStyleMap,
    frameDescMap,
    angleDescMap,
    roomStyleShort,
    promptParts,
    negativeDefault,
    negativeHolding,
  };
}
