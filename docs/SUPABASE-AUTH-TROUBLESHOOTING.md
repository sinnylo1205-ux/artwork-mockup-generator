# Supabase 登入／註冊常見問題

## 404 Not Found

若瀏覽器出現 `Failed to load resource: 404`：

1. **打開開發者工具 → Network**，看是哪一個網址回傳 404。
2. 常見情況：
   - **`/favicon.ico`**：站台沒有放 favicon，可忽略，或在 `client/public` 放一個 `favicon.ico`。
   - **`/api/trpc/...`**：代表還有程式在呼叫舊的 Node 後端；目前前端已改為只連 Supabase，不應再出現。若仍出現，請檢查是否有擴充套件或快取載入舊版頁面。

---

## 註冊後沒收到驗證信

Supabase 預設會開啟 **「須驗證信箱」**：註冊後會寄驗證信，用戶點連結後帳號才會啟用。若信沒寄出或收不到，可以這樣處理：

### 做法一：關閉「須驗證信箱」（建議用於僅管理員使用的站台）

1. 登入 **Supabase Dashboard** → 選專案。
2. 左側 **Authentication** → **Providers** → 點 **Email**。
3. 找到 **Confirm email**，關閉（Disable）。
4. 儲存。

之後註冊會直接建立已啟用帳號，不會寄驗證信。你再到 SQL Editor 執行：

```sql
UPDATE public.artwork_user_log_in SET is_admin = true WHERE email = '新註冊的信箱';
```

該用戶即可登入使用。

### 做法二：保留驗證信，但確保信寄得出去

1. **檢查垃圾信匣**：驗證信有時會被歸類為垃圾信。
2. **自訂 SMTP（建議正式環境使用）**：  
   Dashboard → **Project Settings** → **Auth** → **SMTP Settings**，設定自己的 SMTP（例如 Gmail、SendGrid），Supabase 會用這個寄出驗證信與重設密碼信。
3. **免費專案限制**：Supabase 免費方案內建寄信有數量與頻率限制，信可能延遲或失敗，正式使用建議開自訂 SMTP。

---

## 已關閉 Confirm email 卻仍顯示「已送出驗證信」

若你已在 Dashboard 關閉 **Confirm email**，註冊後理應會直接有 `session`，前端會導向首頁或顯示「註冊成功，但尚未被設為管理員」。  
若畫面上仍寫「已送出驗證信」，請重新整理頁面並再註冊一次，確認 Supabase 專案設定已儲存且生效。
