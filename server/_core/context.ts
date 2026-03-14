/** 後端辨識的登入用戶（來自 Supabase Auth + artwork_user_log_in），僅 is_admin 可存取本站 */
export type AppUser = {
  id: number;
  email: string | null;
  isAdmin: boolean;
};

export type TrpcContext = {
  user: AppUser | null;
  req: { protocol: string; headers: Record<string, string | string[] | undefined> };
  res: { clearCookie: (name: string, options?: Record<string, unknown>) => void };
};
