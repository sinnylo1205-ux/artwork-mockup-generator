import "dotenv/config";
import http from "http";
import { createHTTPHandler } from "@trpc/server/adapters/standalone";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";
import { getSupabaseClientForUser, getOrCreateArtworkUser } from "./supabase";

const PORT = Number(process.env.PORT) || 5000;
const ALLOW_ORIGIN = process.env.CORS_ORIGIN || "http://localhost:3000";

async function createContext(opts: { req: import("http").IncomingMessage; res: import("http").ServerResponse }): Promise<TrpcContext> {
  const req = opts.req;
  const res = opts.res;
  const protocol = req.headers["x-forwarded-proto"] ?? "http";
  const headers: Record<string, string> = {};
  req.headers && Object.entries(req.headers).forEach(([k, v]) => { if (v) headers[k] = Array.isArray(v) ? v[0] : v; });

  let user: TrpcContext["user"] = null;
  const authHeader = headers["authorization"] ?? headers["Authorization"];
  const token = typeof authHeader === "string" && authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;

  if (token) {
    const supabase = getSupabaseClientForUser(token);
    if (supabase) {
      const { data: authUser, error } = await supabase.auth.getUser(token);
      if (!error && authUser?.user) {
        const row = await getOrCreateArtworkUser(supabase, authUser.user.id, authUser.user.email ?? null);
        if (row?.is_admin) {
          user = { id: row.id, email: row.email, isAdmin: row.is_admin };
        }
      }
    }
  }

  return {
    user,
    req: { protocol: protocol as string, headers },
    res: {
      clearCookie(name: string, options?: Record<string, unknown>) {
        res.setHeader("Set-Cookie", `${name}=; Path=/; Max-Age=-1`);
      },
    },
  };
}

const trpcHandler = createHTTPHandler({
  router: appRouter,
  createContext,
  basePath: "/api/trpc/", // 尾斜線讓 path 變成 "artwork.uploadOriginalImage" 而非 "/artwork.uploadOriginalImage"
});

const server = http.createServer((req, res) => {
  // 每個回應都加上 CORS，避免 404/500 時被瀏覽器擋
  res.setHeader("Access-Control-Allow-Origin", ALLOW_ORIGIN);
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, authorization");

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  trpcHandler(req, res);
});

server.listen(PORT, () => {
  console.log(`tRPC server listening on http://localhost:${PORT}`);
  console.log(`  API: http://localhost:${PORT}/api/trpc`);
  console.log(`  CORS: ${ALLOW_ORIGIN}`);
});
