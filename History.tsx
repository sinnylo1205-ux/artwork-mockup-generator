import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2, Download, Trash2, ArrowLeft, Image as ImageIcon, ChevronDown, ChevronUp } from "lucide-react";
import { getLoginUrl } from "@/const";
import { useLocation } from "wouter";
import { useState, useMemo } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

const ROOM_STYLE_LABELS: Record<string, string> = {
  japanese: "日本風格",
  nordic: "北歐風格",
  american: "現代都會",
  rustic: "鄉村風格",
  "wooden-floor": "木頭地板",
  "artist-holding": "藝術家手拿",
  "bedroom-with-eaves": "屋簷臥房",
};

const FRAME_COLOR_LABELS: Record<string, string> = {
  "matte-gold": "霧金色",
  "matte-gray": "霧灰色",
  white: "白色",
  "brushed-silver": "拉絲銀色",
  "matte-black": "霧黑色",
  "black-walnut": "黑胡桃木",
  teak: "柚木",
  "light-wood": "淺木色",
  maple: "楓木",
};

const ORIENTATION_LABELS: Record<string, string> = {
  portrait: "直式",
  landscape: "橫式",
  square: "正方形",
};

const VIEW_ANGLE_LABELS: Record<string, string> = {
  left: "左45度",
  front: "正面",
  right: "右45度",
};

