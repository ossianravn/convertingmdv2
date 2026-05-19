import { ConvertingError } from "../http/errors";
import type { BrowserWaitUntil, ConversionMode, MarkdownRequest, OutputFormat } from "../types/api";
import { isRecord, parseJsonObject } from "../utils/json";

const modes = new Set<ConversionMode>(["auto", "native", "ai", "browser"]);
const formats = new Set<OutputFormat>(["markdown", "json"]);
const waitUntilValues = new Set<BrowserWaitUntil>(["domcontentloaded", "load", "networkidle0", "networkidle2"]);

export async function parsePostMarkdownRequest(request: Request, defaultTtlSeconds: number): Promise<MarkdownRequest> {
  const body = parseJsonObject(await readJson(request));
  const url = readRequiredString(body, "url");

  return withDefaults(url, defaultTtlSeconds, body);
}

export function parseQueryMarkdownRequest(url: URL, defaultTtlSeconds: number): MarkdownRequest {
  const targetUrl = url.searchParams.get("url");
  if (!targetUrl) {
    throw new ConvertingError("invalid_request", "Missing url query parameter.", 400);
  }

  return withDefaults(targetUrl, defaultTtlSeconds, {});
}

export function parseConvenienceMarkdownRequest(url: URL, defaultTtlSeconds: number): MarkdownRequest {
  const targetUrl = `${url.pathname.slice(1)}${url.search}`;
  return withDefaults(targetUrl, defaultTtlSeconds, {});
}

export function isConvenienceMarkdownPath(url: URL): boolean {
  const path = url.pathname.slice(1);
  return path.startsWith("https://") || path.startsWith("http://");
}

async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    throw new ConvertingError("invalid_request", "Request body must be valid JSON.", 400);
  }
}

function withDefaults(url: string, defaultTtlSeconds: number, body: Record<string, unknown>): MarkdownRequest {
  const cache = isRecord(body["cache"]) ? body["cache"] : {};
  const ai = isRecord(body["ai"]) ? body["ai"] : {};
  const browser = isRecord(body["browser"]) ? body["browser"] : {};

  return {
    url,
    mode: readEnum(body["mode"], modes, "mode", "auto"),
    format: readEnum(body["format"], formats, "format", "markdown"),
    cache: {
      read: readBoolean(cache["read"], true, "cache.read"),
      write: readBoolean(cache["write"], true, "cache.write"),
      ttlSeconds: readNumber(cache["ttlSeconds"], defaultTtlSeconds, "cache.ttlSeconds")
    },
    ai: {
      allowImages: readBoolean(ai["allowImages"], false, "ai.allowImages"),
      cssSelector: readNullableString(ai["cssSelector"], "ai.cssSelector"),
      imageDescriptionLanguage: readString(ai["imageDescriptionLanguage"], "en", "ai.imageDescriptionLanguage")
    },
    browser: {
      enabled: readBoolean(browser["enabled"], false, "browser.enabled"),
      waitUntil: readEnum(browser["waitUntil"], waitUntilValues, "browser.waitUntil", "domcontentloaded"),
      waitForSelector: readNullableString(browser["waitForSelector"], "browser.waitForSelector"),
      userAgent: readNullableString(browser["userAgent"], "browser.userAgent"),
      blockAssets: readBoolean(browser["blockAssets"], true, "browser.blockAssets")
    }
  };
}

function readRequiredString(body: Record<string, unknown>, key: string): string {
  const value = body[key];
  if (typeof value !== "string" || value.length === 0) {
    throw new ConvertingError("invalid_request", `${key} must be a non-empty string.`, 400);
  }

  return value;
}

function readString(value: unknown, fallback: string, path: string): string {
  if (value === undefined) return fallback;
  if (typeof value === "string" && value.length > 0) return value;
  throw new ConvertingError("invalid_request", `${path} must be a non-empty string.`, 400);
}

function readNullableString(value: unknown, path: string): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value === "string") return value;
  throw new ConvertingError("invalid_request", `${path} must be a string or null.`, 400);
}

function readBoolean(value: unknown, fallback: boolean, path: string): boolean {
  if (value === undefined) return fallback;
  if (typeof value === "boolean") return value;
  throw new ConvertingError("invalid_request", `${path} must be a boolean.`, 400);
}

function readNumber(value: unknown, fallback: number, path: string): number {
  if (value === undefined) return fallback;
  if (typeof value === "number" && Number.isSafeInteger(value) && value >= 0) return value;
  throw new ConvertingError("invalid_request", `${path} must be a non-negative integer.`, 400);
}

function readEnum<T extends string>(value: unknown, values: Set<T>, path: string, fallback: T): T {
  if (value === undefined) return fallback;
  if (typeof value === "string" && values.has(value as T)) return value as T;
  throw new ConvertingError("invalid_request", `${path} is not supported.`, 400);
}

