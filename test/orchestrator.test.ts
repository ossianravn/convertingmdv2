import { afterEach, describe, expect, it, vi } from "vitest";
import { parseConfig } from "../src/config";
import { createMarkdownCacheKey } from "../src/cache/cache-key";
import { convertMarkdown, type ConversionContext } from "../src/conversion/orchestrator";
import type { ApiKey, MarkdownRequest } from "../src/types/api";
import { createBrowserRunStub, makeEnv } from "./helpers";
import { createMemoryD1 } from "./fakes/d1";
import { createMemoryKv } from "./fakes/kv";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("conversion orchestrator", () => {
  it("returns cache hits before fetching source URLs", async () => {
    const request = markdownRequest({ mode: "native" });
    const cacheKey = await createMarkdownCacheKey("https://example.com/page", request);
    const kv = createMemoryKv({
      [cacheKey]: {
        markdown: "# Cached",
        method: "native",
        url: "https://example.com/page",
        cached: false,
        tokens: 5,
        browserMsUsed: 0,
        outputBytes: 8,
        inputBytes: 8,
        sourceContentType: "text/markdown",
        warnings: [],
        requestId: "req_old"
      }
    });
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);

    const result = await convertMarkdown(request, context({ CACHE_KV: kv.namespace }));

    expect(result).toMatchObject({ markdown: "# Cached", cached: true, requestId: "req_test" });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("writes successful native conversions to cache", async () => {
    const kv = createMemoryKv();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("# Native", { headers: { "Content-Type": "text/markdown" } }))
    );

    const result = await convertMarkdown(markdownRequest({ mode: "native" }), context({ CACHE_KV: kv.namespace }));

    expect(result.method).toBe("native");
    expect(kv.writes).toHaveLength(1);
    expect(JSON.parse(kv.writes[0]?.value ?? "{}")).toMatchObject({ markdown: "# Native", cached: false });
  });

  it("falls back from unavailable native markdown to AI in auto mode", async () => {
    const aiSpy = vi.fn(async () => ({ markdown: "# AI", tokens: 11 }));
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(new Response("<html></html>", { headers: { "Content-Type": "text/html" } }))
        .mockResolvedValueOnce(new Response("<html></html>", { headers: { "Content-Type": "text/html" } }))
    );

    const result = await convertMarkdown(
      markdownRequest({ mode: "auto" }),
      context({ AI: { toMarkdown: aiSpy } })
    );

    expect(result).toMatchObject({ method: "ai", markdown: "# AI", tokens: 11 });
    expect(aiSpy).toHaveBeenCalledOnce();
  });

  it("does not use browser fallback for weak AI output unless explicitly allowed", async () => {
    const fetchSpy = vi
      .fn()
      .mockResolvedValueOnce(new Response("<html></html>", { headers: { "Content-Type": "text/html" } }))
      .mockResolvedValueOnce(new Response("<html></html>", { headers: { "Content-Type": "text/html" } }));
    vi.stubGlobal("fetch", fetchSpy);

    const result = await convertMarkdown(
      markdownRequest({ mode: "auto", browser: { enabled: true } }),
      context({
        AI: { async toMarkdown() { return { markdown: "" }; } }
      })
    );

    expect(result).toMatchObject({ method: "ai", markdown: "" });
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it("uses browser fallback for weak AI output when request and key allow it", async () => {
    const d1 = createMemoryD1();
    const fetchSpy = vi
      .fn()
      .mockResolvedValueOnce(new Response("<html></html>", { headers: { "Content-Type": "text/html" } }))
      .mockResolvedValueOnce(new Response("<html></html>", { headers: { "Content-Type": "text/html" } }));
    const browserSpy = vi.fn(async () => new Response("# Browser", { headers: { "X-Browser-Ms-Used": "22" } }));
    vi.stubGlobal("fetch", fetchSpy);

    const result = await convertMarkdown(
      markdownRequest({ mode: "auto", browser: { enabled: true } }),
      context(
        {
          DB: d1.database,
          AI: { async toMarkdown() { return { markdown: "" }; } },
          BROWSER: createBrowserRunStub(browserSpy)
        },
        { allowBrowser: true, autoBrowserFallback: true }
      )
    );

    expect(result).toMatchObject({ method: "browser", markdown: "# Browser", browserMsUsed: 22 });
    expect(fetchSpy).toHaveBeenCalledTimes(2);
    expect(browserSpy).toHaveBeenCalledOnce();
  });
});

function context(envOverrides = {}, apiKeyOverrides: Partial<ApiKey> = {}): ConversionContext {
  const env = makeEnv(envOverrides);
  return {
    env,
    apiKey: apiKey(apiKeyOverrides),
    config: parseConfig(env),
    requestId: "req_test",
    now: new Date("2026-05-19T12:00:00.000Z")
  };
}

type MarkdownRequestOverrides = Omit<Partial<MarkdownRequest>, "browser"> & {
  browser?: Partial<MarkdownRequest["browser"]>;
};

function markdownRequest(overrides: MarkdownRequestOverrides): MarkdownRequest {
  const { browser, ...requestOverrides } = overrides;
  return {
    url: "https://example.com/page",
    mode: "auto",
    format: "markdown",
    cache: { read: true, write: true, ttlSeconds: 86400 },
    ai: { allowImages: false, cssSelector: null, imageDescriptionLanguage: "en" },
    ...requestOverrides,
    browser: {
      enabled: false,
      waitUntil: "domcontentloaded",
      waitForSelector: null,
      userAgent: null,
      blockAssets: true,
      ...browser
    }
  };
}

function apiKey(overrides: Partial<ApiKey>): ApiKey {
  return {
    id: "key_orchestrator",
    name: "Orchestrator key",
    prefix: "cmd_live_orch",
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
    createdAt: "2026-05-19T00:00:00.000Z",
    updatedAt: "2026-05-19T00:00:00.000Z",
    lastUsedAt: null,
    ...overrides
  };
}
