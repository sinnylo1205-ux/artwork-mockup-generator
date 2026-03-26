import { useCallback, useEffect, useState } from "react";
import { useAuthContext } from "@/contexts/AuthContext";
import { getPromptTemplates, updatePromptTemplate, type PromptTemplate } from "@/lib/supabase-api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { useLocation } from "wouter";
import { Loader2, ArrowLeft } from "lucide-react";

const TYPE_LABELS: Record<string, string> = {
  orientation: "作品方向",
  room: "房間風格",
  frame: "畫框",
  angle: "視角",
  prompt_part: "通用句",
  negative: "負向提示",
  room_short: "房間簡稱（OpenAI 用，Replicate 使用完整 room）",
};

export default function Prompts() {
  const [, navigate] = useLocation();
  const { user, loading: authLoading } = useAuthContext();
  const [list, setList] = useState<PromptTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);

  const refetch = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await getPromptTemplates();
      setList(data);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (authLoading) return;
    if (!user?.isAdmin) {
      setIsLoading(false);
      return;
    }
    refetch();
  }, [authLoading, user?.isAdmin, refetch]);

  const byType = list.reduce<Record<string, PromptTemplate[]>>((acc, p) => {
    (acc[p.type] = acc[p.type] ?? []).push(p);
    return acc;
  }, {});

  const handleStartEdit = (key: string, content: string) => {
    setEditingKey(key);
    setDraft(content);
  };
  const handleSave = async () => {
    if (editingKey == null) return;
    setSaving(true);
    try {
      await updatePromptTemplate(editingKey, draft);
      toast.success("已儲存");
      setEditingKey(null);
      await refetch();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "儲存失敗");
    } finally {
      setSaving(false);
    }
  };
  const handleCancel = () => {
    setEditingKey(null);
  };

  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!user?.isAdmin) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardHeader>
            <CardTitle>需要管理員權限</CardTitle>
            <CardDescription>提示詞管理僅限管理員，請由導航列「管理員登入」使用管理員帳號登入。</CardDescription>
          </CardHeader>
          <CardContent className="flex gap-2">
            <Button onClick={() => navigate("/login")}>前往登入</Button>
            <Button variant="outline" onClick={() => navigate("/")}>
              回首頁
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="container py-4 flex items-center justify-between">
          <h1 className="text-xl font-bold text-foreground">提示詞管理</h1>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => navigate("/")}>
              <ArrowLeft className="w-4 h-4 mr-1" />
              返回生成
            </Button>
            <Button variant="outline" size="sm" onClick={() => navigate("/history")}>
              歷史記錄
            </Button>
          </div>
        </div>
      </header>

      <main className="container py-8 space-y-8">
        <p className="text-muted-foreground">
          以下提示詞用於 Replicate Flux 生圖時的英文 prompt，修改後會即時影響之後的生成。選「Replicate Flux」時會使用完整提示詞；OpenAI 僅使用部分（房間簡稱、畫框、視角）。
        </p>
        {Object.entries(byType).map(([type, items]) => (
          <Card key={type}>
            <CardHeader>
              <CardTitle>{TYPE_LABELS[type] ?? type}</CardTitle>
              <CardDescription>key 前綴：{type}_</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {items.map((p) => (
                <div key={p.key} className="border rounded-lg p-3 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <code className="text-sm text-muted-foreground">{p.key}</code>
                    {editingKey === p.key ? (
                      <div className="flex gap-2">
                        <Button size="sm" onClick={handleSave} disabled={saving}>
                          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "儲存"}
                        </Button>
                        <Button size="sm" variant="outline" onClick={handleCancel}>
                          取消
                        </Button>
                      </div>
                    ) : (
                      <Button size="sm" variant="outline" onClick={() => handleStartEdit(p.key, p.content)}>
                        編輯
                      </Button>
                    )}
                  </div>
                  {editingKey === p.key ? (
                    <textarea
                      className="w-full min-h-[80px] rounded border border-input bg-background px-3 py-2 text-sm"
                      value={draft}
                      onChange={(e) => setDraft(e.target.value)}
                    />
                  ) : (
                    <p className="text-sm whitespace-pre-wrap break-words">{p.content}</p>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        ))}
        {list.length === 0 && (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              尚無提示詞資料。請在 Supabase 執行 supabase-setup.sql 建立 prompt_templates 表並插入 seed，並設定環境變數 SUPABASE_URL、SUPABASE_ANON_KEY。
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
