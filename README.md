# 藝術作品模擬圖生成

上傳藝術作品圖片，選擇畫框與房間風格，由 AI 生成室內情境模擬圖（Mockup）。

## 本機預覽

1. **安裝依賴**
   ```bash
   npm install
   ```

2. **啟動後端 API（一個終端）**
   ```bash
   npm run dev:server
   ```
   會啟動 tRPC 於 `http://localhost:5000`。本機無資料庫時會使用假用戶，可直接操作前端。

3. **啟動前端（另一個終端）**
   ```bash
   npm run dev
   ```
   會啟動 Vite 於 `http://localhost:3000`，並將 `/api` 代理到後端。

4. 瀏覽 **http://localhost:3000** 即可使用。

## 環境變數（選填）

- `DATABASE_URL`：MySQL 連線字串（無則本機用假用戶、假資料）
- `PORT`：後端埠號，預設 5000
- `VITE_APP_ID` / `JWT_SECRET` / `OAUTH_SERVER_URL` / `OWNER_OPEN_ID`：Manus 登入相關（部署時設定）
- `REPLICATE_API_TOKEN`：Replicate API Token（建議，使用提示詞管理，見下方申請教學）
- `OPENAI_API_KEY`：OpenAI API Key（選 OpenAI DALL-E 時需要）
- `VITE_API_URL`：前端要請求的 API 根網址（本機可不設，會用同源 + Vite 代理）
- `VITE_LOGIN_URL`：登入頁網址（本機可不設）

## 專案結構

- `client/`：Vite + React 前端（`client/src` 為來源）
- `server/`：tRPC 後端（routers、db、storage、生圖邏輯）
- `shared/`：前後端共用常數等

## 生圖流程

- 使用者上傳作品圖 → 選擇方向、畫框、房間風格、視角、生圖核心（Replicate Flux / OpenAI DALL-E）
- **Replicate Flux**（預設）：使用提示詞管理，高品質，需設定 Supabase 與 REPLICATE_API_TOKEN
- **OpenAI DALL-E**：使用簡化 prompt，需設定 OPENAI_API_KEY
- 結果存至 Supabase Storage（或本地 `server/uploads/`）

## Replicate API Key 申請教學

1. 前往 [https://replicate.com](https://replicate.com) 註冊帳號（可用 GitHub 登入）
2. 登入後點右上角頭像 → **API tokens**
3. 或直接開啟 [https://replicate.com/account/api-tokens](https://replicate.com/account/api-tokens)
4. 點 **Create token**，輸入名稱（例如 `artwork-mockup`）
5. 複製產生的 token（格式為 `r8_` 開頭，約 40 字元）
6. 在專案根目錄的 `.env` 新增：
   ```
   REPLICATE_API_TOKEN=r8_你的token
   ```
7. 重啟後端（`npm run dev:server`）即可使用 Replicate Flux 生圖

**費用**：Replicate 按次計費，Flux img2img 約 $0.012/張，有免費額度可測試。

## 備註

- **登入**：目前登入已拔掉，所有人以假用戶操作；上線部署時可改接 **Supabase Authentication**，並在 `server/index.ts` 的 `createContext` 從 Supabase session 解析 `ctx.user`。
- 若從 Manus 平台還原，可將 `vite-plugin-manus-runtime-stub.js` 換成正式套件 `vite-plugin-manus-runtime`。
- 本機未設定生圖 API 時，上傳與建立記錄會成功，但背景生圖會失敗，可於歷史記錄看到失敗狀態。
