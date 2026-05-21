import { afterEach, describe, expect, it, vi } from "vitest";
import { app } from "../src/app";
import { hashApiKey } from "../src/auth/hash";
import { createMarkdownCacheKey } from "../src/cache/cache-key";
import { parseConfig } from "../src/config";
import { convertMarkdown, type ConversionContext } from "../src/conversion/orchestrator";
import type { ConversionResult } from "../src/conversion/result";
import type { ApiKey, MarkdownRequest } from "../src/types/api";
import { makeEnv } from "./helpers";
import { apiKeyRow, createMemoryD1 } from "./fakes/d1";
import { createMemoryKv, type MemoryKv } from "./fakes/kv";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("markdown cache", () => {
  it("hits cache on the second identical request without fetching again", async () => {
    const kv = createMemoryKv();
    const fetchSpy = vi.fn(async () => new Response("# Cached", { headers: { "Content-Type": "text/markdown" } }));
    vi.stubGlobal("fetch", fetchSpy);
    const request = markdownRequest({ mode: "native" });
    const firstContext = context({ CACHE_KV: kv.namespace });
    const secondContext = context({ CACHE_KV: kv.namespace, requestId: "req_second" });

    const first = await convertMarkdown(request, firstContext);
    const second = await convertMarkdown(request, secondContext);

    expect(first.cached).toBe(false);
    expect(second).toMatchObject({ markdown: "# Cached", cached: true, requestId: "req_second" });
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it("creates different cache keys for different conversion options", async () => {
    const plainKey = await createMarkdownCacheKey("https://example.com/page", markdownRequest({}));
    const selectedKey = await createMarkdownCacheKey(
      "https://example.com/page",
      markdownRequest({ ai: { cssSelector: "main" } })
    );

    expect(plainKey.startsWith("md:v4:")).toBe(true);
    expect(selectedKey).not.toBe(plainKey);
  });

  it("separates browser-enabled fallback cache from default non-browser requests", async () => {
    const defaultKey = await createMarkdownCacheKey("https://example.com/page", markdownRequest({}));
    const browserKey = await createMarkdownCacheKey(
      "https://example.com/page",
      markdownRequest({ browser: { enabled: true } })
    );

    expect(browserKey).not.toBe(defaultKey);
  });

  it("does not cache conversions that fail the output byte limit", async () => {
    const kv = createMemoryKv();
    vi.stubGlobal("fetch", vi.fn(async () => new Response("# Too large", { headers: { "Content-Type": "text/markdown" } })));

    await expect(
      convertMarkdown(markdownRequest({ mode: "native" }), context({ CACHE_KV: kv.namespace, MAX_OUTPUT_BYTES: "3" }))
    ).rejects.toThrow("Markdown output exceeded the byte limit.");
    expect(kv.writes).toHaveLength(0);
  });

  it("reconstructs cached conversion metadata into response headers", async () => {
    const request = markdownRequest({});
    const cacheKey = await createMarkdownCacheKey("https://example.com/page", request);
    const kv = createMemoryKv({ [cacheKey]: cachedBrowserResult() });
    const setup = await authedSetup(kv);
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);

    const response = await app.fetch(markdownGet(setup.rawKey), setup.env);

    expect(response.status).toBe(200);
    expect(response.headers.get("X-Converting-Cache")).toBe("HIT");
    expect(response.headers.get("X-Converting-Method")).toBe("browser");
    expect(response.headers.get("X-Converting-Source-Content-Type")).toBe("text/html");
    expect(response.headers.get("X-Converting-Output-Bytes")).toBe(outputBytes(expectedMarkdown("# Cached Browser")));
    expect(response.headers.get("X-Markdown-Tokens")).toBe("12");
    expect(response.headers.get("X-Browser-Ms-Used")).toBe("44");
    expect(await response.text()).toBe(expectedMarkdown("# Cached Browser"));
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

type RequestOverrides = Omit<Partial<MarkdownRequest>, "ai" | "browser" | "cache"> & {
  ai?: Partial<MarkdownRequest["ai"]>;
  browser?: Partial<MarkdownRequest["browser"]>;
  cache?: Partial<MarkdownRequest["cache"]>;
};

function markdownRequest(overrides: RequestOverrides): MarkdownRequest {
  const { ai, browser, cache, ...requestOverrides } = overrides;
  return {
    url: "https://example.com/page",
    mode: "auto",
    format: "markdown",
    cache: { read: true, write: true, ttlSeconds: 86400, ...cache },
    ai: { allowImages: false, cssSelector: null, imageDescriptionLanguage: "en", ...ai },
    browser: {
      enabled: false,
      waitUntil: "domcontentloaded",
      waitForSelector: null,
      userAgent: null,
      blockAssets: true,
      ...browser
    },
    ...requestOverrides
  };
}

function context(envOverrides: Partial<ConversionContext["env"]> & { requestId?: string } = {}): ConversionContext {
  const { requestId, ...env } = envOverrides;
  return {
    env: makeEnv(env),
    apiKey: apiKey(),
    config: parseConfig(makeEnv(env)),
    requestId: requestId ?? "req_cache",
    now: new Date("2026-05-19T12:00:00.000Z")
  };
}

function apiKey(): ApiKey {
  return {
    id: "key_cache",
    name: "Cache key",
    prefix: "cmd_live_cache",
    status: "active",
    dailyRequestLimit: 1000,
    monthlyRequestLimit: 25000,
    allowBrowser: true,
    autoBrowserFallback: true,
    dailyBrowserMsLimit: 10000,
    monthlyBrowserMsLimit: 20000,
    allowImages: false,
    dailyImageLimit: 0,
    monthlyImageLimit: 0,
    createdAt: "2026-05-19T00:00:00.000Z",
    updatedAt: "2026-05-19T00:00:00.000Z",
    lastUsedAt: null
  };
}

async function authedSetup(kv: MemoryKv) {
  const rawKey = "cmd_live_cache_secret";
  const pepper = "pepper";
  const d1 = createMemoryD1();
  d1.seedApiKey(apiKeyRow({ id: "key_cache", key_hash: await hashApiKey(rawKey, pepper), prefix: rawKey.slice(0, 17) }));
  return { rawKey, env: makeEnv({ DB: d1.database, CACHE_KV: kv.namespace, API_KEY_PEPPER: pepper }) };
}

function markdownGet(rawKey: string): Request {
  return new Request("https://converting.md/v1/markdown?url=https%3A%2F%2Fexample.com%2Fpage", {
    headers: { Authorization: `Bearer ${rawKey}` }
  });
}

function cachedBrowserResult(): ConversionResult {
  return {
    markdown: "# Cached Browser",
    method: "browser",
    url: "https://example.com/page",
    cached: false,
    tokens: 12,
    browserMsUsed: 44,
    outputBytes: 17,
    inputBytes: 200,
    sourceContentType: "text/html",
    warnings: [],
    requestId: "req_old"
  };
}

function expectedMarkdown(body: string): string {
  return `---\nurl: https://example.com/page\n---\n\n${body}`;
}

function outputBytes(value: string): string {
  return String(new TextEncoder().encode(value).byteLength);
}
