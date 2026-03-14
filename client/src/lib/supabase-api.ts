/**
 * 前端直連 Supabase API（取代 Node tRPC），可單獨部署於 Vercel
 */
import { getGenerateMockupsUrl } from "@/const";
import { getSupabase } from "@/lib/supabase";

const BUCKET = "artwork-mockups";

/** DB 欄位 snake_case → 前端使用的 camelCase */
function mapGenerationRow(row: Record<string, unknown>) {
  return {
    id: row.id as number,
    userId: 0,
    batchId: (row.batch_id as string) ?? null,
    orientation: row.orientation as string,
    frameColor: row.frame_color as string,
    roomStyle: row.room_style as string,
    originalImageUrl: row.original_image_url as string,
    originalImageKey: row.original_image_key as string,
    leftAngleImageUrl: (row.left_angle_image_url as string) ?? null,
    leftAngleImageKey: (row.left_angle_image_key as string) ?? null,
    frontImageUrl: (row.front_image_url as string) ?? null,
    frontImageKey: (row.front_image_key as string) ?? null,
    rightAngleImageUrl: (row.right_angle_image_url as string) ?? null,
    rightAngleImageKey: (row.right_angle_image_key as string) ?? null,
    status: (row.status as string) ?? "processing",
    errorMessage: (row.error_message as string) ?? null,
    imageGenerationCore: (row.image_generation_core as string) ?? "replicate",
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

export type Generation = ReturnType<typeof mapGenerationRow>;

/** 上傳原圖到 Supabase Storage */
export async function uploadOriginalImage(
  authUserId: string,
  imageData: string,
  mimeType: string
): Promise<{ url: string; key: string; base64Data: string }> {
  const supabase = getSupabase();
  if (!supabase) throw new Error("Supabase 未設定");
  const base64Data = imageData.replace(/^data:image\/\w+;base64,/, "");
  const ext = mimeType.split("/")[1] || "png";
  const path = `artwork-originals/${authUserId}/${Date.now()}-${Math.random().toString(36).slice(2, 9)}.${ext}`;
  const blob = Uint8Array.from(atob(base64Data), (c) => c.charCodeAt(0));
  const { error } = await supabase.storage.from(BUCKET).upload(path, blob, {
    contentType: mimeType,
    upsert: true,
  });
  if (error) throw new Error(error.message);
  const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return { url: urlData.publicUrl, key: path, base64Data: imageData };
}

/** 呼叫 Edge Function 開始生圖 */
export async function callGenerateMockups(
  accessToken: string,
  params: {
    originalImageUrl: string;
    originalImageKey: string;
    originalImageBase64: string;
    orientation: string;
    frameColor: string;
    roomStyle: string;
    viewAngles: string[];
    imageGenerationCore: string;
    batchId?: string;
  }
): Promise<{ generationId: number }> {
  const url = getGenerateMockupsUrl();
  if (!url) throw new Error("未設定 VITE_GENERATE_MOCKUPS_URL");
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
  if (!anonKey) throw new Error("未設定 VITE_SUPABASE_ANON_KEY");
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
      apikey: anonKey,
    },
    body: JSON.stringify({
      originalImageUrl: params.originalImageUrl,
      originalImageKey: params.originalImageKey,
      originalImageBase64: params.originalImageBase64,
      orientation: params.orientation,
      frameColor: params.frameColor,
      roomStyle: params.roomStyle,
      viewAngles: params.viewAngles,
      imageGenerationCore: params.imageGenerationCore,
      batchId: params.batchId,
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string }).error || `HTTP ${res.status}`);
  return { generationId: (data as { generationId: number }).generationId };
}

/** 列出當前用戶的生成任務（Supabase artwork_generations） */
export async function listGenerations(authUserId: string): Promise<Generation[]> {
  const supabase = getSupabase();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("artwork_generations")
    .select("*")
    .eq("auth_user_id", authUserId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => mapGenerationRow(row as Record<string, unknown>));
}

/** 刪除一筆生成任務 */
export async function deleteGeneration(authUserId: string, id: number): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) throw new Error("Supabase 未設定");
  const { error } = await supabase
    .from("artwork_generations")
    .delete()
    .eq("id", id)
    .eq("auth_user_id", authUserId);
  if (error) throw new Error(error.message);
}

/** 依月份歸檔（generated_artwork_images，依 auth_user_id） */
export async function getArchiveByMonth(authUserId: string): Promise<{ monthKey: string; images: { id: number; artwork_generation_id: number; public_url: string; angle: string; created_at: string }[] }[]> {
  const supabase = getSupabase();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("generated_artwork_images")
    .select("id, artwork_generation_id, public_url, angle, created_at")
    .eq("auth_user_id", authUserId)
    .order("created_at", { ascending: false });
  if (error) return [];
  const rows = data ?? [];
  const byMonth = new Map<string, typeof rows>();
  for (const r of rows) {
    const d = r.created_at ? new Date(r.created_at) : new Date();
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    if (!byMonth.has(key)) byMonth.set(key, []);
    byMonth.get(key)!.push(r);
  }
  return Array.from(byMonth.entries())
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([monthKey, images]) => ({ monthKey, images }));
}

export type PromptTemplate = { id: number; key: string; type: string; content: string; sort_order: number; updated_at: string | null };

/** 提示詞列表 */
export async function getPromptTemplates(): Promise<PromptTemplate[]> {
  const supabase = getSupabase();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("prompt_templates")
    .select("id, key, type, content, sort_order, updated_at")
    .order("sort_order");
  if (error) return [];
  return (data ?? []) as PromptTemplate[];
}

/** 更新一筆提示詞 */
export async function updatePromptTemplate(key: string, content: string): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) throw new Error("Supabase 未設定");
  const { error } = await supabase
    .from("prompt_templates")
    .update({ content, updated_at: new Date().toISOString() })
    .eq("key", key);
  if (error) throw new Error(error.message);
}
