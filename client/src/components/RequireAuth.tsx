import { useAuth } from "@/_core/hooks/useAuth";
import { Loader2 } from "lucide-react";

type Props = { children: React.ReactNode };

/** 未登入或非管理員時導向 /login，通過則渲染 children */
export function RequireAuth({ children }: Props) {
  const { user, loading } = useAuth({ redirectOnUnauthenticated: true, redirectPath: "/login" });

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return <>{children}</>;
}