export default function History() {
  const { user, loading: authLoading } = useAuth();
  const [, navigate] = useLocation();
  const { data: generations, isLoading, refetch } = trpc.artwork.listGenerations.useQuery(undefined, {
    enabled: !!user,
  });
  const deleteMutation = trpc.artwork.deleteGeneration.useMutation();
  const [expandedBatches, setExpandedBatches] = useState<Set<string>>(new Set());

  // 按 batchId 分組
  const groupedGenerations = useMemo(() => {
    if (!generations) return [];
    
    const groups = new Map<string, typeof generations>();
    generations.forEach((gen) => {
      const key = gen.batchId || `single-${gen.id}`;
      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key)!.push(gen);
    });
    
    return Array.from(groups.entries()).map(([batchId, gens]) => ({
      batchId,
      generations: gens,
      createdAt: gens[0].createdAt,
    })).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [generations]);

  const toggleBatch = (batchId: string) => {
    const newExpanded = new Set(expandedBatches);
    if (newExpanded.has(batchId)) {
      newExpanded.delete(batchId);
    } else {
      newExpanded.add(batchId);
    }
    setExpandedBatches(newExpanded);
  };

  const handleDelete = async (id: number) => {
    try {
      await deleteMutation.mutateAsync({ id });
      toast.success("已刪除");
      refetch();
    } catch (error) {
      console.error("Delete failed:", error);
      toast.error("刪除失敗");
    }
  };

  const handleDownload = async (url: string, filename: string) => {
    try {
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.success("下載已開始");
    } catch (error) {
      console.error("Download failed:", error);
      toast.error("下載失敗");
    }
  };

  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>請先登入</CardTitle>
            <CardDescription>您需要登入才能查看歷史記錄</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild className="w-full">
              <a href={getLoginUrl()}>登入</a>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card">
        <div className="container py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate("/")}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <h1 className="text-2xl font-bold text-foreground">生成歷史記錄</h1>
          </div>
        </div>
      </header>

      <main className="container py-8">
        {!groupedGenerations || groupedGenerations.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <ImageIcon className="w-16 h-16 mx-auto mb-4 text-muted-foreground opacity-50" />
              <p className="text-muted-foreground">尚無生成記錄</p>
              <Button className="mt-4" onClick={() => navigate("/")}>
                開始生成
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {groupedGenerations.map((batch) => {
              const isExpanded = expandedBatches.has(batch.batchId);
              const firstGen = batch.generations[0];
              const uniqueFrameColors = Array.from(new Set(batch.generations.map(g => g.frameColor)));
              const uniqueRoomStyles = Array.from(new Set(batch.generations.map(g => g.roomStyle)));
              
              return (
                <Card key={batch.batchId} className="overflow-hidden">
                  <CardHeader className="cursor-pointer" onClick={() => toggleBatch(batch.batchId)}>
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <CardTitle className="text-lg">
                          {ORIENTATION_LABELS[firstGen.orientation]} · {batch.generations.length} 個組合
                        </CardTitle>
                        <CardDescription className="mt-1">
                          框架：{uniqueFrameColors.map(c => FRAME_COLOR_LABELS[c]).join("、")} · 
                          房間：{uniqueRoomStyles.map(s => ROOM_STYLE_LABELS[s]).join("、")} · 
                          生圖核心：{firstGen.imageGenerationCore === "openai"
                            ? "OpenAI DALL-E"
                            : firstGen.imageGenerationCore === "replicate"
                              ? "Replicate Flux"
                              : "Manus 內建"}
                          {firstGen.errorMessage && firstGen.errorMessage.includes("OpenAI") && (
                            <span className="text-amber-600 dark:text-amber-400"> (已降級)</span>
                          )}
                        </CardDescription>
                        <CardDescription className="text-xs mt-1">
                          {new Date(batch.createdAt).toLocaleString("zh-TW")}
                        </CardDescription>
                      </div>
                      {isExpanded ? (
                        <ChevronUp className="w-5 h-5 text-muted-foreground" />
                      ) : (
                        <ChevronDown className="w-5 h-5 text-muted-foreground" />
                      )}
                    </div>
                  </CardHeader>
                  
                  {isExpanded && (
                    <CardContent>
                      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {batch.generations.map((gen) => (
                          <Card key={gen.id} className="overflow-hidden">
                            <div className="aspect-square bg-muted relative">
                              {gen.status === "completed" && gen.frontImageUrl ? (
                                <img src={gen.frontImageUrl} alt="Generated artwork" className="w-full h-full object-cover" />
                              ) : gen.status === "processing" ? (
                                <div className="w-full h-full flex items-center justify-center">
                                  <Loader2 className="w-8 h-8 animate-spin text-primary" />
                                </div>
                              ) : gen.status === "failed" ? (
                                <div className="w-full h-full flex flex-col items-center justify-center text-destructive p-4">
                                  <ImageIcon className="w-12 h-12 mb-2 opacity-50" />
                                  <p className="text-sm font-medium">生成失敗</p>
                                  {gen.errorMessage && (
                                    <p className="text-xs text-muted-foreground mt-1 text-center">{gen.errorMessage}</p>
                                  )}
                                </div>
                              ) : (
                                <div className="w-full h-full flex items-center justify-center">
                                  <ImageIcon className="w-12 h-12 text-muted-foreground opacity-50" />
                                </div>
                              )}
                            </div>
                            <div className="p-4 space-y-2">
                              <p className="text-sm font-medium">
                                {FRAME_COLOR_LABELS[gen.frameColor]} · {ROOM_STYLE_LABELS[gen.roomStyle]}
                              </p>
                              {gen.status === "completed" && (
                                <div className="space-y-1">
                                  {gen.leftAngleImageUrl && (
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      className="w-full"
                                      onClick={() => handleDownload(gen.leftAngleImageUrl!, `${gen.frameColor}-${gen.roomStyle}-left-${gen.id}.jpg`)}
                                    >
                                      <Download className="w-4 h-4 mr-2" />
                                      下載左45度
                                    </Button>
                                  )}
                                  {gen.frontImageUrl && (
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      className="w-full"
                                      onClick={() => handleDownload(gen.frontImageUrl!, `${gen.frameColor}-${gen.roomStyle}-front-${gen.id}.jpg`)}
                                    >
                                      <Download className="w-4 h-4 mr-2" />
                                      下載正面
                                    </Button>
                                  )}
                                  {gen.rightAngleImageUrl && (
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      className="w-full"
                                      onClick={() => handleDownload(gen.rightAngleImageUrl!, `${gen.frameColor}-${gen.roomStyle}-right-${gen.id}.jpg`)}
                                    >
                                      <Download className="w-4 h-4 mr-2" />
                                      下載右45度
                                    </Button>
                                  )}
                                </div>
                              )}
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button variant="destructive" size="sm" className="w-full">
                                    <Trash2 className="w-4 h-4 mr-2" />
                                    刪除
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>確定要刪除嗎？</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      此操作無法復原，將永久刪除這個生成記錄。
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>取消</AlertDialogCancel>
                                    <AlertDialogAction onClick={() => handleDelete(gen.id)}>
                                      確定刪除
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </div>
                          </Card>
                        ))}
                      </div>
                    </CardContent>
                  )}
                </Card>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
