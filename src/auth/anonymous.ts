import type { AppConfig } from "../config";
import type { ApiKey } from "../types/api";

export const anonymousApiKeyId = "anon_public";

export function allowsAnonymousRequests(config: AppConfig): boolean {
  return !config.requireAuth && config.allowAnon;
}

export function anonymousApiKey(): ApiKey {
  return {
    id: anonymousApiKeyId,
    name: "Anonymous",
    prefix: "anon_public",
    status: "active",
    dailyRequestLimit: 100000,
    monthlyRequestLimit: 3000000,
    allowBrowser: false,
    autoBrowserFallback: false,
    dailyBrowserMsLimit: 0,
    monthlyBrowserMsLimit: 0,
    allowImages: false,
    dailyImageLimit: 0,
    monthlyImageLimit: 0,
    createdAt: "1970-01-01T00:00:00.000Z",
    updatedAt: "1970-01-01T00:00:00.000Z",
    lastUsedAt: null
  };
}
