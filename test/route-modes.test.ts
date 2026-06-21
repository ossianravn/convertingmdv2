import { afterEach, describe, expect, it, vi } from "vitest";
import { hashApiKey } from "../src/auth/hash";
import { app } from "../src/app";
import { getPeriodKeys } from "../src/usage/periods";
import { createBrowserRunStub, makeEnv } from "./helpers";
import { apiKeyRow, createMemoryD1, type CounterDbRow } from "./fakes/d1";
import { createMemoryKv } from "./fakes/kv";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("conversion mode routes", () => {
  it("counts native conversions and bytes for non-cache successes", async () => {
    const setup = await authedSetup();
    vi.stubGlobal("fetch", vi.fn(async () => markdownResponse("# Native")));

    const response = await app.fetch(markdownPost(setup.rawKey, { mode: "native" }), setup.env);

    expect(response.status).toBe(200);
    expect(response.headers.get("X-Converting-Method")).toBe("native");
    expect(periodCounter(setup.d1.counters, "key", "day")?.native_requests).toBe(1);
    expect(periodCounter(setup.d1.counters, "global", "month")?.bytes_out).toBe(
      new TextEncoder().encode("---\nurl: https://example.com/page\n---\n\n# Native").byteLength
    );
  });

  it("counts AI conversions and exposes token headers", async () => {
    const setup = await authedSetup();
    const aiSpy = vi.fn(async () => ({ markdown: "# AI", tokens: 42 }));
    vi.stubGlobal("fetch", vi.fn(async () => htmlResponse("<main>Hello</main>")));

    const response = await app.fetch(
      markdownPost(setup.rawKey, { mode: "ai" }),
      makeEnv({ ...setup.env, AI: { toMarkdown: aiSpy } })
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("X-Converting-Method")).toBe("ai");
    expect(response.headers.get("X-Markdown-Tokens")).toBe("42");
    expect(periodCounter(setup.d1.counters, "key", "day")?.ai_requests).toBe(1);
    expect(aiSpy).toHaveBeenCalledOnce();
  });

  it("runs browser mode only for keys with browser permission", async () => {
    const browserSpy = vi.fn(async () => new Response("# Browser", { headers: { "X-Browser-Ms-Used": "321" } }));
    const setup = await authedSetup(
      { allow_browser: 1, daily_browser_ms_limit: 20000, monthly_browser_ms_limit: 40000 },
      createMemoryKv(),
      browserSpy
    );

    const response = await app.fetch(markdownPost(setup.rawKey, { mode: "browser" }), setup.env);

    expect(response.status).toBe(200);
    expect(response.headers.get("X-Converting-Method")).toBe("browser");
    expect(response.headers.get("X-Browser-Ms-Used")).toBe("321");
    expect(periodCounter(setup.d1.counters, "key", "day")?.browser_requests).toBe(1);
    expect(periodCounter(setup.d1.counters, "global", "month")?.browser_ms_used).toBe(321);
    expect(browserSpy).toHaveBeenCalledOnce();
  });

  it("does not count conversion-specific counters on cache hits", async () => {
    const setup = await authedSetup(undefined, createMemoryKv());
    setup.kv.entries.set(await cacheKeyForDefault(), cachedAiResult());
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);

    const response = await app.fetch(markdownPost(setup.rawKey, { mode: "auto" }), setup.env);

    expect(response.status).toBe(200);
    expect(response.headers.get("X-Converting-Cache")).toBe("HIT");
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(periodCounter(setup.d1.counters, "key", "day")?.requests).toBe(1);
    expect(periodCounter(setup.d1.counters, "key", "day")?.ai_requests).toBe(0);
  });
});

async function authedSetup(overrides = {}, kv = createMemoryKv(), browserSpy?: (action: string, options: unknown) => Promise<Response>) {
  const rawKey = "cmd_live_modes_secret";
  const pepper = "pepper";
  const d1 = createMemoryD1();
  d1.seedApiKey(
    apiKeyRow({
      id: "key_modes",
      key_hash: await hashApiKey(rawKey, pepper),
      prefix: rawKey.slice(0, 17),
      ...overrides
    })
  );

  return {
    rawKey,
    d1,
    kv,
    env: makeEnv({
      DB: d1.database,
      CACHE_KV: kv.namespace,
      API_KEY_PEPPER: pepper,
      ...(browserSpy ? { BROWSER: createBrowserRunStub(browserSpy) } : {})
    })
  };
}

function markdownPost(rawKey: string, body: Record<string, unknown>): Request {
  return new Request("https://converting.md/v1/markdown", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${rawKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ url: "https://example.com/page", ...body })
  });
}

function markdownResponse(markdown: string): Response {
  return new Response(markdown, { headers: { "Content-Type": "text/markdown" } });
}

function htmlResponse(html: string): Response {
  return new Response(html, { headers: { "Content-Type": "text/html" } });
}

function periodCounter(counters: Map<string, CounterDbRow>, scope: "key" | "global", period: "day" | "month") {
  const periods = getPeriodKeys(new Date());
  const key = period === "day" ? periods.day : periods.month;
  return [...counters.values()].find((row) => row.scope === scope && row.period === period && row.period_key === key);
}

async function cacheKeyForDefault(): Promise<string> {
  const { createMarkdownCacheKey } = await import("../src/cache/cache-key");
  return createMarkdownCacheKey("https://example.com/page", {
    url: "https://example.com/page",
    mode: "auto",
    format: "markdown",
    cache: { read: true, write: true, ttlSeconds: 86400 },
    ai: { allowImages: false, cssSelector: null, imageDescriptionLanguage: "en" },
    browser: { enabled: false, waitUntil: "domcontentloaded", waitForSelector: null, userAgent: null, blockAssets: true }
  });
}

function cachedAiResult(): string {
  return JSON.stringify({
    markdown: "# Cached",
    method: "ai",
    url: "https://example.com/page",
    cached: false,
    tokens: 1,
    browserMsUsed: 0,
    outputBytes: 8,
    inputBytes: 20,
    sourceContentType: "text/html",
    warnings: [],
    requestId: "req_old"
  });
}
