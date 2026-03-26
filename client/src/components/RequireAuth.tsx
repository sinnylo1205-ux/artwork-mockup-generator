import { useAuthContext } from "@/contexts/AuthContext";
import { Loader2 } from "lucide-react";

type Props = { children: React.ReactNode };

/** 等待身分初始化（含匿名訪客）後再渲染；不強制導向登入頁 */
export function RequireAuth({ children }: Props) {
  const { loading } = useAuthContext();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return <>{children}</>;
}
