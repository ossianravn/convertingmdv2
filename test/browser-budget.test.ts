import { afterEach, describe, expect, it, vi } from "vitest";
import { parseConfig } from "../src/config";
import { tryBrowserMarkdown } from "../src/conversion/browser";
import type { ApiKey, MarkdownRequest } from "../src/types/api";
import { getPeriodKeys } from "../src/usage/periods";
import { makeEnv } from "./helpers";
import { counterRow, createMemoryD1, type CounterDbRow } from "./fakes/d1";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("browser budget reservations", () => {
  it("rejects keys without browser permission before fetch", async () => {
    const d1 = createMemoryD1();
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);

    await expect(callBrowser(d1, { allowBrowser: false })).rejects.toMatchObject({
      code: "browser_not_allowed",
      status: 403
    });
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(d1.counters.size).toBe(0);
  });

  it("commits actual Browser Run usage and releases reservation", async () => {
    const d1 = createMemoryD1();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("# Browser", { headers: { "X-Browser-Ms-Used": "1234" } }))
    );

    const result = await callBrowser(d1, { allowBrowser: true });

    expect(result.browserMsUsed).toBe(1234);
    expect(periodCounter(d1.counters, "key", "day")?.browser_ms_reserved).toBe(0);
    expect(periodCounter(d1.counters, "key", "month")?.browser_ms_used).toBe(1234);
    expect(periodCounter(d1.counters, "global", "day")?.browser_requests).toBe(1);
  });

  it("unwraps JSON Browser Run markdown responses", async () => {
    const d1 = createMemoryD1();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ success: true, result: "# Browser JSON" }), {
        headers: { "Content-Type": "application/json", "X-Browser-Ms-Used": "88" }
      }))
    );

    const result = await callBrowser(d1, { allowBrowser: true });

    expect(result.markdown).toBe("# Browser JSON");
    expect(result.browserMsUsed).toBe(88);
  });

  it("sends the Browser Run endpoint, auth header, goto options, and asset block pattern", async () => {
    const d1 = createMemoryD1();
    const fetchSpy = browserFetchSpy();
    vi.stubGlobal("fetch", fetchSpy);

    await callBrowser(d1, { allowBrowser: true });

    const [url, init] = firstFetchCall(fetchSpy);
    expect(url).toBe("https://api.cloudflare.com/client/v4/accounts/acct/browser-rendering/markdown");
    expect(init).toMatchObject({
      method: "POST",
      headers: {
        Authorization: "Bearer token",
        "Content-Type": "application/json"
      }
    });
    expect(JSON.parse(String(init.body))).toEqual({
      url: "https://example.com/page",
      gotoOptions: { waitUntil: "domcontentloaded", timeout: 10000 },
      rejectRequestPattern: ["/^.*\\.(css|png|jpg|jpeg|gif|webp|svg|ico|woff|woff2|ttf|otf|mp4|webm|mp3)(\\?.*)?$/i"]
    });
  });

  it("uses rendered-page defaults for automatic fallback without explicit browser permission", async () => {
    const d1 = createMemoryD1();
    const fetchSpy = browserFetchSpy();
    vi.stubGlobal("fetch", fetchSpy);

    const result = await callBrowser(d1, { allowBrowser: false, autoBrowserFallback: true }, {}, "fallback");

    const [, init] = firstFetchCall(fetchSpy);
    const body = JSON.parse(String(init.body));
    expect(result.method).toBe("browser");
    expect(body.gotoOptions).toEqual({ waitUntil: "networkidle2", timeout: 10000 });
    expect(body.rejectRequestPattern).toEqual(["/^.*\\.(png|jpg|jpeg|gif|webp|ico|woff|woff2|ttf|otf|mp4|webm|mp3)(\\?.*)?$/i"]);
  });

  it("omits asset blocking and forwards explicit waitUntil, selector, and user agent when requested", async () => {
    const d1 = createMemoryD1();
    const fetchSpy = browserFetchSpy();
    vi.stubGlobal("fetch", fetchSpy);

    await callBrowser(d1, { allowBrowser: true }, {
      waitUntil: "networkidle2",
      waitForSelector: "main",
      userAgent: "ConvertingMD-Test",
      blockAssets: false
    });

    const [, init] = firstFetchCall(fetchSpy);
    const body = JSON.parse(String(init.body));
    expect(body).toEqual({
      url: "https://example.com/page",
      gotoOptions: { waitUntil: "networkidle2", timeout: 10000 },
      waitForSelector: { selector: "main", timeout: 10000 },
      userAgent: "ConvertingMD-Test"
    });
  });

  it("charges reserved max when Browser Run usage header is missing", async () => {
    const d1 = createMemoryD1();
    vi.stubGlobal("fetch", vi.fn(async () => new Response("# Browser")));

    const result = await callBrowser(d1, { allowBrowser: true });

    expect(result.browserMsUsed).toBe(10000);
    expect(periodCounter(d1.counters, "key", "day")?.browser_ms_used).toBe(10000);
  });

  it("releases reservation when Browser Run fails", async () => {
    const d1 = createMemoryD1();
    vi.stubGlobal("fetch", vi.fn(async () => new Response("failed", { status: 502 })));

    await expect(callBrowser(d1, { allowBrowser: true })).rejects.toMatchObject({
      code: "cloudflare_api_error"
    });
    expect(periodCounter(d1.counters, "key", "day")?.browser_ms_reserved).toBe(0);
    expect(periodCounter(d1.counters, "key", "day")?.browser_ms_used).toBe(0);
  });

  it("rejects global browser budget before fetch", async () => {
    const d1 = createMemoryD1();
    const periods = getPeriodKeys(new Date());
    d1.seedCounter(
      counterRow({
        scope: "global",
        scope_id: "all",
        period: "day",
        period_key: periods.day,
        browser_ms_used: 600000
      })
    );
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);

    await expect(callBrowser(d1, { allowBrowser: true })).rejects.toMatchObject({
      code: "global_browser_budget_exceeded"
    });
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

async function callBrowser(
  d1: ReturnType<typeof createMemoryD1>,
  apiKeyOverrides: Partial<ApiKey>,
  browserOverrides: Partial<MarkdownRequest["browser"]> = {},
  purpose: "explicit" | "fallback" = "explicit"
) {
  const env = makeEnv({
    DB: d1.database,
    CLOUDFLARE_ACCOUNT_ID: "acct",
    CLOUDFLARE_BROWSER_API_TOKEN: "token"
  });
  return tryBrowserMarkdown(env, markdownRequest(browserOverrides), apiKey(apiKeyOverrides), parseConfig(env), "req_test", purpose);
}

function markdownRequest(browserOverrides: Partial<MarkdownRequest["browser"]> = {}): MarkdownRequest {
  return {
    url: "https://example.com/page",
    mode: "browser",
    format: "markdown",
    cache: { read: true, write: true, ttlSeconds: 86400 },
    ai: { allowImages: false, cssSelector: null, imageDescriptionLanguage: "en" },
    browser: {
      enabled: true,
      waitUntil: "domcontentloaded",
      waitForSelector: null,
      userAgent: null,
      blockAssets: true,
      ...browserOverrides
    }
  };
}

function browserFetchSpy() {
  return vi.fn(async (_url: unknown, _init?: RequestInit) => new Response("# Browser", { headers: { "X-Browser-Ms-Used": "1234" } }));
}

function firstFetchCall(fetchSpy: ReturnType<typeof browserFetchSpy>): [unknown, RequestInit] {
  const call = fetchSpy.mock.calls[0];
  if (!call?.[1]) throw new Error("Expected Browser Run fetch call.");
  return [call[0], call[1]];
}

function apiKey(overrides: Partial<ApiKey>): ApiKey {
  return {
    id: "key_browser",
    name: "Browser key",
    prefix: "cmd_live_browser",
    status: "active",
    dailyRequestLimit: 1000,
    monthlyRequestLimit: 25000,
    allowBrowser: true,
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

function periodCounter(counters: Map<string, CounterDbRow>, scope: "key" | "global", period: "day" | "month") {
  return [...counters.values()].find((row) => row.scope === scope && row.period === period);
}
