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
import { assessConversionQuality, meaningfulMarkdownChars } from "./quality";
import type { ConversionResult } from "./result";
import { normalizeConversionResult } from "./text-normalization";

export interface ConversionContext {
  env: Env;
  apiKey: ApiKey;
  config: AppConfig;
  requestId: string;
  now: Date;
}

export async function convertMarkdown(request: MarkdownRequest, context: ConversionContext): Promise<ConversionResult> {
  const normalizedUrl = validateAndNormalizeUrl(request.url);
  const normalizedRequest = withConfiguredAutoBrowserFallback({ ...request, url: normalizedUrl }, context);
  const cacheKey = await createMarkdownCacheKey(normalizedUrl, normalizedRequest);
  const cached = await readCachedResult(cacheKey, normalizedRequest, context);
  if (cached) return handleCachedResult(cacheKey, normalizedRequest, context, cached);

  if (request.mode === "native") {
    return convertWithCache(cacheKey, normalizedRequest, context, () => tryNativeMarkdown(normalizedUrl, context.config, context.requestId));
  }

  if (request.mode === "ai") {
    return convertWithCache(cacheKey, normalizedRequest, context, () => tryAiMarkdown(context.env, normalizedRequest, context.apiKey, context.config, context.requestId));
  }

  if (request.mode === "browser") {
    return convertWithCache(cacheKey, normalizedRequest, context, () =>
      tryBrowserMarkdown(context.env, normalizedRequest, context.apiKey, context.config, context.requestId, "explicit")
    );
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
    const aiResult = withQualityWarnings(
      finalizeResult(await tryAiMarkdown(context.env, request, context.apiKey, context.config, context.requestId), context)
    );
    const aiAssessment = assessConversionQuality(aiResult);
    if (aiAssessment.goodEnough) {
      await writeSuccessfulCache(cacheKey, request, context, aiResult);
      return aiResult;
    }

    if (canUseBrowserFallback(request, context.apiKey, context.config) && aiAssessment.browserRecommended) {
      const fallback = await tryBrowserFallback(cacheKey, request, context, aiResult, "browser_fallback_from_weak_ai");
      if (fallback) return fallback;
    }

    return aiResult;
  } catch (error) {
    aiError = error;
  }

  if (canUseBrowserFallback(request, context.apiKey, context.config) && canFallBack(aiError)) {
    const fallback = await tryBrowserFallback(cacheKey, request, context, null, "browser_fallback_from_ai_error");
    if (fallback) return fallback;
  }

  throw aiError;
}

async function convertWithCache(
  cacheKey: string,
  request: MarkdownRequest,
  context: ConversionContext,
  convert: () => Promise<ConversionResult>
): Promise<ConversionResult> {
  const result = finalizeResult(await convert(), context);
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
    return result
      ? finalizeResult({ ...result, warnings: result.warnings ?? [], cached: true, requestId: context.requestId }, context)
      : null;
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

async function handleCachedResult(
  cacheKey: string,
  request: MarkdownRequest,
  context: ConversionContext,
  cached: ConversionResult
): Promise<ConversionResult> {
  if (!shouldRefreshWeakCache(cached, request, context)) return cached;
  const fallback = await tryBrowserFallback(cacheKey, request, context, cached, "browser_fallback_from_weak_cache");
  return fallback ?? cached;
}

function shouldRefreshWeakCache(result: ConversionResult, request: MarkdownRequest, context: ConversionContext): boolean {
  if (request.mode !== "auto") return false;
  if (result.method === "browser") return false;
  if (!canUseBrowserFallback(request, context.apiKey, context.config)) return false;
  return assessConversionQuality(result).browserRecommended;
}

async function tryBrowserFallback(
  cacheKey: string,
  request: MarkdownRequest,
  context: ConversionContext,
  primary: ConversionResult | null,
  trigger: string
): Promise<ConversionResult | null> {
  try {
    const browser = withWarnings(
      finalizeResult(await tryBrowserMarkdown(context.env, request, context.apiKey, context.config, context.requestId, "fallback"), context),
      [trigger]
    );
    const assessment = assessConversionQuality(browser);
    const result = withWarnings(browser, assessment.goodEnough ? [] : ["browser_fallback_weak_output", ...assessment.reasons]);

    if (assessment.goodEnough || !primary || isMeaningfullyBetter(result, primary)) {
      if (assessment.cacheable) await writeSuccessfulCache(cacheKey, request, context, result);
      return result;
    }

    return withWarnings(primary, [trigger, "browser_fallback_weak_output", ...assessment.reasons]);
  } catch (error) {
    if (!primary) throw error;
    return withWarnings(primary, [trigger, fallbackFailureWarning(error)]);
  }
}

function withQualityWarnings(result: ConversionResult): ConversionResult {
  const assessment = assessConversionQuality(result);
  return withWarnings(result, assessment.reasons);
}

function finalizeResult(result: ConversionResult, context: ConversionContext): ConversionResult {
  return normalizeConversionResult(result, context.config.maxOutputBytes);
}

function withWarnings(result: ConversionResult, warnings: string[]): ConversionResult {
  return { ...result, warnings: [...new Set([...result.warnings, ...warnings])] };
}

function isMeaningfullyBetter(candidate: ConversionResult, primary: ConversionResult): boolean {
  const candidateChars = meaningfulMarkdownChars(candidate.markdown);
  const primaryChars = meaningfulMarkdownChars(primary.markdown);
  return candidateChars >= 300 && candidateChars >= primaryChars * 2;
}

function fallbackFailureWarning(error: unknown): string {
  if (error instanceof ConvertingError) return `browser_fallback_failed:${error.code}`;
  return "browser_fallback_failed:unknown";
}

function canUseBrowserFallback(request: MarkdownRequest, apiKey: ApiKey, config: AppConfig): boolean {
  return request.browser.enabled && apiKey.autoBrowserFallback && !config.disableBrowser;
}

function withConfiguredAutoBrowserFallback(request: MarkdownRequest, context: ConversionContext): MarkdownRequest {
  if (request.mode !== "auto" || request.browser.enabled || !context.apiKey.autoBrowserFallback || context.config.disableBrowser) {
    return request;
  }

  return { ...request, browser: { ...request.browser, enabled: true } };
}

function canFallBack(error: unknown): boolean {
  if (!(error instanceof ConvertingError)) return false;
  return error.code === "conversion_failed" || error.code === "cloudflare_api_error";
}

function cacheError(error: unknown, message: string): ConvertingError {
  if (error instanceof ConvertingError) return error;
  return new ConvertingError("cache_error", message, 500);
}
