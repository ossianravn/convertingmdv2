import { afterEach, describe, expect, it, vi } from "vitest";
import { createMarkdownCacheKey } from "../src/cache/cache-key";
import { parseConfig } from "../src/config";
import { convertMarkdown, type ConversionContext } from "../src/conversion/orchestrator";
import type { ConversionResult } from "../src/conversion/result";
import type { ApiKey, MarkdownRequest } from "../src/types/api";
import { makeEnv } from "./helpers";
import { createMemoryD1 } from "./fakes/d1";
import { createMemoryKv } from "./fakes/kv";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("guarded browser fallback", () => {
  it("falls back to Browser Run for weak AI output from a JavaScript app shell", async () => {
    const d1 = createMemoryD1();
    const fetchSpy = vi
      .fn()
      .mockResolvedValueOnce(htmlResponse(jsAppShell()))
      .mockResolvedValueOnce(htmlResponse(jsAppShell()))
      .mockResolvedValueOnce(browserResponse(renderedMarkdown()));
    vi.stubGlobal("fetch", fetchSpy);

    const result = await convertMarkdown(
      markdownRequest({ browser: { enabled: true } }),
      context(
        {
          DB: d1.database,
          AI: { async toMarkdown() { return { markdown: weakMetadataMarkdown(), tokens: 124 }; } },
          CLOUDFLARE_ACCOUNT_ID: "acct",
          CLOUDFLARE_BROWSER_API_TOKEN: "token"
        },
        browserKey()
      )
    );

    expect(result.method).toBe("browser");
    expect(result.markdown).toContain("90 days");
    expect(result.warnings).toContain("browser_fallback_from_weak_ai");
    expect(fetchSpy).toHaveBeenCalledTimes(3);
  });

  it("returns weak AI output with warnings when the browser fallback attempt fails", async () => {
    const d1 = createMemoryD1();
    const fetchSpy = vi
      .fn()
      .mockResolvedValueOnce(htmlResponse(jsAppShell()))
      .mockResolvedValueOnce(htmlResponse(jsAppShell()))
      .mockResolvedValueOnce(new Response("failed", { status: 502 }));
    vi.stubGlobal("fetch", fetchSpy);

    const result = await convertMarkdown(
      markdownRequest({ browser: { enabled: true } }),
      context(
        {
          DB: d1.database,
          AI: { async toMarkdown() { return { markdown: weakMetadataMarkdown(), tokens: 124 }; } },
          CLOUDFLARE_ACCOUNT_ID: "acct",
          CLOUDFLARE_BROWSER_API_TOKEN: "token"
        },
        browserKey()
      )
    );

    expect(result.method).toBe("ai");
    expect(result.warnings).toEqual(
      expect.arrayContaining(["output_too_short_for_source", "browser_fallback_failed:cloudflare_api_error"])
    );
  });

  it("refreshes weak AI cache entries through Browser Run when the request and key allow it", async () => {
    const request = markdownRequest({ browser: { enabled: true } });
    const cacheKey = await createMarkdownCacheKey("https://example.com/page", request);
    const kv = createMemoryKv({ [cacheKey]: weakCachedAiResult() });
    const d1 = createMemoryD1();
    const fetchSpy = vi.fn().mockResolvedValueOnce(browserResponse(renderedMarkdown()));
    vi.stubGlobal("fetch", fetchSpy);

    const result = await convertMarkdown(
      request,
      context(
        {
          DB: d1.database,
          CACHE_KV: kv.namespace,
          CLOUDFLARE_ACCOUNT_ID: "acct",
          CLOUDFLARE_BROWSER_API_TOKEN: "token"
        },
        browserKey()
      )
    );

    expect(result.method).toBe("browser");
    expect(result.warnings).toContain("browser_fallback_from_weak_cache");
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it("does not cache weak AI output when fallback is not allowed", async () => {
    const kv = createMemoryKv();
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(htmlResponse(jsAppShell()))
        .mockResolvedValueOnce(htmlResponse(jsAppShell()))
    );

    const result = await convertMarkdown(
      markdownRequest({ browser: { enabled: true } }),
      context({
        CACHE_KV: kv.namespace,
        AI: { async toMarkdown() { return { markdown: weakMetadataMarkdown(), tokens: 124 }; } }
      })
    );

    expect(result.method).toBe("ai");
    expect(result.warnings).toContain("output_too_short_for_source");
    expect(kv.writes).toHaveLength(0);
  });
});

type RequestOverrides = Omit<Partial<MarkdownRequest>, "browser"> & {
  browser?: Partial<MarkdownRequest["browser"]>;
};

function markdownRequest(overrides: RequestOverrides = {}): MarkdownRequest {
  const { browser, ...requestOverrides } = overrides;
  return {
    url: "https://example.com/page",
    mode: "auto",
    format: "markdown",
    cache: { read: true, write: true, ttlSeconds: 86400 },
    ai: { allowImages: false, cssSelector: null, imageDescriptionLanguage: "en" },
    browser: { enabled: false, waitUntil: "domcontentloaded", waitForSelector: null, userAgent: null, blockAssets: true, ...browser },
    ...requestOverrides
  };
}

function context(envOverrides = {}, apiKeyOverrides: Partial<ApiKey> = {}): ConversionContext {
  const env = makeEnv(envOverrides);
  return {
    env,
    apiKey: apiKey(apiKeyOverrides),
    config: parseConfig(env),
    requestId: "req_fallback",
    now: new Date("2026-05-19T12:00:00.000Z")
  };
}

function apiKey(overrides: Partial<ApiKey>): ApiKey {
  return {
    id: "key_fallback",
    name: "Fallback key",
    prefix: "cmd_live_fallback",
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

function browserKey(): Partial<ApiKey> {
  return { allowBrowser: true, autoBrowserFallback: true };
}

function htmlResponse(html: string): Response {
  return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8" } });
}

function browserResponse(markdown: string): Response {
  return new Response(markdown, { headers: { "X-Browser-Ms-Used": "321" } });
}

function jsAppShell(): string {
  return `
    <html>
      <body>
        <div id="root"></div>
        <div id="cookie-banner">We use cookies to improve your experience. Decline Accept Privacy.</div>
        <script defer src="/sections.js"></script>
        <script defer src="/app.js"></script>
      </body>
    </html>
  `;
}

function weakMetadataMarkdown(): string {
  return `---
description: Build a real AI business in 90 days.
title: Build with Gemini XPRIZE
---

We use cookies to improve your experience and analyze site traffic.

Decline Accept`;
}

function renderedMarkdown(): string {
  return "# 90 days. Pick a problem worth solving.\n\nBuild a real business with AI. $2M in prizes. Ideate. Build. Ship. Grow.";
}

function weakCachedAiResult(): ConversionResult {
  return {
    markdown: weakMetadataMarkdown(),
    method: "ai",
    url: "https://example.com/page",
    cached: false,
    tokens: 124,
    browserMsUsed: 0,
    outputBytes: 180,
    inputBytes: 30542,
    sourceContentType: "text/html; charset=utf-8",
    warnings: ["source_js_app_shell"],
    requestId: "req_old"
  };
}
