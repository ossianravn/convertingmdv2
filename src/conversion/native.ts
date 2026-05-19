import type { AppConfig } from "../config";
import { fetchWithLimits } from "../http/fetch-with-limits";
import { ConvertingError } from "../http/errors";
import type { ConversionResult } from "./result";
import { isHtmlContentType, isMarkdownContentType } from "../security/content-type";
import { byteLength } from "../utils/bytes";

export async function tryNativeMarkdown(url: string, config: AppConfig, requestId: string): Promise<ConversionResult> {
  const result = await fetchWithLimits(url, {
    accept: "text/markdown",
    maxBytes: config.maxSourceBytes,
    maxRedirects: 5,
    timeoutMs: 10000,
    userAgent: "converting.md/0.1"
  });

  const sourceContentType = result.response.headers.get("Content-Type");
  const markdown = new TextDecoder().decode(result.body);
  if (!canTreatAsNativeMarkdown(sourceContentType, markdown)) {
    throw new ConvertingError("conversion_failed", "Native Markdown was not available for this URL.", 502);
  }

  const tokens = parseOptionalInt(result.response.headers.get("x-markdown-tokens"));
  const outputBytes = byteLength(markdown);
  if (outputBytes > config.maxOutputBytes) {
    throw new ConvertingError("output_too_large", "Markdown output exceeded the byte limit.", 413);
  }

  return {
    markdown,
    method: "native",
    url: result.url,
    cached: false,
    tokens,
    browserMsUsed: 0,
    outputBytes,
    inputBytes: result.bytesRead,
    sourceContentType,
    warnings: [],
    requestId
  };
}

function canTreatAsNativeMarkdown(contentType: string | null, value: string): boolean {
  if (isMarkdownContentType(contentType)) return true;
  if (isHtmlContentType(contentType)) return false;
  return looksLikeMarkdown(value);
}

function looksLikeMarkdown(value: string): boolean {
  const trimmed = value.trim();
  return /^#\s/m.test(trimmed) || /\n[-*]\s/.test(trimmed) || /\[[^\]]+\]\([^)]+\)/.test(trimmed);
}

function parseOptionalInt(value: string | null): number | null {
  if (!value) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : null;
}
