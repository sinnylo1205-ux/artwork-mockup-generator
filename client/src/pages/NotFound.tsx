import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  const [, setLocation] = useLocation();
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-2xl font-bold">404</h1>
        <p className="mt-2 text-muted-foreground">找不到頁面</p>
        <Button className="mt-4" onClick={() => setLocation("/")}>
          返回首頁
        </Button>
      </div>
    </div>
  );
}
