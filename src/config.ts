import type { Env } from "./types/env";

export interface AppConfig {
  requireAuth: boolean;
  allowAnon: boolean;
  disableBrowser: boolean;
  disableImageConversion: boolean;
  defaultCacheTtlSeconds: number;
  maxSourceBytes: number;
  maxOutputBytes: number;
  maxBrowserMsPerRequest: number;
  globalDailyBrowserMsLimit: number;
  globalMonthlyBrowserMsLimit: number;
  globalDailyImageLimit: number;
  globalMonthlyImageLimit: number;
  contentCheck: ContentCheckConfig;
  frankensurf: FrankensurfConfig | null;
}

export interface ContentCheckConfig {
  typesafeApiKey: string;
  model: string;
}

export interface FrankensurfConfig {
  url: string;
  apiKey: string;
  timeoutMs: number;
  globalDailyLimit: number;
  globalMonthlyLimit: number;
}

export function parseConfig(env: Env): AppConfig {
  assertProductionSecrets(env);

  return {
    requireAuth: parseBoolean(env.REQUIRE_AUTH ?? "true", "REQUIRE_AUTH"),
    allowAnon: parseBoolean(env.ALLOW_ANON ?? "false", "ALLOW_ANON"),
    disableBrowser: parseBoolean(env.DISABLE_BROWSER ?? "false", "DISABLE_BROWSER"),
    disableImageConversion: parseBoolean(env.DISABLE_IMAGE_CONVERSION ?? "true", "DISABLE_IMAGE_CONVERSION"),
    defaultCacheTtlSeconds: parseInteger(env.DEFAULT_CACHE_TTL_SECONDS ?? "86400", "DEFAULT_CACHE_TTL_SECONDS"),
    maxSourceBytes: parseInteger(env.MAX_SOURCE_BYTES ?? "2097152", "MAX_SOURCE_BYTES"),
    maxOutputBytes: parseInteger(env.MAX_OUTPUT_BYTES ?? "2097152", "MAX_OUTPUT_BYTES"),
    maxBrowserMsPerRequest: parseInteger(env.MAX_BROWSER_MS_PER_REQUEST ?? "10000", "MAX_BROWSER_MS_PER_REQUEST"),
    globalDailyBrowserMsLimit: parseInteger(env.GLOBAL_DAILY_BROWSER_MS_LIMIT ?? "600000", "GLOBAL_DAILY_BROWSER_MS_LIMIT"),
    globalMonthlyBrowserMsLimit: parseInteger(env.GLOBAL_MONTHLY_BROWSER_MS_LIMIT ?? "36000000", "GLOBAL_MONTHLY_BROWSER_MS_LIMIT"),
    globalDailyImageLimit: parseInteger(env.GLOBAL_DAILY_IMAGE_LIMIT ?? "50", "GLOBAL_DAILY_IMAGE_LIMIT"),
    globalMonthlyImageLimit: parseInteger(env.GLOBAL_MONTHLY_IMAGE_LIMIT ?? "500", "GLOBAL_MONTHLY_IMAGE_LIMIT"),
    contentCheck: {
      typesafeApiKey: requireString(env.TYPESAFE_API_KEY, "TYPESAFE_API_KEY"),
      // Pinned: an alias like jev-latest can move and change answers without a deploy.
      model: env.TYPESAFE_MODEL ?? "jev-1.14.0"
    },
    frankensurf: parseFrankensurfConfig(env)
  };
}

function parseFrankensurfConfig(env: Env): FrankensurfConfig | null {
  if (parseBoolean(env.DISABLE_FRANKENSURF ?? "true", "DISABLE_FRANKENSURF")) return null;

  const url = requireString(env.FRANKENSURF_URL, "FRANKENSURF_URL");
  if (!url.startsWith("https://")) throw new Error("FRANKENSURF_URL must be an https:// URL");

  return {
    url: url.replace(/\/+$/, ""),
    apiKey: requireString(env.FRANKENSURF_API_KEY, "FRANKENSURF_API_KEY"),
    timeoutMs: parseInteger(env.FRANKENSURF_TIMEOUT_MS ?? "60000", "FRANKENSURF_TIMEOUT_MS"),
    globalDailyLimit: parseInteger(env.GLOBAL_DAILY_FRANKENSURF_LIMIT ?? "300", "GLOBAL_DAILY_FRANKENSURF_LIMIT"),
    globalMonthlyLimit: parseInteger(env.GLOBAL_MONTHLY_FRANKENSURF_LIMIT ?? "5000", "GLOBAL_MONTHLY_FRANKENSURF_LIMIT")
  };
}

function requireString(value: string | undefined, name: string): string {
  if (!value || value.trim() === "") throw new Error(`${name} is required`);
  return value.trim();
}

function parseBoolean(value: string, name: string): boolean {
  if (value === "true") return true;
  if (value === "false") return false;
  throw new Error(`${name} must be "true" or "false"`);
}

function parseInteger(value: string, name: string): number {
  if (!/^\d+$/.test(value)) {
    throw new Error(`${name} must be a non-negative integer`);
  }

  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed)) {
    throw new Error(`${name} must be a safe integer`);
  }

  return parsed;
}

function assertProductionSecrets(env: Env): void {
  if (env.ENVIRONMENT !== "production") return;

  const missing = [
    ["ADMIN_TOKEN", env.ADMIN_TOKEN],
    ["API_KEY_PEPPER", env.API_KEY_PEPPER],
    ["BROWSER", env.BROWSER]
  ]
    .filter(([, value]) => !value)
    .map(([name]) => name);

  if (missing.length > 0) {
    throw new Error(`Missing required production secrets: ${missing.join(", ")}`);
  }
}
