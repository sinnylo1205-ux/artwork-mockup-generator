-- ============================================================
-- 改用 user_roles 後：generated_artwork_images 改以 auth_user_id 歸檔
-- 在 Supabase Dashboard → SQL Editor 執行
-- ============================================================
-- 前提：user_roles 表需允許已登入用戶讀取自己的列，例如：
--   CREATE POLICY "Users read own role" ON user_roles FOR SELECT TO authenticated USING (user_id = auth.uid());
--
-- 1. 新增 auth_user_id（uuid），之後歸檔與新寫入都用此欄位
-- 2. 若有舊資料來自 artwork_user_log_in，可手動 backfill（見下方註解）
-- 3. 執行完可刪除 artwork_user_log_in 表：DROP TABLE IF EXISTS public.artwork_user_log_in;
-- ============================================================

ALTER TABLE public.generated_artwork_images
  ADD COLUMN IF NOT EXISTS auth_user_id UUID;

CREATE INDEX IF NOT EXISTS idx_generated_artwork_images_auth_user_id
  ON public.generated_artwork_images (auth_user_id);

-- 選填：若有舊資料且仍有 artwork_user_log_in，可執行一次 backfill
-- UPDATE public.generated_artwork_images g
-- SET auth_user_id = u.auth_user_id
-- FROM public.artwork_user_log_in u WHERE g.user_id = u.id AND g.auth_user_id IS NULL;

COMMENT ON COLUMN public.generated_artwork_images.auth_user_id IS 'Supabase Auth 用戶 uuid，用於歸檔篩選（與 user_roles.user_id 對應）';
