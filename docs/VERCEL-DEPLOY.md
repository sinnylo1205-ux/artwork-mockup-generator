# 部署到 Vercel（僅前端，後端由 Supabase 全面接管）

## 步驟

1. **環境變數**：在 Vercel 專案 → Settings → Environment Variables 新增：
   - `VITE_SUPABASE_URL`：Supabase 專案 URL
   - `VITE_SUPABASE_ANON_KEY`：Supabase anon key
   - `VITE_GENERATE_MOCKUPS_URL`：生圖 Edge Function URL（例如 `https://xxx.supabase.co/functions/v1/generate-mockups`）

2. **建置**：Vercel 會執行 `npm run build`，輸出在 `dist/public`（見 `vercel.json`）。

3. **SPA 路由**：`vercel.json` 已設定 rewrites，所有路徑會導向 `index.html`，由前端 wouter 處理路由。

4. **不需 Node 後端**：不再執行 `npm run dev:server`；登入、生圖、歷史、歸檔、提示詞皆由 Supabase（Auth、DB、Storage、Edge Function）提供。

## Storage 上傳若失敗

若前端上傳原圖到 Supabase Storage 時出現 403，請在 Supabase Dashboard → Storage → artwork-mockups → Policies 新增：

- **Insert**：`authenticated` 角色可 INSERT，`bucket_id = 'artwork-mockups'`。

現有「Anon upload」僅允許匿名；登入用戶會以 `authenticated` 身分上傳，需另開此政策。
