import type { TrpcContext } from "./context";

export function getSessionCookieOptions(_req: TrpcContext["req"]) {
  return {
    httpOnly: true,
    secure: _req.protocol === "https",
    sameSite: "lax" as const,
    path: "/",
  };
}
