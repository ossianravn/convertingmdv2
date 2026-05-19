import type { ApiKey } from "./api";

export interface AiToMarkdownOptions {
  conversionOptions?: {
    html?: {
      hostname: string;
      cssSelector?: string;
    };
    image?: {
      descriptionLanguage: string;
    };
  };
}

export interface AiMarkdownResult {
  data?: string | Array<{ name?: string; mimeType?: string; format?: string; tokens?: number; data: string }>;
  markdown?: string;
  tokens?: number;
}

export interface AiBinding {
  toMarkdown(input: Blob, options?: AiToMarkdownOptions): Promise<AiMarkdownResult>;
}

export interface Env {
  AI: AiBinding;
  DB: D1Database;
  CACHE_KV: KVNamespace;
  ADMIN_TOKEN?: string;
  API_KEY_PEPPER?: string;
  CLOUDFLARE_ACCOUNT_ID?: string;
  CLOUDFLARE_BROWSER_API_TOKEN?: string;
  ENVIRONMENT?: string;
  REQUIRE_AUTH?: string;
  ALLOW_ANON?: string;
  DISABLE_BROWSER?: string;
  DISABLE_IMAGE_CONVERSION?: string;
  DEFAULT_CACHE_TTL_SECONDS?: string;
  MAX_SOURCE_BYTES?: string;
  MAX_OUTPUT_BYTES?: string;
  MAX_BROWSER_MS_PER_REQUEST?: string;
  GLOBAL_DAILY_BROWSER_MS_LIMIT?: string;
  GLOBAL_MONTHLY_BROWSER_MS_LIMIT?: string;
  GLOBAL_DAILY_IMAGE_LIMIT?: string;
  GLOBAL_MONTHLY_IMAGE_LIMIT?: string;
}

export interface AppVariables {
  requestId: string;
  apiKey: ApiKey;
}

export type AppEnv = {
  Bindings: Env;
  Variables: AppVariables;
};

