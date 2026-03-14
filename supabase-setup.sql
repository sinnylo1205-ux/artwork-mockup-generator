-- ============================================================
-- 在 Supabase Dashboard → SQL Editor 中貼上並執行此腳本
-- 用於：建立存圖用 bucket、存放生成圖連結的 table
-- ============================================================

-- 1) 建立 Storage Bucket（若已有同名 bucket 可跳過或改名稱）
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'artwork-mockups',
  'artwork-mockups',
  true,
  52428800,
  ARRAY['image/png', 'image/jpeg', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- 2) 允許匿名上傳與讀取（方便後端用 anon key 上傳、前端直接顯示圖）
DROP POLICY IF EXISTS "Public read artwork-mockups" ON storage.objects;
CREATE POLICY "Public read artwork-mockups"
ON storage.objects FOR SELECT
USING (bucket_id = 'artwork-mockups');

DROP POLICY IF EXISTS "Anon upload artwork-mockups" ON storage.objects;
CREATE POLICY "Anon upload artwork-mockups"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'artwork-mockups');

-- 3) 建立「生成圖與連結」的 table（在 public schema）
CREATE TABLE IF NOT EXISTS public.generated_artwork_images (
  id BIGSERIAL PRIMARY KEY,
  artwork_generation_id INT NOT NULL,
  user_id INT,
  storage_path TEXT NOT NULL,
  public_url TEXT NOT NULL,
  angle VARCHAR(20) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 索引：依 generation、用戶、時間查詢
CREATE INDEX IF NOT EXISTS idx_generated_artwork_images_generation_id
  ON public.generated_artwork_images (artwork_generation_id);
CREATE INDEX IF NOT EXISTS idx_generated_artwork_images_user_id
  ON public.generated_artwork_images (user_id);
CREATE INDEX IF NOT EXISTS idx_generated_artwork_images_created_at
  ON public.generated_artwork_images (created_at DESC);

-- 暫時允許所有人讀寫（之後可改為僅管理員可寫）
ALTER TABLE public.generated_artwork_images ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all read" ON public.generated_artwork_images;
CREATE POLICY "Allow all read"
ON public.generated_artwork_images FOR SELECT TO public USING (true);

DROP POLICY IF EXISTS "Allow all insert" ON public.generated_artwork_images;
CREATE POLICY "Allow all insert"
ON public.generated_artwork_images FOR INSERT TO public WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all update" ON public.generated_artwork_images;
CREATE POLICY "Allow all update"
ON public.generated_artwork_images FOR UPDATE TO public USING (true) WITH CHECK (true);


-- ============================================================
-- 4) 提示詞模板表（可管理、渲染到前端讓用戶修改）
-- ============================================================
CREATE TABLE IF NOT EXISTS public.prompt_templates (
  id BIGSERIAL PRIMARY KEY,
  key TEXT NOT NULL UNIQUE,
  type TEXT NOT NULL,
  content TEXT NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_prompt_templates_type ON public.prompt_templates (type);
CREATE INDEX IF NOT EXISTS idx_prompt_templates_sort ON public.prompt_templates (sort_order);

ALTER TABLE public.prompt_templates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all read prompts" ON public.prompt_templates;
CREATE POLICY "Allow all read prompts" ON public.prompt_templates FOR SELECT TO public USING (true);
DROP POLICY IF EXISTS "Allow all write prompts" ON public.prompt_templates;
CREATE POLICY "Allow all write prompts" ON public.prompt_templates FOR ALL TO public USING (true) WITH CHECK (true);

-- 預設 seed（與 server 原本的 orientationMap / roomStyleMap / frameDescMap / angleDescMap / promptParts / negative 對應）
INSERT INTO public.prompt_templates (key, type, content, sort_order) VALUES
  ('orientation_portrait', 'orientation', 'Artwork orientation: vertical (50x70cm)', 1),
  ('orientation_landscape', 'orientation', 'Artwork orientation: horizontal (70x50cm)', 2),
  ('orientation_square', 'orientation', 'Artwork orientation: square (50x50cm)', 3),
  ('room_japanese', 'room', 'Minimalist Japanese interior with tatami mats, natural wood textures, and soft ambient daylight. Calm and quiet atmosphere.', 10),
  ('room_nordic', 'room', 'Scandinavian interior with light wood flooring, large windows, and soft natural daylight. Minimal styling. Airy and bright space.', 11),
  ('room_american', 'room', 'Modern American living room with contemporary furniture and neutral tones. Hardwood flooring and subtle sophisticated lighting.', 12),
  ('room_rustic', 'room', 'Rustic country interior with exposed wooden beams and warm cozy lighting. Natural textures and earthy tones.', 13),
  ('room_wooden-floor', 'room', 'A framed artwork mounted securely on a neutral off-white or warm white plaster wall in a photorealistic interior photography scene with calm minimalist aesthetic. Dark natural teak wood flooring. Soft natural daylight from the right.', 14),
  ('room_artist-holding', 'room', 'Photorealistic lifestyle product photography. A person holding a framed artwork at chest level with both hands. Only hands and torso visible. Artwork fills the frame edge-to-edge.', 15),
  ('room_bedroom-with-eaves', 'room', 'Photorealistic interior wall art photography. Minimalist Japanese-style bedroom. Framed artwork mounted on beige plaster wall above wooden headboard.', 16),
  ('frame_matte-gold', 'frame', 'Frame style: matte bronze-gold aluminum frame, slim modern profile.', 20),
  ('frame_matte-gray', 'frame', 'Frame style: brushed gray aluminum frame with subtle blue tint, slim modern profile.', 21),
  ('frame_white', 'frame', 'Frame style: white aluminum frame, slim modern profile.', 22),
  ('frame_brushed-silver', 'frame', 'Frame style: brushed silver aluminum frame, slim modern profile.', 23),
  ('frame_matte-black', 'frame', 'Frame style: brushed black aluminum frame, slim modern profile.', 24),
  ('frame_black-walnut', 'frame', 'Frame style: black walnut solid wood frame with slim modern profile.', 25),
  ('frame_teak', 'frame', 'Frame style: teak wood frame, slim modern profile.', 26),
  ('frame_light-wood', 'frame', 'Frame style: light natural wood frame, slim modern profile.', 27),
  ('frame_maple', 'frame', 'Frame style: maple wood frame, slim modern profile.', 28),
  ('angle_left', 'angle', 'Camera angle: 45-degree left perspective.', 30),
  ('angle_front', 'angle', 'Camera angle: straight-on front view.', 31),
  ('angle_right', 'angle', 'Camera angle: 45-degree right perspective.', 32),
  ('prompt_header', 'prompt_part', 'Professional product photography.', 40),
  ('prompt_wallMounted', 'prompt_part', 'A framed artwork mounted securely on a neutral off-white or warm white plaster wall.', 41),
  ('prompt_holding', 'prompt_part', 'A person holding a framed artwork at chest level with both hands. Only hands and torso visible.', 42),
  ('prompt_generalEnding', 'prompt_part', 'Photorealistic professional photography with realistic depth of field, natural shadows, and authentic lighting.', 43),
  ('prompt_holdingEnding', 'prompt_part', 'High-end editorial lifestyle photography. Natural wood grain texture visible.', 44),
  ('negative_default', 'negative', 'no white mat, no passe-partout, no border, no padding, no distorted perspective, no watermark, no logo', 50),
  ('negative_holding', 'negative', 'no mat, no white border, no inset artwork, no distortion, no watermark, no logo', 51),
  ('room_short_japanese', 'room_short', 'Japanese room', 60),
  ('room_short_nordic', 'room_short', 'Scandinavian room', 61),
  ('room_short_american', 'room_short', 'Modern urban room', 62),
  ('room_short_rustic', 'room_short', 'Rustic room', 63),
  ('room_short_wooden-floor', 'room_short', 'Wood floor room', 64),
  ('room_short_artist-holding', 'room_short', 'Artist holding', 65),
  ('room_short_bedroom-with-eaves', 'room_short', 'Rooftop bedroom', 66)
ON CONFLICT (key) DO NOTHING;
