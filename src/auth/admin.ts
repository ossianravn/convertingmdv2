import type { Env } from "../types/env";

export function readBearerToken(request: Request): string | null {
  const authorization = request.headers.get("Authorization");
  if (!authorization?.startsWith("Bearer ")) return null;
  return authorization.slice("Bearer ".length).trim();
}

export function isAdminAuthorized(request: Request, env: Env): boolean {
  const token = readBearerToken(request);
  return Boolean(token && env.ADMIN_TOKEN && token === env.ADMIN_TOKEN);
}

