import React from "react";
import { createTRPCReact } from "@trpc/react-query";
import type { AppRouter } from "../../../server/routers";
import { httpBatchLink } from "@trpc/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { getAccessToken } from "./supabase";

export type { AppRouter };

const getBaseUrl = () => {
  if (typeof window === "undefined") return import.meta.env.VITE_API_URL || "http://localhost:5000";
  return import.meta.env.VITE_API_URL || (import.meta.env.DEV ? "http://localhost:5000" : "");
};

export const trpc = createTRPCReact<AppRouter>();

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 5 * 1000 },
  },
});

const trpcClient = trpc.createClient({
  links: [
    httpBatchLink({
      url: `${getBaseUrl()}/api/trpc`,
      async headers() {
        const token = await getAccessToken();
        return {
          ...(token ? { authorization: `Bearer ${token}` } : {}),
        };
      },
      fetch(url, options) {
        return fetch(url, { ...options, credentials: "include" });
      },
    }),
  ],
});

export function TRPCProvider({ children }: { children: React.ReactNode }) {
  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </trpc.Provider>
  );
}
