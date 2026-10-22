import { createMarkdownCacheKey } from "../cache/cache-key";
import { readMarkdownCache } from "../cache/markdown-cache";
import { validateAndNormalizeUrl } from "../security/url";
import type { MarkdownRequest } from "../types/api";
import { tryAiMarkdown } from "./ai";
import { convertAuto, settleCandidate } from "./auto-pipeline";
import { tryBrowserMarkdown } from "./browser";
import { tryBrowserFallback } from "./browser-fallback";
import { tryNativeMarkdown } from "./native";
import {
  cacheError,
  canUseBrowserFallback,
  finalizeResult,
  writeSuccessfulCache,
  type ConversionContext
} from "./pipeline-support";
import { assessConversionQuality } from "./quality";
import type { ConversionResult } from "./result";
import { blockedError, verifyConversion } from "./verification";

export type { ConversionContext } from "./pipeline-support";

export async function convertMarkdown(request: MarkdownRequest, context: ConversionContext): Promise<ConversionResult> {
  const normalizedUrl = validateAndNormalizeUrl(request.url);
  const normalizedRequest = withConfiguredAutoBrowserFallback({ ...request, url: normalizedUrl }, context);
  const cacheKey = await createMarkdownCacheKey(normalizedUrl, normalizedRequest);
  const cached = await readCachedResult(cacheKey, normalizedRequest, context);
  if (cached) return handleCachedResult(cacheKey, normalizedRequest, context, cached);

  switch (request.mode) {
    case "native":
      return convertExplicit(cacheKey, normalizedRequest, context, () => tryNativeMarkdown(normalizedUrl, context.config, context.requestId));
    case "ai":
      return convertExplicit(cacheKey, normalizedRequest, context, () =>
        tryAiMarkdown(context.env, normalizedRequest, context.apiKey, context.config, context.requestId)
      );
    case "browser":
      return convertExplicit(cacheKey, normalizedRequest, context, () =>
        tryBrowserMarkdown(context.env, normalizedRequest, context.apiKey, context.config, context.requestId, "explicit")
      );
    case "auto":
      return convertAuto(cacheKey, normalizedRequest, context);
  }
}

// An explicit mode runs only its own strategy, but a block or error page is
// still not returned as a successful conversion.
async function convertExplicit(
  cacheKey: string,
  request: MarkdownRequest,
  context: ConversionContext,
  convert: () => Promise<ConversionResult>
): Promise<ConversionResult> {
  const verdict = await verifyConversion(finalizeResult(await convert(), context), context.config.contentCheck);
  if (verdict.kind === "reject") throw verdict.error;
  if (verdict.kind === "retry") throw blockedError(verdict.reason);

  if (verdict.cacheable) await writeSuccessfulCache(cacheKey, request, context, verdict.result);
  return verdict.result;
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

async function handleCachedResult(
  cacheKey: string,
  request: MarkdownRequest,
  context: ConversionContext,
  cached: ConversionResult
): Promise<ConversionResult> {
  if (!shouldRefreshWeakCache(cached, request, context)) return cached;

  const candidate = await tryBrowserFallback(request, context, cached, "browser_fallback_from_weak_cache");
  if (candidate.result.method !== "browser") return candidate.result;
  return settleCandidate(cacheKey, request, context, candidate);
}

function shouldRefreshWeakCache(result: ConversionResult, request: MarkdownRequest, context: ConversionContext): boolean {
  if (request.mode !== "auto") return false;
  if (result.method === "browser" || result.method === "frankensurf") return false;
  if (!canUseBrowserFallback(request, context.apiKey, context.config)) return false;
  return assessConversionQuality(result).browserRecommended;
}

function withConfiguredAutoBrowserFallback(request: MarkdownRequest, context: ConversionContext): MarkdownRequest {
  if (request.mode !== "auto" || request.browser.enabled || !context.apiKey.autoBrowserFallback || context.config.disableBrowser) {
    return request;
  }

  return { ...request, browser: { ...request.browser, enabled: true } };
}
