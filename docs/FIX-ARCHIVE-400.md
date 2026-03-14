# 修復「月度歸檔」400 Bad Request

## 原因

前端查詢 `generated_artwork_images` 時使用篩選條件 `auth_user_id=eq.<uuid>`。  
若資料表沒有 `auth_user_id` 欄位（尚未執行過 migration），PostgREST 會回傳 **400 Bad Request**，導致歷史紀錄有照片但「月度歸檔」失敗。

## 作法

在 **Supabase Dashboard → SQL Editor** 貼上並執行下方 SQL（與 `supabase-migrate-user-roles.sql` 相同）：

```sql
-- 新增 auth_user_id（若已存在會略過）
ALTER TABLE public.generated_artwork_images
  ADD COLUMN IF NOT EXISTS auth_user_id UUID;

CREATE INDEX IF NOT EXISTS idx_generated_artwork_images_auth_user_id
  ON public.generated_artwork_images (auth_user_id);
```

執行後重新整理前端的「歷史紀錄／月度歸檔」頁面，應可正常顯示。

## 若已有舊資料

Edge Function 新寫入的列會帶 `auth_user_id`。若表裡有舊資料（來自先前系統）且沒有 `auth_user_id`，歸檔只會顯示新資料。若要讓舊資料也依使用者歸檔，需自行 backfill 對應的 `auth_user_id`（例如從 `artwork_generations.auth_user_id` 反查後更新）。

## RLS 選用

- 若 **RLS 已關閉**：上述欄位加上後，查詢即可通過。
- 若 **RLS 已開啟** 且要有「只讀自己的圖」：可加一條 SELECT 政策，例如  
  `USING (auth.uid() = auth_user_id)`，並套用在 `authenticated` 角色。
