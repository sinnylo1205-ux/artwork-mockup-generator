-- ============================================================
-- Supabase Authentication + 管理員表
-- 在 Supabase Dashboard → SQL Editor 中執行此腳本
-- ============================================================
-- 說明：
-- 1. 啟用 Supabase Auth（Dashboard → Authentication → Providers → Email 開啟）
-- 2. 本表紀錄「登入過的用戶」與是否為管理員，僅 is_admin = true 可使用本站
-- 3. 後端會依 JWT 的 sub (auth.uid()) 查此表，無列則自動寫入一筆（is_admin = false）
-- 4. 手動將指定用戶設為管理員（在 SQL Editor 執行）：
--    UPDATE public.artwork_user_log_in SET is_admin = true WHERE email = '您的信箱';
-- ============================================================

CREATE TABLE IF NOT EXISTS public.artwork_user_log_in (
  id BIGSERIAL PRIMARY KEY,
  auth_user_id UUID NOT NULL UNIQUE,
  email TEXT,
  is_admin BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_artwork_user_log_in_auth_user_id
  ON public.artwork_user_log_in (auth_user_id);
CREATE INDEX IF NOT EXISTS idx_artwork_user_log_in_is_admin
  ON public.artwork_user_log_in (is_admin);

ALTER TABLE public.artwork_user_log_in ENABLE ROW LEVEL SECURITY;

-- 僅透過 service role 或後端 anon key + 自訂 RLS 寫入；此處允許已登入用戶讀取自己的列
DROP POLICY IF EXISTS "Users can read own row" ON public.artwork_user_log_in;
CREATE POLICY "Users can read own row"
  ON public.artwork_user_log_in FOR SELECT
  TO authenticated
  USING (auth.uid() = auth_user_id);

-- 插入/更新由後端以 service role 或 RPC 處理（見下方註解）
-- 若後端用 anon key，需允許 anon 插入（僅限於 upsert 自己的 auth_user_id），或改用 Edge Function / service_role
DROP POLICY IF EXISTS "Allow insert for new users" ON public.artwork_user_log_in;
CREATE POLICY "Allow insert for new users"
  ON public.artwork_user_log_in FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = auth_user_id);

DROP POLICY IF EXISTS "Allow update own row" ON public.artwork_user_log_in;
CREATE POLICY "Allow update own row"
  ON public.artwork_user_log_in FOR UPDATE
  TO authenticated
  USING (auth.uid() = auth_user_id)
  WITH CHECK (auth.uid() = auth_user_id);

-- 管理員欄位建議只由 Dashboard 或 service_role 修改，RLS 上不開放一般用戶改 is_admin
-- 若需由後端 API 改，可做 admin-only procedure 並用 service_role 呼叫

-- auth_user_id 對應 Supabase Auth 的 auth.users(id)，請勿手動改為其他值
COMMENT ON TABLE public.artwork_user_log_in IS '登入用戶與管理員名單，僅 is_admin = true 可使用藝術作品模擬圖網站';
