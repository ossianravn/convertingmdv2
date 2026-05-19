import type { AppConfig } from "../config";
import { ConvertingError } from "../http/errors";
import { commitBrowserUsage, releaseBrowserReservation, reserveBrowserBudget } from "../usage/reservations";
import type { ApiKey, MarkdownRequest } from "../types/api";
import type { Env } from "../types/env";
import { byteLength } from "../utils/bytes";
import type { ConversionResult } from "./result";

export async function tryBrowserMarkdown(
  env: Env,
  request: MarkdownRequest,
  apiKey: ApiKey,
  config: AppConfig,
  requestId: string
): Promise<ConversionResult> {
  const now = new Date();
  const reservation = await reserveBrowserBudget(env, apiKey, config, now);
  let committed = false;

  if (!env.CLOUDFLARE_ACCOUNT_ID || !env.CLOUDFLARE_BROWSER_API_TOKEN) {
    await releaseBrowserReservation(env, reservation, now);
    throw new ConvertingError("cloudflare_api_error", "Browser Run credentials are not configured.", 502);
  }

  try {
    const response = await fetch(browserEndpoint(env.CLOUDFLARE_ACCOUNT_ID), {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.CLOUDFLARE_BROWSER_API_TOKEN}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(browserBody(request))
    });

    if (!response.ok) {
      throw new ConvertingError("cloudflare_api_error", "Browser Run Markdown conversion failed.", 502);
    }

    const markdown = await response.text();
    const browserMsUsed = readBrowserMs(response, config.maxBrowserMsPerRequest);
    await commitBrowserUsage(env, reservation, browserMsUsed, now);
    committed = true;

    const outputBytes = byteLength(markdown);
    if (outputBytes > config.maxOutputBytes) {
      throw new ConvertingError("output_too_large", "Markdown output exceeded the byte limit.", 413);
    }

    return {
      markdown,
      method: "browser",
      url: request.url,
      cached: false,
      tokens: null,
      browserMsUsed,
      outputBytes,
      inputBytes: 0,
      sourceContentType: "text/html",
      warnings: [],
      requestId
    };
  } catch (error) {
    if (!committed) {
      await releaseBrowserReservation(env, reservation, now);
    }
    throw error;
  }
}

function browserEndpoint(accountId: string): string {
  return `https://api.cloudflare.com/client/v4/accounts/${accountId}/browser-rendering/markdown`;
}

function browserBody(request: MarkdownRequest): Record<string, unknown> {
  return {
    url: request.url,
    gotoOptions: {
      waitUntil: request.browser.waitUntil,
      timeout: 10000
    },
    ...(request.browser.blockAssets ? { rejectRequestPattern: [assetBlockPattern()] } : {})
  };
}

function assetBlockPattern(): string {
  return "/^.*\\.(css|png|jpg|jpeg|gif|webp|svg|ico|woff|woff2|ttf|otf|mp4|webm|mp3)(\\?.*)?$/i";
}

function readBrowserMs(response: Response, fallback: number): number {
  const rawValue = response.headers.get("X-Browser-Ms-Used");
  if (!rawValue) return fallback;

  const value = Number(rawValue);
  return Number.isSafeInteger(value) && value >= 0 ? value : fallback;
}
