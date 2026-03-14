import { getLoginUrl } from "@/const";
import { useAuthContext } from "@/contexts/AuthContext";
import { useCallback, useEffect } from "react";

type UseAuthOptions = {
  redirectOnUnauthenticated?: boolean;
  redirectPath?: string;
};

export function useAuth(options?: UseAuthOptions) {
  const { redirectOnUnauthenticated = false, redirectPath = getLoginUrl() } = options ?? {};
  const { user, loading, error, refresh, logout } = useAuthContext();

  useEffect(() => {
    if (!redirectOnUnauthenticated) return;
    if (loading) return;
    if (user) return;
    if (typeof window === "undefined") return;
    if (window.location.pathname === redirectPath) return;
    window.location.href = redirectPath;
  }, [redirectOnUnauthenticated, redirectPath, loading, user]);

  const logoutAndRedirect = useCallback(
    async (to = redirectPath) => {
      await logout();
      if (typeof window !== "undefined") window.location.href = to;
    },
    [logout, redirectPath]
  );

  return {
    user,
    loading,
    error,
    isAuthenticated: Boolean(user),
    refresh,
    logout,
    logoutAndRedirect,
  };
}
