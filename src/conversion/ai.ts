import type { AppConfig } from "../config";
import { ConvertingError } from "../http/errors";
import { fetchWithLimits } from "../http/fetch-with-limits";
import { isImageContentType, isLikelyImageUrl, isSupportedDocumentContentType } from "../security/content-type";
import { enforceImageQuota } from "../usage/quota";
import type { ApiKey, MarkdownRequest } from "../types/api";
import type { AiToMarkdownOptions, Env } from "../types/env";
import { byteLength } from "../utils/bytes";
import type { ConversionResult } from "./result";

export async function tryAiMarkdown(
  env: Env,
  request: MarkdownRequest,
  apiKey: ApiKey,
  config: AppConfig,
  requestId: string
): Promise<ConversionResult> {
  const fetched = await fetchWithLimits(request.url, {
    accept: "text/html,application/pdf,text/plain,*/*",
    maxBytes: config.maxSourceBytes,
    maxRedirects: 5,
    timeoutMs: 10000,
    userAgent: "converting.md/0.1"
  });
  const sourceContentType = fetched.response.headers.get("Content-Type");
  const imageRequest = isImageRequest(fetched.url, sourceContentType);

  if (imageRequest) {
    await enforceImageQuota(env, apiKey, config, new Date());
  }
  if (!isSupportedDocumentContentType(sourceContentType) && !isImageContentType(sourceContentType)) {
    throw new ConvertingError("conversion_failed", "Source content type is not supported.", 502);
  }

  const aiResult = await env.AI.toMarkdown(new Blob([fetched.body]), conversionOptions(fetched.url, request, imageRequest));
  const markdown = normalizeAiMarkdown(aiResult.data ?? aiResult.markdown);
  const outputBytes = byteLength(markdown);
  if (outputBytes > config.maxOutputBytes) {
    throw new ConvertingError("output_too_large", "Markdown output exceeded the byte limit.", 413);
  }

  return {
    markdown,
    method: "ai",
    url: fetched.url,
    cached: false,
    tokens: aiResult.tokens ?? null,
    browserMsUsed: 0,
    outputBytes,
    inputBytes: fetched.bytesRead,
    sourceContentType,
    warnings: [],
    requestId
  };
}

function isImageRequest(url: string, contentType: string | null): boolean {
  return isImageContentType(contentType) || isLikelyImageUrl(url);
}

function normalizeAiMarkdown(value: unknown): string {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value.map((item) => item?.data).filter(Boolean).join("\n\n");
  throw new ConvertingError("cloudflare_api_error", "Workers AI returned an unexpected Markdown shape.", 502);
}

function conversionOptions(url: string, request: MarkdownRequest, imageRequest: boolean): AiToMarkdownOptions {
  if (imageRequest) {
    return {
      conversionOptions: {
        image: {
          descriptionLanguage: request.ai.imageDescriptionLanguage
        }
      }
    };
  }

  return {
    conversionOptions: {
      html: {
        hostname: new URL(url).hostname,
        ...(request.ai.cssSelector ? { cssSelector: request.ai.cssSelector } : {})
      }
    }
  };
}
