import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { getSupabase } from "@/lib/supabase";

/** 與 user_roles 表一致：僅 role = 'admin' 可使用本站 */
export type AppUser = {
  authUserId: string;
  email: string | null;
  isAdmin: boolean;
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
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        setUser(null);
        return null;
      }
      const { data: row } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", session.user.id)
        .maybeSingle();

      if (!row || row.role !== "admin") {
        setUser(null);
        return null;
      }
      const appUser: AppUser = {
        authUserId: session.user.id,
        email: session.user.email ?? null,
        isAdmin: true,
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
