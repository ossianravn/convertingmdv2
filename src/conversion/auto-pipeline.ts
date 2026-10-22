import { ConvertingError } from "../http/errors";
import type { MarkdownRequest } from "../types/api";
import { tryAiMarkdown } from "./ai";
import { tryBrowserFallback } from "./browser-fallback";
import { tryFrankensurfMarkdown } from "./frankensurf";
import { tryNativeMarkdown } from "./native";
import {
  canFallBack,
  canUseBrowserFallback,
  finalizeResult,
  withWarnings,
  writeSuccessfulCache,
  type Candidate,
  type ConversionContext
} from "./pipeline-support";
import { assessConversionQuality } from "./quality";
import { blockedError, verdictForStatus, verifyConversion } from "./verification";

// mode=auto: native, then Workers AI, then Browser Run for structurally weak
// output. The result is verified before it is returned or cached; a blocked or
// unrendered page goes to Frankensurf, which fetches from outside Cloudflare.
export async function convertAuto(cacheKey: string, request: MarkdownRequest, context: ConversionContext) {
  let candidate: Candidate;
  try {
    candidate = await firstCandidate(request, context);
  } catch (error) {
    if (!canFallBack(error)) throw error;
    return frankensurfAfterFailure(cacheKey, request, context, error);
  }

  return settleCandidate(cacheKey, request, context, candidate);
}

export async function settleCandidate(
  cacheKey: string,
  request: MarkdownRequest,
  context: ConversionContext,
  candidate: Candidate
) {
  const verdict = await verifyConversion(candidate.result, context.config.contentCheck);
  if (verdict.kind === "reject") throw verdict.error;
  if (verdict.kind === "retry") return frankensurfFallback(cacheKey, request, context, verdict.reason);

  if (candidate.cacheable && verdict.cacheable) await writeSuccessfulCache(cacheKey, request, context, verdict.result);
  return verdict.result;
}

async function firstCandidate(request: MarkdownRequest, context: ConversionContext): Promise<Candidate> {
  try {
    return { result: finalizeResult(await tryNativeMarkdown(request.url, context.config, context.requestId), context), cacheable: true };
  } catch (error) {
    if (!canFallBack(error)) throw error;
  }

  const browserAllowed = canUseBrowserFallback(request, context.apiKey, context.config);
  let ai;
  try {
    ai = finalizeResult(await tryAiMarkdown(context.env, request, context.apiKey, context.config, context.requestId), context);
  } catch (error) {
    if (!browserAllowed || !canFallBack(error)) throw error;
    return tryBrowserFallback(request, context, null, "browser_fallback_from_ai_error");
  }

  // A clear HTTP answer (404, WAF 403/454) is settled before any browser time is spent.
  if (verdictForStatus(ai)) return { result: ai, cacheable: false };

  const assessment = assessConversionQuality(ai);
  const checked = withWarnings(ai, assessment.reasons);
  if (assessment.goodEnough) return { result: checked, cacheable: true };
  if (browserAllowed && assessment.browserRecommended) {
    return tryBrowserFallback(request, context, checked, "browser_fallback_from_weak_ai");
  }
  return { result: checked, cacheable: false };
}

async function frankensurfFallback(cacheKey: string, request: MarkdownRequest, context: ConversionContext, reason: string) {
  const frankensurf = context.config.frankensurf;
  if (!frankensurf) throw blockedError(reason);

  const fetched = await tryFrankensurfMarkdown(context.env, context.config, frankensurf, request.url, context.apiKey.id, context.requestId);
  const result = withWarnings(finalizeResult(fetched, context), [`frankensurf_fallback:${reason}`]);
  const verdict = await verifyConversion(result, context.config.contentCheck);
  if (verdict.kind === "reject") throw verdict.error;
  if (verdict.kind === "retry") throw blockedError(verdict.reason);

  if (verdict.cacheable) await writeSuccessfulCache(cacheKey, request, context, verdict.result);
  return verdict.result;
}

// Our own fetch failed outright (network error, timeout, Browser Run error).
// Frankensurf may still reach the page; if it cannot, the original error is
// the more useful answer.
async function frankensurfAfterFailure(
  cacheKey: string,
  request: MarkdownRequest,
  context: ConversionContext,
  failure: unknown
) {
  if (!context.config.frankensurf) throw failure;
  const reason = failure instanceof ConvertingError ? failure.code : "conversion_error";

  try {
    return await frankensurfFallback(cacheKey, request, context, reason);
  } catch (error) {
    if (error instanceof ConvertingError && error.code === "source_blocked") throw failure;
    throw error;
  }
}
