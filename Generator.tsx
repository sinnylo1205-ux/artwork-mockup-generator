import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { Upload, Loader2, Download, Image as ImageIcon } from "lucide-react";
import { getLoginUrl } from "@/const";
import { useLocation } from "wouter";

type Orientation = "portrait" | "landscape" | "square";
type RoomStyle = "japanese" | "nordic" | "american" | "rustic" | "wooden-floor" | "artist-holding" | "bedroom-with-eaves";
type FrameColor = "matte-gold" | "matte-gray" | "white" | "brushed-silver" | "matte-black" | "black-walnut" | "teak" | "light-wood" | "maple";
type ViewAngle = "left" | "front" | "right";
type ImageGenerationCore = "manus" | "openai";

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

const VIEW_ANGLES: { value: ViewAngle; label: string; description: string }[] = [
  { value: "left", label: "左 45 度視角", description: "從左側斜角查看" },
  { value: "front", label: "正面視角", description: "正面直視" },
  { value: "right", label: "右 45 度視角", description: "從右側斜角查看" },
];

export default function Generator() {
  const { user, loading: authLoading } = useAuth();
  const [, navigate] = useLocation();
  
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [orientation, setOrientation] = useState<Orientation>("portrait");
  const [selectedFrameColors, setSelectedFrameColors] = useState<Set<string>>(new Set());
  const [selectedRoomStyles, setSelectedRoomStyles] = useState<Set<string>>(new Set());
  const [selectedViewAngles, setSelectedViewAngles] = useState<Set<string>>(new Set());
  const [imageGenerationCore, setImageGenerationCore] = useState<ImageGenerationCore>("manus");
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationIds, setGenerationIds] = useState<number[]>([]);

  const uploadMutation = trpc.artwork.uploadOriginalImage.useMutation();
  const generateMutation = trpc.artwork.generateMockups.useMutation();
  
  // 獲取所有生成記錄（只有在有上傳檔案時才執行）
  const { data: generations = [] } = trpc.artwork.listGenerations.useQuery(undefined, {
    enabled: !!user && !!selectedFile,
    refetchInterval: (query) => {
      const hasProcessing = (query.state.data as any[])?.some((g: any) => g.status === "processing");
      return hasProcessing ? 3000 : false;
    }
  });

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("請選擇圖片檔案");
      return;
    }

    setSelectedFile(file);
    const reader = new FileReader();
    reader.onload = (e) => {
      setPreviewUrl(e.target?.result as string);
    };
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
    reader.onload = (e) => {
      setPreviewUrl(e.target?.result as string);
    };
    reader.readAsDataURL(file);
  }, []);

  const toggleFrameColor = (color: FrameColor) => {
    const newColors = new Set(selectedFrameColors);
    if (newColors.has(color)) {
      newColors.delete(color);
    } else {
      newColors.add(color);
    }
    setSelectedFrameColors(newColors as Set<string>);
  };

  const toggleRoomStyle = (style: RoomStyle) => {
    const newStyles = new Set(selectedRoomStyles);
    if (newStyles.has(style)) {
      newStyles.delete(style);
    } else {
      newStyles.add(style);
    }
    setSelectedRoomStyles(newStyles as Set<string>);
  };

  const toggleViewAngle = (angle: ViewAngle) => {
    const newAngles = new Set(selectedViewAngles);
    if (newAngles.has(angle)) {
      newAngles.delete(angle);
    } else {
      newAngles.add(angle);
    }
    setSelectedViewAngles(newAngles as Set<string>);
  };

  const handleGenerate = async () => {
    if (!selectedFile || !previewUrl) {
      toast.error("請先上傳作品圖片");
      return;
    }

    if (selectedFrameColors.size === 0) {
      toast.error("請至少選擇一個框架顔色");
      return;
    }

    if (selectedRoomStyles.size === 0) {