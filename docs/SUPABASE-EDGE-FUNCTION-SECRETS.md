# Supabase Edge Function 需手動設定的 Secrets

Edge Function **generate-mockups** 會用到以下環境變數。  
專案內建的 `SUPABASE_URL`、`SUPABASE_ANON_KEY` 不必手動設；其餘請在 **Supabase Dashboard → Edge Functions → 該函數 → Secrets**（或用 CLI `supabase secrets set`）設定。

| Secret 名稱 | 必填 | 說明 |
|-------------|------|------|
| **REPLICATE_API_TOKEN** | 是（若用 Replicate 生圖） | Replicate 後台產生的 API token，用於呼叫 Flux 等模型。 |
| **OPENAI_API_KEY** | 否（僅 DALL·E 時需要） | OpenAI API key，若使用 DALL·E 生圖才要設。 |
| **SUPABASE_SERVICE_ROLE_KEY** | 否（骨架可先不設） | 專案已有即可；若之後在 Function 內用 service role 更新 DB/Storage 再設。 |

## 設定方式

1. **Dashboard**：專案 → **Edge Functions** → 選 **generate-mockups** → **Secrets** → 新增上述 key。
2. **CLI**：在專案根目錄執行  
   `supabase secrets set REPLICATE_API_TOKEN=你的token`  
   （以及 `OPENAI_API_KEY`、`SUPABASE_SERVICE_ROLE_KEY` 若需要。）

完成後，前端呼叫此 Edge Function 時會通過驗證並寫入 `artwork_generations`；實際生圖邏輯可在 Function 內接上 Replicate/OpenAI 並使用上述 secrets。

---

## 已部署的 Function URL

```
https://xscxpvxhebpanykswosi.supabase.co/functions/v1/generate-mockups
```

前端呼叫時請帶上登入後的 JWT：

```ts
const url = import.meta.env.VITE_GENERATE_MOCKUPS_URL;
const { data: { session } } = await supabase.auth.getSession();
const res = await fetch(url, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Authorization: `Bearer ${session?.access_token ?? ""}`,
  },
  body: JSON.stringify({
    originalImageUrl,
    originalImageKey,
    originalImageBase64, // 選填，OpenAI 時需要
    orientation: "portrait" | "landscape" | "square",
    frameColor: "matte-gold" | "matte-gray" | ...,
    roomStyle: "japanese" | "nordic" | ...,
    viewAngles: ["left", "front", "right"],
    imageGenerationCore: "replicate" | "openai",
    batchId: "...", // 選填
  }),
});
const data = await res.json(); // { generationId } 或 { error }
```
