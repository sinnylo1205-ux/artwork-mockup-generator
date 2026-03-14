-- ============================================================
-- 藝術作品生成任務表（取代 Node 後端的 MySQL/記憶體）
-- 在 Supabase Dashboard → SQL Editor 執行
-- ============================================================
-- 使用 auth_user_id (uuid) 對應 auth.uid()，RLS 可限制僅本人讀寫
-- generated_artwork_images 的 user_id 為 artwork_user_log_in.id，由 Edge Function 查詢後寫入
-- ============================================================

CREATE TABLE IF NOT EXISTS public.artwork_generations (
  id BIGSERIAL PRIMARY KEY,
  auth_user_id UUID NOT NULL,
  original_image_url TEXT NOT NULL,
  original_image_key TEXT NOT NULL,
  orientation TEXT NOT NULL CHECK (orientation IN ('portrait', 'landscape', 'square')),
  frame_color TEXT NOT NULL,
  room_style TEXT NOT NULL CHECK (room_style IN (
    'japanese', 'nordic', 'american', 'rustic', 'wooden-floor',
    'artist-holding', 'bedroom-with-eaves'
  )),
  left_angle_image_url TEXT,
  left_angle_image_key TEXT,
  front_image_url TEXT,
  front_image_key TEXT,
  right_angle_image_url TEXT,
  right_angle_image_key TEXT,
  status TEXT NOT NULL DEFAULT 'processing' CHECK (status IN ('processing', 'completed', 'failed')),
  error_message TEXT,
  batch_id TEXT,
  image_generation_core TEXT NOT NULL DEFAULT 'replicate' CHECK (image_generation_core IN ('openai', 'replicate')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_artwork_generations_auth_user_id
  ON public.artwork_generations (auth_user_id);
CREATE INDEX IF NOT EXISTS idx_artwork_generations_created_at
  ON public.artwork_generations (created_at DESC);

ALTER TABLE public.artwork_generations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own generations" ON public.artwork_generations;
CREATE POLICY "Users can read own generations"
  ON public.artwork_generations FOR SELECT
  TO authenticated
  USING (auth.uid() = auth_user_id);

DROP POLICY IF EXISTS "Users can insert own generations" ON public.artwork_generations;
CREATE POLICY "Users can insert own generations"
  ON public.artwork_generations FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = auth_user_id);

DROP POLICY IF EXISTS "Users can update own generations" ON public.artwork_generations;
CREATE POLICY "Users can update own generations"
  ON public.artwork_generations FOR UPDATE
  TO authenticated
  USING (auth.uid() = auth_user_id)
  WITH CHECK (auth.uid() = auth_user_id);

DROP POLICY IF EXISTS "Users can delete own generations" ON public.artwork_generations;
CREATE POLICY "Users can delete own generations"
  ON public.artwork_generations FOR DELETE
  TO authenticated
  USING (auth.uid() = auth_user_id);

COMMENT ON TABLE public.artwork_generations IS '藝術作品模擬圖生成任務，取代原 Node 後端 DB';
