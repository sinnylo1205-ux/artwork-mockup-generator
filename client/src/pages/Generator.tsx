import { useState, useCallback } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { useGenerations } from "@/_core/hooks/useGenerations";
import { callGenerateMockups, uploadOriginalImage } from "@/lib/supabase-api";
import { getSupabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { Upload, Loader2, Download, Image as ImageIcon } from "lucide-react";
import { useLocation } from "wouter";

type Orientation = "portrait" | "landscape" | "square";
type RoomStyle = "japanese" | "nordic" | "american" | "rustic" | "wooden-floor" | "artist-holding" | "bedroom-with-eaves";
type FrameColor = "matte-gold" | "matte-gray" | "white" | "brushed-silver" | "matte-black" | "black-walnut" | "teak" | "light-wood" | "maple";
type ImageGenerationCore = "openai" | "replicate";

/** 一組 = 一個框架 + 一個房間風格，會生成左 / 正 / 右三視角 */
type PendingSet = { frameColor: FrameColor; roomStyle: RoomStyle };

const FRAME_COLORS = [
  { value: "matte-gold", label: "霧金色", hex: "#77715b" },
  { value: "matte-gray", label: "拉絲灰色", hex: "#8b9ba8", description: "帶微藍色" },
  { value: "white", label: "白色", hex: "#f5f5f5", description: "易有指紋，請包裝" },
  { value: "brushed-silver", label: "拉絲銀色", hex: "#c0c0c0" },
  { value: "matte-black", label: "拉絲黑色", hex: "#1a1a1a" },
  { value: "black-walnut", label: "黑胡桃", hex: "#3d2817" },
  { value: "teak", label: "柚木", hex: "#8b6f47" },
  { value: "light-wood", label: "原木", hex: "#c9a876" },
  { value: "maple", label: "楓木", hex: "#e8d4b8" },
];

const ROOM_STYLES: { value: RoomStyle; label: string; description: string; previewUrl?: string }[] = [
  { value: "japanese", label: "日本風格", description: "極簡禪意，榻榻米與自然木質", previewUrl: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663346947249/fTGIcTFYLdcDtlzN.png" },
  { value: "nordic", label: "北歐風格", description: "明亮簡約，白牆與淺色木地板", previewUrl: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663346947249/COTPItkXZLxwRJgp.png" },
  { value: "american", label: "現代都會風格", description: "現代都會，當代家具與中性色調", previewUrl: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663346947249/kGffljKiiEqfFnQs.png" },
  { value: "rustic", label: "鄉村風格", description: "溫馨質樸，木樑與石牆", previewUrl: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663346947249/rXbuRCysODnsMmQj.png" },
  { value: "wooden-floor", label: "木頭地板", description: "北歐簡約，深色木地板與白牆", previewUrl: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663346947249/cakZNoXJmsQIryNC.png" },
  { value: "artist-holding", label: "藝術家手拿畫作", description: "生活方式攝影，人物手持框架作品", previewUrl: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663346947249/VZZubkQYCTfPCfql.png" },
  { value: "bedroom-with-eaves", label: "屋簷臥房", description: "日式臥房，木製天花與榻榻米", previewUrl: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663346947249/mkkwseMDMahSCxUG.png" },
];

const VIEW_ANGLE_OPTIONS = [
  { value: "left" as const, label: "左 45 度" },
  { value: "front" as const, label: "正面" },
  { value: "right" as const, label: "右 45 度" },
];

export default function Generator() {
  const [, navigate] = useLocation();
  const { user, logout } = useAuth();
  const { data: generations = [], refetch } = useGenerations(user?.authUserId);

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [orientation, setOrientation] = useState<Orientation>("portrait");
  const [currentFrameColor, setCurrentFrameColor] = useState<FrameColor | null>(null);
  const [currentRoomStyle, setCurrentRoomStyle] = useState<RoomStyle | null>(null);
  const [pendingSets, setPendingSets] = useState<PendingSet[]>([]);
  const [imageGenerationCore, setImageGenerationCore] = useState<ImageGenerationCore>("replicate");
  const [viewAngles, setViewAngles] = useState<("left" | "front" | "right")[]>(["left"]);
  const [isGenerating, setIsGenerating] = useState(false);

  const toggleViewAngle = (angle: "left" | "front" | "right") => {
    setViewAngles((prev) => {
      if (prev.includes(angle)) {
        if (prev.length <= 1) return prev;
        return prev.filter((a) => a !== angle);
      }
      return [...prev, angle];
    });
  };

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("請選擇圖片檔案");
      return;
    }
    setSelectedFile(file);
    const reader = new FileReader();
    reader.onload = (e) => setPreviewUrl(e.target?.result as string);
    reader.readAsDataURL(file);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("請選擇圖片檔案");
      return;
    }
    setSelectedFile(file);
    const reader = new FileReader();
    reader.onload = (e) => setPreviewUrl(e.target?.result as string);
    reader.readAsDataURL(file);
  }, []);

  const currentSetValid = currentFrameColor !== null && currentRoomStyle !== null;
  const setsToGenerate = pendingSets.length > 0 ? pendingSets : (currentSetValid ? [{ frameColor: currentFrameColor!, roomStyle: currentRoomStyle! }] : []);

  const handleAddSetAndContinue = () => {
    if (!currentSetValid) {
      toast.error("請先選擇一個框架與一個房間風格");
      return;
    }
    setPendingSets((prev) => [...prev, { frameColor: currentFrameColor!, roomStyle: currentRoomStyle! }]);
    setCurrentFrameColor(null);
    setCurrentRoomStyle(null);
    toast.success("已加入此組，可繼續選下一組或點「開始生成」");
  };

  const handleGenerateOneSetOnly = async () => {
    if (!currentSetValid) {
      toast.error("請先選擇一個框架與一個房間風格");
      return;
    }
    await runGenerate([{ frameColor: currentFrameColor!, roomStyle: currentRoomStyle! }]);
  };

  const handleGenerateAll = async () => {
    if (setsToGenerate.length === 0) {
      toast.error("請先選擇至少一組（框架 + 房間風格），或點「加入此組並繼續選下一組」");
      return;
    }
    await runGenerate(setsToGenerate);
  };

  const runGenerate = async (sets: PendingSet[]) => {
    if (!selectedFile || !previewUrl || !user) {
      toast.error("請先上傳作品圖片");
      return;
    }
    const token = (await getSupabase()?.auth.getSession())?.data?.session?.access_token;
    if (!token) {
      toast.error("請重新登入");
      return;
    }
    setIsGenerating(true);
    const batchId = `batch-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

    try {
      const { url, key, base64Data } = await uploadOriginalImage(user.authUserId, previewUrl, selectedFile.type);

      for (const { frameColor, roomStyle } of sets) {
        await callGenerateMockups(token, {
          originalImageUrl: url,
          originalImageKey: key,
          originalImageBase64: base64Data,
          orientation,
          frameColor,
          roomStyle,
          viewAngles: viewAngles.length > 0 ? [...viewAngles] : ["left"],
          imageGenerationCore,
          batchId,
        });
      }
      setPendingSets([]);
      setCurrentFrameColor(null);
      setCurrentRoomStyle(null);
      await refetch();
      const totalImages = sets.length * Math.max(viewAngles.length, 1);
      toast.success(`已開始生成（${totalImages} 張），請至歷史記錄查看進度`);
      navigate("/history");
    } catch (err) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : "生成失敗");
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="container py-4 flex items-center justify-between">
          <h1 className="text-xl font-bold text-foreground">藝術作品模擬圖生成</h1>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => navigate("/archive")}>
              月度歸檔
            </Button>
            <Button variant="outline" size="sm" onClick={() => navigate("/prompts")}>
              提示詞管理
            </Button>
            <Button variant="outline" size="sm" onClick={() => navigate("/history")}>
              歷史記錄
            </Button>
            <Button variant="ghost" size="sm" onClick={() => logout().then(() => navigate("/login"))}>
              登出
            </Button>
          </div>
        </div>
      </header>

      <main className="container py-8 space-y-8">
        <Card>
          <CardHeader>
            <CardTitle>上傳作品</CardTitle>
            <CardDescription>上傳一張作品圖片，選擇框架與房間風格後即可生成模擬圖</CardDescription>
          </CardHeader>
          <CardContent>
            <div
              className="border-2 border-dashed border-border rounded-lg p-8 text-center cursor-pointer hover:bg-muted/50 transition-colors"
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDrop}
              onClick={() => document.getElementById("file-input")?.click()}
            >
              <input
                id="file-input"
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleFileSelect}
              />
              {previewUrl ? (
                <img src={previewUrl} alt="預覽" className="max-h-48 mx-auto rounded object-contain" />
              ) : (
                <>
                  <Upload className="w-12 h-12 mx-auto text-muted-foreground mb-2" />
                  <p className="text-muted-foreground">點擊或拖曳圖片至此</p>
                </>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>作品方向</CardTitle>
            <CardDescription>選擇作品掛置的方向</CardDescription>
          </CardHeader>
          <CardContent>
            <RadioGroup value={orientation} onValueChange={(v) => setOrientation(v as Orientation)} className="flex gap-4">
              <Label className="flex items-center gap-2 cursor-pointer">
                <RadioGroupItem value="portrait" />
                直式 (50×70cm)
              </Label>
              <Label className="flex items-center gap-2 cursor-pointer">
                <RadioGroupItem value="landscape" />
                橫式 (70×50cm)
              </Label>
              <Label className="flex items-center gap-2 cursor-pointer">
                <RadioGroupItem value="square" />
                正方形 (50×50cm)
              </Label>
            </RadioGroup>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>這一組：畫框顏色</CardTitle>
            <CardDescription>選一個</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-3">
              {FRAME_COLORS.map((f) => (
                <Label
                  key={f.value}
                  className={`flex items-center gap-2 cursor-pointer rounded-lg border px-3 py-2 transition-colors ${currentFrameColor === f.value ? "border-primary bg-primary/10" : "border-border hover:bg-muted/50"}`}
                  onClick={() => setCurrentFrameColor(f.value as FrameColor)}
                >
                  <span className="w-4 h-4 rounded border border-border" style={{ backgroundColor: f.hex }} />
                  <span>{f.label}</span>
                </Label>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>這一組：房間風格</CardTitle>
            <CardDescription>選一個</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {ROOM_STYLES.map((r) => (
                <div
                  key={r.value}
                  className={`border rounded-lg p-4 cursor-pointer transition-colors ${currentRoomStyle === r.value ? "border-primary bg-primary/10" : "border-border hover:bg-muted/50"}`}
                  onClick={() => setCurrentRoomStyle(r.value)}
                >
                  {r.previewUrl && (
                    <img src={r.previewUrl} alt={r.label} className="w-full h-24 object-cover rounded mb-2" />
                  )}
                  <p className="font-medium">{r.label}</p>
                  <p className="text-sm text-muted-foreground">{r.description}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>生成視角</CardTitle>
            <CardDescription>勾選要生成的視角，預設只生成左 45 度（較快）</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-6">
              {VIEW_ANGLE_OPTIONS.map((opt) => (
                <Label key={opt.value} className="flex items-center gap-2 cursor-pointer">
                  <Checkbox
                    checked={viewAngles.includes(opt.value)}
                    onCheckedChange={() => toggleViewAngle(opt.value)}
                  />
                  {opt.label}
                </Label>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>生圖核心</CardTitle>
            <CardDescription>選擇使用的 AI 生圖服務</CardDescription>
          </CardHeader>
          <CardContent>
            <RadioGroup value={imageGenerationCore} onValueChange={(v) => setImageGenerationCore(v as ImageGenerationCore)} className="flex gap-4">
              <Label className="flex items-center gap-2 cursor-pointer">
                <RadioGroupItem value="replicate" />
                Replicate Flux（高品質，使用提示詞管理）
              </Label>
              <Label className="flex items-center gap-2 cursor-pointer">
                <RadioGroupItem value="openai" />
                OpenAI DALL-E
              </Label>
            </RadioGroup>
          </CardContent>
        </Card>

        {pendingSets.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>待生成</CardTitle>
              <CardDescription>
              已加入 {pendingSets.length} 組，共 {pendingSets.length * Math.max(viewAngles.length, 1)} 張
            </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="text-sm text-muted-foreground space-y-1">
                {pendingSets.map((s, i) => (
                  <li key={i}>
                    第 {i + 1} 組：{FRAME_COLORS.find((f) => f.value === s.frameColor)?.label}、{ROOM_STYLES.find((r) => r.value === s.roomStyle)?.label}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}

        <div className="flex flex-wrap gap-3 justify-end">
          <Button
            variant="outline"
            size="lg"
            disabled={isGenerating || !selectedFile || !currentSetValid}
            onClick={handleAddSetAndContinue}
          >
            加入此組，繼續選下一組
          </Button>
          <Button
            variant="outline"
            size="lg"
            disabled={isGenerating || !selectedFile || !currentSetValid}
            onClick={handleGenerateOneSetOnly}
          >
            只生成這一組（{Math.max(viewAngles.length, 1)} 張）
          </Button>
          <Button
            size="lg"
            disabled={isGenerating || !selectedFile || setsToGenerate.length === 0}
            onClick={handleGenerateAll}
          >
            {isGenerating ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                生成中…
              </>
            ) : setsToGenerate.length > 1 ? (
              `開始生成（共 ${setsToGenerate.length} 組，${setsToGenerate.length * Math.max(viewAngles.length, 1)} 張）`
            ) : (
              `開始生成（1 組，${Math.max(viewAngles.length, 1)} 張）`
            )}
          </Button>
        </div>
      </main>
    </div>
  );
}
