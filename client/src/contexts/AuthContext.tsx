import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { getSupabase } from "@/lib/supabase";

/** 登入用戶或匿名訪客（匿名時 isAnonymous 為 true，仍有穩定的 authUserId 供歷史與生圖） */
export type AppUser = {
  authUserId: string;
  email: string | null;
  isAdmin: boolean;
  /** Supabase 匿名登入產生的訪客身分 */
  isAnonymous?: boolean;
};

type AuthContextValue = {
  user: AppUser | null;
  loading: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const refresh = useCallback(async (): Promise<AppUser | null> => {
    const supabase = getSupabase();
    if (!supabase) {
      setUser(null);
      setLoading(false);
      return null;
    }
    setLoading(true);
    setError(null);
    try {
      let { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        const { error: anonErr } = await supabase.auth.signInAnonymously();
        if (anonErr) {
          console.warn("[Auth] signInAnonymously:", anonErr.message);
        }
        ({ data: { session } } = await supabase.auth.getSession());
      }
      if (!session?.user) {
        setUser(null);
        return null;
      }
      const uid = session.user.id;
      const { data: row } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", uid)
        .maybeSingle();
      const isAdmin = row?.role === "admin";
      const isAnonymous =
        (session.user as { is_anonymous?: boolean }).is_anonymous === true ||
        session.user.app_metadata?.provider === "anonymous";
      const appUser: AppUser = {
        authUserId: uid,
        email: session.user.email ?? null,
        isAdmin,
        isAnonymous,
      };
      setUser(appUser);
      return appUser;
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
      setUser(null);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    await getSupabase()?.auth.signOut();
    setUser(null);
  }, []);

  useEffect(() => {
    refresh();
    const supabase = getSupabase();
    if (!supabase) return;
    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      refresh();
    });
    return () => subscription.unsubscribe();
  }, [refresh]);

  const value = useMemo(
    () => ({ user, loading, error, refresh, logout }),
    [user, loading, error, refresh, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuthContext(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuthContext must be used within AuthProvider");
  return ctx;
}
