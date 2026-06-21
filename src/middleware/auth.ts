import type { Context } from "hono";
import { createMiddleware } from "hono/factory";
import { isAdminAuthorized, readBearerToken } from "../auth/admin";
import { allowsAnonymousRequests, anonymousApiKey } from "../auth/anonymous";
import { getApiKeyByRawKey, readApiKeyFromRequest, touchApiKeyLastUsed } from "../auth/api-keys";
import { parseConfig } from "../config";
import { ConvertingError } from "../http/errors";
import type { ApiKey } from "../types/api";
import type { AppEnv } from "../types/env";

export const requireApiKey = createMiddleware<AppEnv>(async (c, next) => {
  const apiKey = await authenticateApiKey(c);
  c.set("apiKey", apiKey);
  await next();
});

export const requireAdminToken = createMiddleware<AppEnv>(async (c, next) => {
  authenticateAdmin(c);
  await next();
});

export async function authenticateApiKey(c: Context<AppEnv>): Promise<ApiKey> {
  const config = parseConfig(c.env);
  const rawApiKey = readApiKeyFromRequest(c.req.raw);
  if (!rawApiKey) {
    if (allowsAnonymousRequests(config)) {
      return anonymousApiKey(config);
    }

    throw new ConvertingError("missing_api_key", "Missing API key.", 401);
  }

  const apiKey = await getApiKeyByRawKey(c.env, rawApiKey);
  if (!apiKey) {
    throw new ConvertingError("invalid_api_key", "Invalid API key.", 401);
  }

  if (apiKey.status !== "active") {
    throw new ConvertingError("revoked_api_key", "API key is not active.", 403);
  }

  await touchApiKeyLastUsed(c.env, apiKey.id, new Date());
  return apiKey;
}

function authenticateAdmin(c: Context<AppEnv>): void {
  if (isAdminAuthorized(c.req.raw, c.env)) return;

  if (!readBearerToken(c.req.raw)) {
    throw new ConvertingError("missing_api_key", "Missing admin token.", 401);
  }

  throw new ConvertingError("invalid_api_key", "Invalid admin token.", 401);
}
