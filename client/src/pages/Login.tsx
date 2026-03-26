import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { useAuthContext } from "@/contexts/AuthContext";
import { getSupabase } from "@/lib/supabase";
import { toast } from "sonner";
import { Loader2, LogIn, UserPlus, Mail } from "lucide-react";

export default function Login() {
  const [, navigate] = useLocation();
  const { user: me, loading: meLoading, refresh } = useAuthContext();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"signIn" | "signUp" | "forgot">("signIn");
  const [loading, setLoading] = useState(false);

  if (me?.isAdmin) {
    navigate("/");
    return null;
  }
  // 已用信箱登入的非管理員：直接回首頁（若要改帳號請先登出）
  if (me && !me.isAnonymous) {
    navigate("/");
    return null;
  }

  const supabase = getSupabase();

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase) {
      toast.error("未設定 Supabase，請設定 VITE_SUPABASE_URL 與 VITE_SUPABASE_ANON_KEY");
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        toast.error(error.message);
        return;
      }
      if (data.session) {
        const next = await refresh();
        if (next?.isAdmin) {
          toast.success("登入成功");
        } else {
          toast.success("已登入，可使用生圖與歷史記錄");
        }
        navigate("/");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase) {
      toast.error("未設定 Supabase");
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signUp({ email, password });
      if (error) {
        toast.error(error.message);
        return;
      }
      if (data.user && !data.session) {
        toast.success("已送出驗證信，請至信箱點擊連結完成註冊（若未收到請檢查垃圾信匣，或請管理員於 Supabase 關閉「Confirm email」）");
        setMode("signIn");
      } else if (data.session) {
        await refresh();
        toast.success("註冊成功");
        navigate("/");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleForgot = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase || !email) {
      toast.error("請輸入信箱");
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/login`,
      });
      if (error) {
        toast.error(error.message);
        return;
      }
      toast.success("重設密碼信已寄出，請至信箱查收");
      setMode("signIn");
    } finally {
      setLoading(false);
    }
  };

  if (meLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!supabase) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="max-w-md w-full">
          <CardHeader>
            <CardTitle>無法載入登入頁</CardTitle>
            <CardDescription>請在環境變數設定 VITE_SUPABASE_URL 與 VITE_SUPABASE_ANON_KEY</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="max-w-md w-full">
        <CardHeader>
          <CardTitle>藝術作品模擬圖</CardTitle>
          <CardDescription>管理員請在此登入；一般用戶可於首頁以訪客身分直接使用</CardDescription>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={
              mode === "signIn" ? handleSignIn : mode === "signUp" ? handleSignUp : handleForgot
            }
            className="space-y-4"
          >
            <div className="space-y-2">
              <Label htmlFor="email">信箱</Label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your@email.com"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                required
                autoComplete="email"
              />
            </div>
            {mode !== "forgot" && (
              <div className="space-y-2">
                <Label htmlFor="password">密碼</Label>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  required={mode !== "forgot"}
                  autoComplete={mode === "signUp" ? "new-password" : "current-password"}
                />
              </div>
            )}
            <div className="flex flex-col gap-2">
              {mode === "signIn" && (
                <>
                  <Button type="submit" disabled={loading} className="w-full">
                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogIn className="w-4 h-4" />}
                    <span className="ml-2">登入</span>
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full"
                    onClick={() => setMode("signUp")}
                  >
                    <UserPlus className="w-4 h-4" />
                    <span className="ml-2">註冊新帳號</span>
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="w-full"
                    onClick={() => setMode("forgot")}
                  >
                    <Mail className="w-4 h-4" />
                    <span className="ml-2">忘記密碼</span>
                  </Button>
                </>
              )}
              {mode === "signUp" && (
                <>
                  <Button type="submit" disabled={loading} className="w-full">
                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
                    <span className="ml-2">註冊</span>
                  </Button>
                  <Button type="button" variant="ghost" size="sm" onClick={() => setMode("signIn")}>
                    改為登入
                  </Button>
                </>
              )}
              {mode === "forgot" && (
                <>
                  <Button type="submit" disabled={loading} className="w-full">
                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
                    <span className="ml-2">寄出重設密碼信</span>
                  </Button>
                  <Button type="button" variant="ghost" size="sm" onClick={() => setMode("signIn")}>
                    返回登入
                  </Button>
                </>
              )}
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
