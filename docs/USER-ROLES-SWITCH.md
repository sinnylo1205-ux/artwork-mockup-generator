# 改用 user_roles、移除 artwork_user_log_in

本站與另一網站共用同一 Supabase 專案，改為只使用 **user_roles** 表判斷權限，不再使用 **artwork_user_log_in**。

## 你需要在 Supabase 做的事

### 1. 執行 migration SQL

在 **SQL Editor** 執行專案裡的 **`supabase-migrate-user-roles.sql`**，會：

- 在 `generated_artwork_images` 新增欄位 `auth_user_id`（uuid）
- 之後歸檔與新寫入都依 `auth_user_id` 篩選

### 2. 確認 user_roles 可被前端讀取

前端會查 `user_roles` 的 `role`，條件是 `user_id = auth.uid()`。  
若尚未有對應 RLS，可加一條：

```sql
-- 已登入用戶只能讀自己的那一列
CREATE POLICY "Users read own role"
  ON public.user_roles FOR SELECT TO authenticated
  USING (user_id = auth.uid());
```

### 3. 舊資料 backfill（選填）

若 `generated_artwork_images` 裡已有用 `user_id`（對應舊的 artwork_user_log_in.id）的資料，且仍保留 `artwork_user_log_in` 表，可執行一次：

```sql
UPDATE public.generated_artwork_images g
SET auth_user_id = u.auth_user_id
FROM public.artwork_user_log_in u
WHERE g.user_id = u.id AND g.auth_user_id IS NULL;
```

之後歸檔會依 `auth_user_id` 顯示。

### 4. 刪除 artwork_user_log_in（選填）

確定不再使用後可刪除：

```sql
DROP TABLE IF EXISTS public.artwork_user_log_in;
```

### 5. 藝術站「管理員」對應方式

- 能使用本站的條件：`user_roles.role = 'admin'`
- 註冊後若寫入的是 `user_roles`（例如另一站的 trigger），只要把該使用者的 `role` 設為 `admin`，即可登入本站
- 在 Table Editor 或 SQL 執行：  
  `UPDATE public.user_roles SET role = 'admin' WHERE user_id = '該使用者的 auth uuid';`

### 6. 重新部署 Edge Function

程式已改為檢查 `user_roles` 而非 `artwork_user_log_in`，請重新部署：

```bash
supabase functions deploy generate-mockups
```

---

## 程式變更摘要

- **AuthContext**：改查 `user_roles`，只接受 `role = 'admin'`；不再查、不寫入 `artwork_user_log_in`
- **歸檔**：改依 `generated_artwork_images.auth_user_id`（uuid）
- **Edge Function**：改為檢查 `user_roles.role = 'admin'`；之後寫入 `generated_artwork_images` 時請用 `auth_user_id = user.id`（uuid）
