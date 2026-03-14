/** 登入頁路徑（Supabase Auth） */
export function getLoginUrl(): string {
  return import.meta.env.VITE_LOGIN_URL || "/login";
}

/** 生圖 Edge Function URL（改接 Supabase 時使用） */
export function getGenerateMockupsUrl(): string {
  return import.meta.env.VITE_GENERATE_MOCKUPS_URL || "";
}
