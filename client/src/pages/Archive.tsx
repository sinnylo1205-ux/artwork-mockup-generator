import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { getArchiveByMonth } from "@/lib/supabase-api";
import { useLocation } from "wouter";
import { ArrowLeft, Calendar, Image as ImageIcon, Download, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";

/** 單張生成圖（對應 Supabase generated_artwork_images 一筆） */
type GeneratedImageItem = {
  id: number;
  artwork_generation_id: number;
  public_url: string;
  angle: string;
  created_at: string;
};

const ANGLE_LABELS: Record<string, string> = {
  left: "左 45°",
  front: "正面",
  right: "右 45°",
};

function formatMonthKey(key: string): string {
  const [y, m] = key.split("-");
  const months = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12"];
  const monthNum = parseInt(m, 10);
  return `${y}年${monthNum}月`;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("zh-TW", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

export default function Archive() {
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const [archiveMonths, setArchiveMonths] = useState<{ monthKey: string; images: GeneratedImageItem[] }[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!user?.authUserId) {
      setArchiveMonths([]);
      setIsLoading(false);
      return;
    }
    let cancelled = false;
    setIsLoading(true);
    getArchiveByMonth(user.authUserId)
      .then((data) => {
        if (!cancelled) setArchiveMonths(data);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => { cancelled = true; };
  }, [user?.authUserId]);

  const months = archiveMonths.map(({ monthKey, images }) => ({
    key: monthKey,
    label: formatMonthKey(monthKey),
    images: images as GeneratedImageItem[],
  }));

  const handleDownload = (url: string, angle: string, dateKey: string) => {
    const link = document.createElement("a");
    link.href = url;
    link.download = `artwork-${dateKey}-${angle}.png`;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card sticky top-0 z-10">
        <div className="container py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate("/")}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div className="flex items-center gap-2">
              <Calendar className="w-6 h-6 text-primary" />
              <h1 className="text-xl font-bold text-foreground">月度歸檔</h1>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => navigate("/history")}>
              歷史記錄
            </Button>
          </div>
        </div>
      </header>

      <main className="container py-8">
        <p className="text-muted-foreground text-sm mb-8">
          依月份顯示所有生成圖（來自 Supabase generated_artwork_images）。
        </p>

        {isLoading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          </div>
        )}

        {!isLoading && months.map(({ key, label, images }) => (
          <section key={key} className="mb-12">
            <h2 className="text-lg font-semibold text-foreground mb-1 flex items-center gap-2">
              <span className="w-1 h-5 rounded-full bg-primary" />
              {label}
            </h2>
            <p className="text-sm text-muted-foreground mb-4">{images.length} 張圖</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {images.map((img) => (
                <Card key={img.id} className="overflow-hidden group">
                  <div className="aspect-square bg-muted relative">
                    <img
                      src={img.public_url}
                      alt={`${ANGLE_LABELS[img.angle]}`}
                      className="w-full h-full object-cover transition-transform group-hover:scale-105"
                    />
                    <span className="absolute top-2 left-2 rounded bg-black/60 text-white text-xs px-2 py-0.5">
                      {ANGLE_LABELS[img.angle] ?? img.angle}
                    </span>
                  </div>
                  <CardContent className="p-2">
                    <p className="text-xs text-muted-foreground truncate">{formatDate(img.created_at)}</p>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full mt-1 h-8 text-xs"
                      onClick={() => handleDownload(img.public_url, img.angle, key)}
                    >
                      <Download className="w-3.5 h-3.5 mr-1" />
                      下載
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>
        ))}

        {!isLoading && months.length === 0 && (
          <Card>
            <CardContent className="py-16 text-center">
              <ImageIcon className="w-16 h-16 mx-auto mb-4 text-muted-foreground opacity-50" />
              <p className="text-muted-foreground">尚無歸檔圖片</p>
              <p className="text-sm text-muted-foreground mt-1">生成後的圖片會依月份顯示於此</p>
              <Button className="mt-4" variant="outline" onClick={() => navigate("/")}>
                前往生成
              </Button>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
