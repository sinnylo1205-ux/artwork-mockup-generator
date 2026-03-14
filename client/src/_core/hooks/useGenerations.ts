import { listGenerations, type Generation } from "@/lib/supabase-api";
import { useCallback, useEffect, useRef, useState } from "react";

/** 有 processing 時輪詢，最多輪詢次數，避免 502 或未實作生圖時無限請求 */
const MAX_POLL_COUNT = 40;
const POLL_INTERVAL_MS = 3000;

export function useGenerations(authUserId: string | undefined) {
  const [data, setData] = useState<Generation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const pollCountRef = useRef(0);

  const refetch = useCallback(async () => {
    if (!authUserId) {
      setData([]);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    try {
      const list = await listGenerations(authUserId);
      setData(list);
    } catch {
      setData((prev) => prev);
    } finally {
      setIsLoading(false);
    }
  }, [authUserId]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  useEffect(() => {
    const hasProcessing = data.some((g) => g.status === "processing");
    if (!authUserId || !hasProcessing) {
      pollCountRef.current = 0;
      return;
    }
    if (pollCountRef.current >= MAX_POLL_COUNT) return;
    const interval = setInterval(() => {
      pollCountRef.current += 1;
      refetch();
    }, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [authUserId, data, refetch]);

  return { data, isLoading, refetch };
}
