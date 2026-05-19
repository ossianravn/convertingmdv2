export type ErrorCode =
  | "missing_api_key"
  | "invalid_api_key"
  | "revoked_api_key"
  | "quota_exceeded"
  | "browser_not_allowed"
  | "image_conversion_not_allowed"
  | "invalid_request"
  | "invalid_url"
  | "blocked_url"
  | "unsupported_scheme"
  | "source_too_large"
  | "output_too_large"
  | "conversion_failed"
  | "browser_budget_exceeded"
  | "global_browser_budget_exceeded"
  | "global_image_budget_exceeded"
  | "cache_error"
  | "cloudflare_api_error"
  | "not_found";

export type ConversionMode = "auto" | "native" | "ai" | "browser";
export type OutputFormat = "markdown" | "json";
export type ApiKeyStatus = "active" | "revoked" | "inactive";
export type BrowserWaitUntil = "domcontentloaded" | "load" | "networkidle0" | "networkidle2";

export interface ApiKey {
  id: string;
  name: string;
  prefix: string;
  status: ApiKeyStatus;
  dailyRequestLimit: number;
  monthlyRequestLimit: number;
  allowBrowser: boolean;
  autoBrowserFallback: boolean;
  dailyBrowserMsLimit: number;
  monthlyBrowserMsLimit: number;
  allowImages: boolean;
  dailyImageLimit: number;
  monthlyImageLimit: number;
  createdAt: string;
  updatedAt: string;
  lastUsedAt: string | null;
}

export interface CacheOptions {
  read: boolean;
  write: boolean;
  ttlSeconds: number;
}

export interface AiOptions {
  allowImages: boolean;
  cssSelector: string | null;
  imageDescriptionLanguage: string;
}

export interface BrowserOptions {
  enabled: boolean;
  waitUntil: BrowserWaitUntil;
  waitForSelector: string | null;
  userAgent: string | null;
  blockAssets: boolean;
}

export interface MarkdownRequest {
  url: string;
  mode: ConversionMode;
  format: OutputFormat;
  cache: CacheOptions;
  ai: AiOptions;
  browser: BrowserOptions;
}

export interface ErrorBody {
  error: {
    code: ErrorCode;
    message: string;
    requestId: string;
  };
}

export interface ApiKeyCreateInput {
  name: string;
  status: ApiKeyStatus;
  dailyRequestLimit: number;
  monthlyRequestLimit: number;
  allowBrowser: boolean;
  autoBrowserFallback: boolean;
  dailyBrowserMsLimit: number;
  monthlyBrowserMsLimit: number;
  allowImages: boolean;
  dailyImageLimit: number;
  monthlyImageLimit: number;
}

export type ApiKeyPatchInput = Partial<ApiKeyCreateInput>;
