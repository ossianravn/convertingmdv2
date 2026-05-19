import type { MarkdownRequest } from "../types/api";
import { sha256Hex } from "../utils/crypto";

export async function createMarkdownCacheKey(normalizedUrl: string, request: MarkdownRequest): Promise<string> {
  const digest = await sha256Hex(JSON.stringify(cacheKeyPayload(normalizedUrl, request)));
  return `md:v1:${digest}`;
}

function cacheKeyPayload(normalizedUrl: string, request: MarkdownRequest): Record<string, unknown> {
  return {
    url: normalizedUrl,
    mode: request.mode,
    cssSelector: request.ai.cssSelector,
    browserWaitUntil: request.browser.waitUntil,
    browserWaitForSelector: request.browser.waitForSelector,
    browserBlockAssets: request.browser.blockAssets,
    userAgent: request.browser.userAgent,
    imageLanguage: request.ai.imageDescriptionLanguage,
    allowImages: request.ai.allowImages,
    outputFormatVersion: 1
  };
}

