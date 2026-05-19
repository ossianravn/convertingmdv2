import { afterEach, describe, expect, it, vi } from "vitest";
import { createMarkdownCacheKey } from "../src/cache/cache-key";
import { hashApiKey } from "../src/auth/hash";
import type { MarkdownRequest } from "../src/types/api";
import { app } from "../src/app";
import { makeEnv } from "./helpers";
import { apiKeyRow, createMemoryD1 } from "./fakes/d1";
import { createMemoryKv, type MemoryKv } from "./fakes/kv";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("markdown route acceptance", () => {
  it("returns markdown headers and logs a successful conversion event", async () => {
    const setup = await authedSetup();
    vi.stubGlobal("fetch", nativeFetch("# Native"));

    const response = await app.fetch(markdownGet(setup.rawKey), setup.env);

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toContain("text/markdown");
    expect(response.headers.get("X-Converting-Request-Id")).toMatch(/^req_/);
    expect(response.headers.get("X-Converting-Method")).toBe("native");
    expect(response.headers.get("X-Converting-Cache")).toBe("MISS");
    expect(response.headers.get("X-Converting-Source-Content-Type")).toBe("text/markdown");
    expect(response.headers.get("X-Converting-Output-Bytes")).toBe("8");
    expect(response.headers.get("X-RateLimit-Remaining-Day")).toBe("999");
    expect(response.headers.get("X-RateLimit-Remaining-Month")).toBe("24999");
    expect(await response.text()).toBe("# Native");
    expect(setup.d1.conversionEvents).toHaveLength(1);
    expect(setup.d1.conversionEvents[0]).toMatchObject({
      api_key_id: "key_route",
      host: "example.com",
      method: "native",
      status: "success",
      status_code: 200,
      cache_status: "MISS",
      error_code: null
    });
    expect(setup.d1.conversionEvents[0]?.url_hash).not.toContain("example.com");
  });

  it("returns JSON format responses", async () => {
    const setup = await authedSetup();
    vi.stubGlobal("fetch", nativeFetch("# Json"));

    const response = await app.fetch(markdownPost(setup.rawKey, { format: "json" }), setup.env);

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toContain("application/json");
    await expect(response.json()).resolves.toMatchObject({
      markdown: "# Json",
      method: "native",
      cached: false,
      requestId: expect.stringMatching(/^req_/)
    });
  });

  it("accepts X-API-Key auth for conversion routes", async () => {
    const setup = await authedSetup();
    vi.stubGlobal("fetch", nativeFetch("# Header"));

    const response = await app.fetch(
      new Request("https://converting.md/v1/markdown?url=https%3A%2F%2Fexample.com%2Fpage", {
        headers: { "X-API-Key": setup.rawKey }
      }),
      setup.env
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("X-Converting-Method")).toBe("native");
    expect(await response.text()).toBe("# Header");
  });

  it("serves cache hits without fetching and logs HIT metadata", async () => {
    const request = defaultMarkdownRequest("https://example.com/page");
    const cacheKey = await createMarkdownCacheKey("https://example.com/page", request);
    const kv = createMemoryKv({
      [cacheKey]: {
        markdown: "# Cached",
        method: "ai",
        url: "https://example.com/page",
        cached: false,
        tokens: 12,
        browserMsUsed: 999,
        outputBytes: 8,
        inputBytes: 100,
        sourceContentType: "text/html",
        warnings: [],
        requestId: "req_old"
      }
    });
    const setup = await authedSetup(kv);
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);

    const response = await app.fetch(markdownGet(setup.rawKey), setup.env);

    expect(response.status).toBe(200);
    expect(response.headers.get("X-Converting-Cache")).toBe("HIT");
    expect(response.headers.get("X-Browser-Ms-Used")).toBe("999");
    expect(await response.text()).toBe("# Cached");
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(setup.d1.conversionEvents[0]).toMatchObject({
      method: "ai",
      cache_status: "HIT",
      input_bytes: 0,
      browser_ms_used: 0
    });
  });

  it("supports the convenience endpoint and treats query string as target URL", async () => {
    const setup = await authedSetup();
    vi.stubGlobal("fetch", nativeFetch("# Convenience"));

    const response = await app.fetch(
      new Request("https://converting.md/https://example.com/page?x=1", {
        headers: { Authorization: `Bearer ${setup.rawKey}` }
      }),
      setup.env
    );

    expect(response.status).toBe(200);
    expect(await response.text()).toBe("# Convenience");
    expect(setup.d1.conversionEvents[0]).toMatchObject({
      host: "example.com",
      status: "success"
    });
  });

  it("allows browser address-bar conversion when anonymous mode is explicit", async () => {
    const setup = anonymousSetup();
    vi.stubGlobal("fetch", nativeFetch("# Anonymous"));

    const response = await app.fetch(new Request("https://converting.md/https://example.com/page"), setup.env);

    expect(response.status).toBe(200);
    expect(response.headers.get("X-RateLimit-Remaining-Day")).toBe("99999");
    expect(await response.text()).toBe("# Anonymous");
    expect(setup.d1.conversionEvents[0]).toMatchObject({
      api_key_id: "anon_public",
      host: "example.com",
      method: "native",
      status: "success"
    });
  });

  it("keeps Browser Run disabled for anonymous traffic", async () => {
    const setup = anonymousSetup();

    const response = await app.fetch(
      new Request("https://converting.md/v1/markdown", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: "https://example.com/page",
          mode: "browser",
          browser: { enabled: true }
        })
      }),
      setup.env
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "browser_not_allowed" }
    });
  });

  it("logs conversion errors without storing raw URLs", async () => {
    const setup = await authedSetup();

    const response = await app.fetch(
      new Request("https://converting.md/v1/markdown?url=file%3A%2F%2F%2Fetc%2Fpasswd", {
        headers: { Authorization: `Bearer ${setup.rawKey}` }
      }),
      setup.env
    );

    expect(response.status).toBe(400);
    expect(response.headers.get("Content-Type")).toContain("application/json");
    expect(response.headers.get("X-Converting-Request-Id")).toMatch(/^req_/);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "unsupported_scheme", requestId: expect.stringMatching(/^req_/) }
    });
    expect(setup.d1.conversionEvents[0]).toMatchObject({
      host: "invalid",
      method: null,
      status: "error",
      status_code: 400,
      error_code: "unsupported_scheme"
    });
    expect(setup.d1.conversionEvents[0]?.url_hash).not.toContain("passwd");
  });
});

