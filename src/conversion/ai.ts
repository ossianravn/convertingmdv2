import type { AppConfig } from "../config";
import { ConvertingError } from "../http/errors";
import { fetchWithLimits } from "../http/fetch-with-limits";
import { inferHtmlContentType, isImageContentType, isLikelyImageUrl, isSupportedDocumentContentType } from "../security/content-type";
import { enforceImageQuota } from "../usage/quota";
import type { ApiKey, MarkdownRequest } from "../types/api";
import type { AiMarkdownDocument, AiToMarkdownOptions, Env } from "../types/env";
import { byteLength } from "../utils/bytes";
import type { ConversionResult } from "./result";
import { htmlSourceWarnings } from "./source-profile";

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
    redirectMode: "follow",
    timeoutMs: 10000,
    userAgent: "converting.md/0.1"
  });
  const sourceContentType = inferHtmlContentType(fetched.response.headers.get("Content-Type"), fetched.body);
  const imageRequest = isImageRequest(fetched.url, sourceContentType);
  const warnings = htmlSourceWarnings(fetched.body, sourceContentType);

  if (imageRequest) {
    await enforceImageQuota(env, apiKey, config, new Date());
  }
  if (!isSupportedDocumentContentType(sourceContentType) && !isImageContentType(sourceContentType)) {
    throw new ConvertingError("conversion_failed", "Source content type is not supported.", 502);
  }

  const document = createMarkdownDocument(fetched.url, fetched.body, sourceContentType);
  const aiResult = await env.AI.toMarkdown(document, conversionOptions(fetched.url, request, imageRequest));
  const markdown = normalizeAiMarkdown(aiResult);
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
    warnings,
    requestId
  };
}

function isImageRequest(url: string, contentType: string | null): boolean {
  return isImageContentType(contentType) || isLikelyImageUrl(url);
}

function createMarkdownDocument(url: string, body: ArrayBuffer, contentType: string | null): AiMarkdownDocument {
  const mediaType = normalizeSourceMediaType(contentType);
  return {
    name: documentName(url, mediaType),
    blob: new Blob([body], { type: mediaType })
  };
}

function normalizeSourceMediaType(contentType: string | null): string {
  const mediaType = contentType?.split(";")[0]?.trim().toLowerCase() ?? "";
  if (!mediaType) {
    throw new ConvertingError("conversion_failed", "Source content type is not supported.", 502);
  }
  return mediaType;
}

function documentName(url: string, mediaType: string): string {
  const baseName = safeBaseName(new URL(url).pathname.split("/").filter(Boolean).pop() ?? "source");
  const extension = extensionForMediaType(mediaType);
  return baseName.toLowerCase().endsWith(extension) ? baseName : `${baseName}${extension}`;
}

function safeBaseName(value: string): string {
  const safe = value.replace(/[^A-Za-z0-9._-]+/g, "_").replace(/^_+|_+$/g, "");
  return safe || "source";
}

function extensionForMediaType(mediaType: string): string {
  if (mediaType === "application/pdf") return ".pdf";
  if (mediaType === "text/plain") return ".txt";
  if (mediaType === "image/jpeg") return ".jpg";
  if (mediaType === "image/png") return ".png";
  if (mediaType === "image/webp") return ".webp";
  if (mediaType === "image/svg+xml") return ".svg";
  if (mediaType === "image/gif") return ".gif";
  return ".html";
}

function normalizeAiMarkdown(result: { data?: unknown; markdown?: unknown; format?: string; error?: string }): string {
  if (result.format === "error") {
    throw new ConvertingError("cloudflare_api_error", result.error ?? "Workers AI Markdown conversion failed.", 502);
  }

  const value = result.data ?? result.markdown;
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
