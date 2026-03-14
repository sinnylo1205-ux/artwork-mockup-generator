# Supabase 客製化密碼／驗證信範本

在 **Supabase Dashboard → Authentication → Email Templates** 可修改「確認註冊」與「重設密碼」信件的主旨與內容。

## 可用變數（Go template 語法）

| 變數 | 說明 |
|------|------|
| `{{ .ConfirmationURL }}` | 完整確認連結（含 token），用於註冊驗證或重設密碼 |
| `{{ .Token }}` | 6 碼 OTP（若使用 OTP 流程） |
| `{{ .TokenHash }}` | Token 雜湊，可自組 URL |
| `{{ .SiteURL }}` | 專案設定的 Site URL |
| `{{ .RedirectTo }}` | 登入／註冊時傳入的 redirect 網址 |
| `{{ .Email }}` | 使用者信箱 |
| `{{ .Data }}` | 自訂 metadata |

---

## 1. 確認註冊信（Confirm signup）

**位置**：Authentication → Email Templates → **Confirm signup**

### 主旨範例
```
請確認您的信箱 - 藝術作品模擬圖網站
```

### 內容範例（HTML）
```html
<h2>歡迎使用藝術作品模擬圖網站</h2>
<p>您好，</p>
<p>請點擊下方連結完成信箱驗證：</p>
<p><a href="{{ .ConfirmationURL }}">確認我的信箱</a></p>
<p>若您未註冊此服務，請忽略此信。</p>
<p>此連結有效期限有限，請儘速點擊。</p>
<hr>
<p style="color:#888;font-size:12px;">藝術作品模擬圖網站</p>
```

---

## 2. 重設密碼信（Reset password）

**位置**：Authentication → Email Templates → **Reset password**

### 主旨範例
```
重設密碼 - 藝術作品模擬圖網站
```

### 內容範例（HTML）
```html
<h2>重設密碼</h2>
<p>您好 {{ .Email }}，</p>
<p>我們收到重設密碼的請求，請點擊下方連結設定新密碼：</p>
<p><a href="{{ .ConfirmationURL }}">重設密碼</a></p>
<p>若您沒有申請重設密碼，請忽略此信，您的密碼不會被變更。</p>
<p>此連結有效期限有限，請儘速使用。</p>
<hr>
<p style="color:#888;font-size:12px;">藝術作品模擬圖網站</p>
```

---

## 注意事項

1. **Site URL**：在 Authentication → URL Configuration 設定 **Site URL**（例如 `https://your-domain.com`），確認信與重設密碼信中的 `{{ .ConfirmationURL }}` 會導回此網域。
2. **Redirect**：重設密碼完成後可導向登入頁，在程式端呼叫 `resetPasswordForEmail` 時可傳入 `redirectTo: 'https://your-domain.com/login'`。
3. 修改範本後直接儲存即可，無需重新部署。