async function authedSetup(kv: MemoryKv = createMemoryKv()) {
  const rawKey = "cmd_live_route_secret";
  const pepper = "pepper";
  const d1 = createMemoryD1();
  d1.seedApiKey(
    apiKeyRow({
      id: "key_route",
      key_hash: await hashApiKey(rawKey, pepper),
      prefix: rawKey.slice(0, 17)
    })
  );

  return {
    rawKey,
    d1,
    env: makeEnv({ DB: d1.database, CACHE_KV: kv.namespace, API_KEY_PEPPER: pepper })
  };
}

function anonymousSetup(kv: MemoryKv = createMemoryKv()) {
  const d1 = createMemoryD1();
  return {
    d1,
    env: makeEnv({
      DB: d1.database,
      CACHE_KV: kv.namespace,
      REQUIRE_AUTH: "false",
      ALLOW_ANON: "true"
    })
  };
}

function markdownGet(rawKey: string): Request {
  return new Request("https://converting.md/v1/markdown?url=https%3A%2F%2Fexample.com%2Fpage", {
    headers: { Authorization: `Bearer ${rawKey}` }
  });
}

function markdownPost(rawKey: string, body: Partial<MarkdownRequest>): Request {
  return new Request("https://converting.md/v1/markdown", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${rawKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ url: "https://example.com/page", ...body })
  });
}

function nativeFetch(markdown: string) {
  return vi.fn(async () => new Response(markdown, { headers: { "Content-Type": "text/markdown" } }));
}

function defaultMarkdownRequest(url: string): MarkdownRequest {
  return {
    url,
    mode: "auto",
    format: "markdown",
    cache: { read: true, write: true, ttlSeconds: 86400 },
    ai: { allowImages: false, cssSelector: null, imageDescriptionLanguage: "en" },
    browser: { enabled: false, waitUntil: "domcontentloaded", waitForSelector: null, userAgent: null, blockAssets: true }
  };
}
