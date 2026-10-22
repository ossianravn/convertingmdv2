import type { AppConfig } from "../config";
import { writeMarkdownCache } from "../cache/markdown-cache";
import { ConvertingError } from "../http/errors";
import type { ApiKey, MarkdownRequest } from "../types/api";
import type { Env } from "../types/env";
import type { ConversionResult } from "./result";
import { normalizeConversionResult } from "./text-normalization";

export interface ConversionContext {
  env: Env;
  apiKey: ApiKey;
  config: AppConfig;
  requestId: string;
  now: Date;
}

// A conversion that has not yet been verified. `cacheable` is the structural
// quality check's opinion; the content check must agree before anything is cached.
export interface Candidate {
  result: ConversionResult;
  cacheable: boolean;
}

export function finalizeResult(result: ConversionResult, context: ConversionContext): ConversionResult {
  return normalizeConversionResult(result, context.config.maxOutputBytes);
}

export function withWarnings(result: ConversionResult, warnings: string[]): ConversionResult {
  return { ...result, warnings: [...new Set([...result.warnings, ...warnings])] };
}

export async function writeSuccessfulCache(
  cacheKey: string,
  request: MarkdownRequest,
  context: ConversionContext,
  result: ConversionResult
): Promise<void> {
  if (!request.cache.write) return;
  if (result.outputBytes > context.config.maxOutputBytes) return;

  try {
    await writeMarkdownCache(context.env, cacheKey, { ...result, cached: false }, request.cache.ttlSeconds);
  } catch (error) {
    throw cacheError(error, "Cache write failed.");
  }
}

export function cacheError(error: unknown, message: string): ConvertingError {
  if (error instanceof ConvertingError) return error;
  return new ConvertingError("cache_error", message, 500);
}

export function canFallBack(error: unknown): boolean {
  if (!(error instanceof ConvertingError)) return false;
  return error.code === "conversion_failed" || error.code === "cloudflare_api_error";
}

export function canUseBrowserFallback(request: MarkdownRequest, apiKey: ApiKey, config: AppConfig): boolean {
  return request.browser.enabled && apiKey.autoBrowserFallback && !config.disableBrowser;
}
