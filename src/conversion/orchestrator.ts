import type { AppConfig } from "../config";
import { createMarkdownCacheKey } from "../cache/cache-key";
import { readMarkdownCache, writeMarkdownCache } from "../cache/markdown-cache";
import { ConvertingError } from "../http/errors";
import { validateAndNormalizeUrl } from "../security/url";
import type { ApiKey, MarkdownRequest } from "../types/api";
import type { Env } from "../types/env";
import { tryAiMarkdown } from "./ai";
import { tryBrowserMarkdown } from "./browser";
import { tryNativeMarkdown } from "./native";
import { isGoodEnough } from "./quality";
import type { ConversionResult } from "./result";

export interface ConversionContext {
  env: Env;
  apiKey: ApiKey;
  config: AppConfig;
  requestId: string;
  now: Date;
}

export async function convertMarkdown(request: MarkdownRequest, context: ConversionContext): Promise<ConversionResult> {
  const normalizedUrl = validateAndNormalizeUrl(request.url);
  const normalizedRequest = { ...request, url: normalizedUrl };
  const cacheKey = await createMarkdownCacheKey(normalizedUrl, normalizedRequest);
  const cached = await readCachedResult(cacheKey, normalizedRequest, context);
  if (cached) return cached;

  if (request.mode === "native") {
    return convertWithCache(cacheKey, normalizedRequest, context, () => tryNativeMarkdown(normalizedUrl, context.config, context.requestId));
  }

  if (request.mode === "ai") {
    return convertWithCache(cacheKey, normalizedRequest, context, () => tryAiMarkdown(context.env, normalizedRequest, context.apiKey, context.config, context.requestId));
  }

  if (request.mode === "browser") {
    return convertWithCache(cacheKey, normalizedRequest, context, () => tryBrowserMarkdown(context.env, normalizedRequest, context.apiKey, context.config, context.requestId));
  }

  return convertAuto(cacheKey, normalizedRequest, context);
}

async function convertAuto(
  cacheKey: string,
  request: MarkdownRequest,
  context: ConversionContext
): Promise<ConversionResult> {
  try {
    return await convertWithCache(cacheKey, request, context, () => tryNativeMarkdown(request.url, context.config, context.requestId));
  } catch (error) {
    if (!canFallBack(error)) throw error;
  }

  let aiError: unknown;
  try {
    const aiResult = await tryAiMarkdown(context.env, request, context.apiKey, context.config, context.requestId);
    if (isGoodEnough(aiResult.markdown, aiResult.inputBytes)) {
      await writeSuccessfulCache(cacheKey, request, context, aiResult);
      return aiResult;
    }

    if (canUseBrowserFallback(request, context.apiKey, context.config)) {
      return convertWithCache(cacheKey, request, context, () => tryBrowserMarkdown(context.env, request, context.apiKey, context.config, context.requestId));
    }

    await writeSuccessfulCache(cacheKey, request, context, aiResult);
    return aiResult;
  } catch (error) {
    aiError = error;
  }

  if (canUseBrowserFallback(request, context.apiKey, context.config) && canFallBack(aiError)) {
    return convertWithCache(cacheKey, request, context, () => tryBrowserMarkdown(context.env, request, context.apiKey, context.config, context.requestId));
  }

  throw aiError;
}

async function convertWithCache(
  cacheKey: string,
  request: MarkdownRequest,
  context: ConversionContext,
  convert: () => Promise<ConversionResult>
): Promise<ConversionResult> {
  const result = await convert();
  await writeSuccessfulCache(cacheKey, request, context, result);
  return result;
}

async function readCachedResult(
  cacheKey: string,
  request: MarkdownRequest,
  context: ConversionContext
): Promise<ConversionResult | null> {
  if (!request.cache.read) return null;

  try {
    const result = await readMarkdownCache(context.env, cacheKey);
    return result ? { ...result, cached: true, requestId: context.requestId } : null;
  } catch (error) {
    throw cacheError(error, "Cache read failed.");
  }
}

async function writeSuccessfulCache(
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

function canUseBrowserFallback(request: MarkdownRequest, apiKey: ApiKey, config: AppConfig): boolean {
  return request.browser.enabled && apiKey.allowBrowser && apiKey.autoBrowserFallback && !config.disableBrowser;
}

function canFallBack(error: unknown): boolean {
  if (!(error instanceof ConvertingError)) return false;
  return error.code === "conversion_failed" || error.code === "cloudflare_api_error";
}

function cacheError(error: unknown, message: string): ConvertingError {
  if (error instanceof ConvertingError) return error;
  return new ConvertingError("cache_error", message, 500);
}
