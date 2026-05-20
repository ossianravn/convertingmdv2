import { afterEach, describe, expect, it, vi } from "vitest";
import { createMarkdownCacheKey } from "../src/cache/cache-key";
import { parseConfig } from "../src/config";
import { convertMarkdown, type ConversionContext } from "../src/conversion/orchestrator";
import type { ConversionResult } from "../src/conversion/result";
import { normalizeMarkdownText } from "../src/conversion/text-normalization";
import type { ApiKey, MarkdownRequest } from "../src/types/api";
import { byteLength } from "../src/utils/bytes";
import { makeEnv } from "./helpers";
import { createMemoryD1 } from "./fakes/d1";
import { createMemoryKv } from "./fakes/kv";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("Markdown text normalization", () => {
  it("decodes HTML character references and normalizes Unicode outside code", () => {
    const input = [
      "---",
      "title: Flere lejligheder til salg i K&#xF8;benhavn",
      "description: S&#xE6;lgere p&#xE5; markedet&#xA;",
      "---",
      "",
      "Cafe\u0301 &amp; bolig&nbsp;marked",
      "`p&#xE5;`",
      "```html",
      "&lt;main&gt;p&#xE5;&lt;/main&gt;",
      "```"
    ].join("\n");

    expect(normalizeMarkdownText(input)).toBe([
      "---",
      "title: Flere lejligheder til salg i København",
      "description: Sælgere på markedet ",
      "---",
      "",
      "Café & bolig marked",
      "`p&#xE5;`",
      "```html",
      "&lt;main&gt;p&#xE5;&lt;/main&gt;",
      "```"
    ].join("\n"));
  });

  it("normalizes native, AI, browser, and cached conversion results", async () => {
    await expect(strategyResult("native")).resolves.toMatchObject({ markdown: "# København" });
    await expect(strategyResult("ai")).resolves.toMatchObject({ markdown: "# København" });
    await expect(strategyResult("browser")).resolves.toMatchObject({ markdown: "# København" });
    await expect(cachedResult()).resolves.toMatchObject({ markdown: "# København", outputBytes: byteLength("# København") });
  });
});

async function strategyResult(mode: "native" | "ai" | "browser"): Promise<ConversionResult> {
  const d1 = createMemoryD1();
  const env = makeEnv({
    DB: d1.database,
    AI: { async toMarkdown() { return { markdown: "# K&#xF8;benhavn" }; } },
    CLOUDFLARE_ACCOUNT_ID: "acct",
    CLOUDFLARE_BROWSER_API_TOKEN: "token"
  });

  vi.stubGlobal("fetch", fetchForMode(mode));
  return convertMarkdown(markdownRequest({ mode }), context(env, { allowBrowser: true }));
}

async function cachedResult(): Promise<ConversionResult> {
  const request = markdownRequest({ mode: "ai" });
  const cacheKey = await createMarkdownCacheKey("https://example.com/page", request);
  const kv = createMemoryKv({ [cacheKey]: conversionResult("# K&#xF8;benhavn") });
  const env = makeEnv({ CACHE_KV: kv.namespace });
  const fetchSpy = vi.fn();
  vi.stubGlobal("fetch", fetchSpy);

  const result = await convertMarkdown(request, context(env));

  expect(fetchSpy).not.toHaveBeenCalled();
  return result;
}

function fetchForMode(mode: "native" | "ai" | "browser") {
  if (mode === "browser") {
    return vi.fn(async () => new Response("# K&#xF8;benhavn", { headers: { "X-Browser-Ms-Used": "1" } }));
  }

  return vi.fn(async () => new Response("# K&#xF8;benhavn", { headers: { "Content-Type": mode === "native" ? "text/markdown" : "text/html" } }));
}

function context(env: ConversionContext["env"], apiKeyOverrides: Partial<ApiKey> = {}): ConversionContext {
  return {
    env,
    apiKey: apiKey(apiKeyOverrides),
    config: parseConfig(env),
    requestId: "req_normalize",
    now: new Date("2026-05-20T12:00:00.000Z")
  };
}

function markdownRequest(overrides: Partial<MarkdownRequest>): MarkdownRequest {
  return {
    url: "https://example.com/page",
    mode: "auto",
    format: "markdown",
    cache: { read: true, write: true, ttlSeconds: 86400 },
    ai: { allowImages: false, cssSelector: null, imageDescriptionLanguage: "en" },
    browser: { enabled: true, waitUntil: "domcontentloaded", waitForSelector: null, userAgent: null, blockAssets: true },
    ...overrides
  };
}

function apiKey(overrides: Partial<ApiKey> = {}): ApiKey {
  return {
    id: "key_normalize",
    name: "Normalize key",
    prefix: "cmd_live_norm",
    status: "active",
    dailyRequestLimit: 1000,
    monthlyRequestLimit: 25000,
    allowBrowser: false,
    autoBrowserFallback: false,
    dailyBrowserMsLimit: 20000,
    monthlyBrowserMsLimit: 40000,
    allowImages: false,
    dailyImageLimit: 0,
    monthlyImageLimit: 0,
    createdAt: "2026-05-20T00:00:00.000Z",
    updatedAt: "2026-05-20T00:00:00.000Z",
    lastUsedAt: null,
    ...overrides
  };
}

function conversionResult(markdown: string): ConversionResult {
  return {
    markdown,
    method: "ai",
    url: "https://example.com/page",
    cached: false,
    tokens: null,
    browserMsUsed: 0,
    outputBytes: byteLength(markdown),
    inputBytes: 100,
    sourceContentType: "text/html",
    warnings: [],
    requestId: "req_cached"
  };
}
