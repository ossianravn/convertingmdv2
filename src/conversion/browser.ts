import type { AppConfig } from "../config";
import { ConvertingError } from "../http/errors";
import { commitBrowserUsage, releaseBrowserReservation, reserveBrowserBudget } from "../usage/reservations";
import type { ApiKey, MarkdownRequest } from "../types/api";
import type { Env } from "../types/env";
import { byteLength } from "../utils/bytes";
import type { ConversionResult } from "./result";

export type BrowserConversionPurpose = "explicit" | "fallback";

export async function tryBrowserMarkdown(
  env: Env,
  request: MarkdownRequest,
  apiKey: ApiKey,
  config: AppConfig,
  requestId: string,
  purpose: BrowserConversionPurpose = "explicit"
): Promise<ConversionResult> {
  const now = new Date();
  const reservation = await reserveBrowserBudget(env, apiKey, config, now, purpose);
  let committed = false;

  if (!env.BROWSER) {
    await releaseBrowserReservation(env, reservation, now);
    throw new ConvertingError("cloudflare_api_error", "Browser Run binding is not configured.", 502);
  }

  try {
    const response = await callBrowserRun(env.BROWSER, request, purpose);

    if (!response.ok) {
      throw new ConvertingError("cloudflare_api_error", "Browser Run Markdown conversion failed.", 502);
    }

    const markdown = await readBrowserMarkdown(response);
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

async function callBrowserRun(
  browser: BrowserRun,
  request: MarkdownRequest,
  purpose: BrowserConversionPurpose
): Promise<Response> {
  try {
    return await browser.quickAction("markdown", browserBody(request, purpose));
  } catch (error) {
    throw new ConvertingError("cloudflare_api_error", errorMessage(error, "Browser Run Markdown conversion failed."), 502);
  }
}

function browserBody(request: MarkdownRequest, purpose: BrowserConversionPurpose): BrowserRunMarkdownOptions {
  const waitUntil = fallbackWaitUntil(request, purpose);
  return {
    url: request.url,
    gotoOptions: {
      waitUntil,
      timeout: 10000
    },
    ...(request.browser.waitForSelector
      ? { waitForSelector: { selector: request.browser.waitForSelector, timeout: 10000 } }
      : {}),
    ...(request.browser.userAgent ? { userAgent: request.browser.userAgent } : {}),
    ...(request.browser.blockAssets ? { rejectRequestPattern: [assetBlockPattern(purpose)] } : {})
  };
}

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

function fallbackWaitUntil(request: MarkdownRequest, purpose: BrowserConversionPurpose): MarkdownRequest["browser"]["waitUntil"] {
  if (purpose !== "fallback") return request.browser.waitUntil;
  return request.browser.waitUntil === "domcontentloaded" ? "networkidle2" : request.browser.waitUntil;
}

function assetBlockPattern(purpose: BrowserConversionPurpose): string {
  if (purpose === "fallback") return "/^.*\\.(png|jpg|jpeg|gif|webp|ico|woff|woff2|ttf|otf|mp4|webm|mp3)(\\?.*)?$/i";
  return "/^.*\\.(css|png|jpg|jpeg|gif|webp|svg|ico|woff|woff2|ttf|otf|mp4|webm|mp3)(\\?.*)?$/i";
}

function readBrowserMs(response: Response, fallback: number): number {
  const rawValue = response.headers.get("X-Browser-Ms-Used");
  if (!rawValue) return fallback;

  const value = Number(rawValue);
  return Number.isSafeInteger(value) && value >= 0 ? value : fallback;
}

async function readBrowserMarkdown(response: Response): Promise<string> {
  const text = await response.text();
  const contentType = response.headers.get("Content-Type") ?? "";
  if (!contentType.toLowerCase().includes("application/json")) return text;

  let value: unknown;
  try {
    value = JSON.parse(text) as unknown;
  } catch {
    throw new ConvertingError("cloudflare_api_error", "Browser Run returned invalid JSON.", 502);
  }
  if (isBrowserJsonResult(value)) return value.result;

  throw new ConvertingError("cloudflare_api_error", "Browser Run returned an unexpected Markdown shape.", 502);
}

function isBrowserJsonResult(value: unknown): value is { result: string } {
  return typeof value === "object" && value !== null && typeof (value as { result?: unknown }).result === "string";
}
