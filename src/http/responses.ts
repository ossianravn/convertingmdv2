import { MARKDOWN_CONTENT_TYPE, JSON_CONTENT_TYPE, requestHeaders } from "./headers";
import type { ErrorBody, OutputFormat } from "../types/api";
import type { ConversionResult } from "../conversion/result";
import type { ConvertingError } from "./errors";

export interface RateLimitHeaders {
  dailyRemaining: number;
  monthlyRemaining: number;
}

export function jsonResponse(body: unknown, status: number, requestId: string, headers?: HeadersInit): Response {
  const responseHeaders = requestHeaders(requestId);
  responseHeaders.set("Content-Type", JSON_CONTENT_TYPE);
  setHeaders(responseHeaders, headers);
  return new Response(JSON.stringify(body), { status, headers: responseHeaders });
}

export function errorResponse(error: ConvertingError, requestId: string): Response {
  const body: ErrorBody = {
    error: {
      code: error.code,
      message: error.message,
      requestId
    }
  };

  return jsonResponse(body, error.status, requestId);
}

export function conversionResponse(
  result: ConversionResult,
  format: OutputFormat,
  requestId: string,
  rateLimit?: RateLimitHeaders
): Response {
  const headers = conversionHeaders(result, requestId, rateLimit);
  if (format === "json") {
    return jsonResponse(result, 200, requestId, headers);
  }

  headers.set("Content-Type", MARKDOWN_CONTENT_TYPE);
  return new Response(result.markdown, { status: 200, headers });
}

function conversionHeaders(result: ConversionResult, requestId: string, rateLimit?: RateLimitHeaders): Headers {
  const headers = requestHeaders(requestId);
  headers.set("X-Converting-Method", result.method);
  headers.set("X-Converting-Cache", result.cached ? "HIT" : "MISS");
  headers.set("X-Converting-Source-Url", result.url);
  headers.set("X-Converting-Output-Bytes", String(result.outputBytes));

  if (result.sourceContentType) headers.set("X-Converting-Source-Content-Type", result.sourceContentType);
  if (result.tokens !== null) headers.set("X-Markdown-Tokens", String(result.tokens));
  if (result.browserMsUsed > 0) headers.set("X-Browser-Ms-Used", String(result.browserMsUsed));
  if (result.warnings.length > 0) headers.set("X-Converting-Warnings", result.warnings.join(","));
  if (rateLimit) {
    headers.set("X-RateLimit-Remaining-Day", String(rateLimit.dailyRemaining));
    headers.set("X-RateLimit-Remaining-Month", String(rateLimit.monthlyRemaining));
  }

  return headers;
}

function setHeaders(target: Headers, headers?: HeadersInit): void {
  if (!headers) return;
  new Headers(headers).forEach((value, key) => target.set(key, value));
}
