import { afterEach, describe, expect, it, vi } from "vitest";
import { parseConfig } from "../src/config";
import { tryAiMarkdown } from "../src/conversion/ai";
import { tryBrowserMarkdown } from "../src/conversion/browser";
import { tryNativeMarkdown } from "../src/conversion/native";
import type { ApiKey, MarkdownRequest } from "../src/types/api";
import type { AiMarkdownResult, AiToMarkdownOptions } from "../src/types/env";
import { makeEnv } from "./helpers";
import { createMemoryD1 } from "./fakes/d1";

type ToMarkdown = (input: unknown, options?: AiToMarkdownOptions) => Promise<AiMarkdownResult>;

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("conversion edge cases", () => {
  it("native captures token headers", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("# Native", { headers: { "Content-Type": "text/markdown", "x-markdown-tokens": "9" } }))
    );

    const result = await tryNativeMarkdown("https://example.com", parseConfig(makeEnv()), "req_test");

    expect(result.tokens).toBe(9);
    expect(result.method).toBe("native");
  });

  it("native rejects HTML responses as unavailable", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("<html></html>", { headers: { "Content-Type": "text/html" } })));

    await expect(tryNativeMarkdown("https://example.com", parseConfig(makeEnv()), "req_test")).rejects.toMatchObject({
      code: "conversion_failed",
      status: 502
    });
  });

  it("native rejects HTML even when page scaffolding contains Markdown-shaped text", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response("<script>const value = '[cta](https://example.com)'</script>", {
            headers: { "Content-Type": "text/html;charset=UTF-8" }
          })
      )
    );

    await expect(tryNativeMarkdown("https://example.com", parseConfig(makeEnv()), "req_test")).rejects.toMatchObject({
      code: "conversion_failed",
      status: 502
    });
  });

  it("native rejects Markdown output over the output limit", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("# Oversized", { headers: { "Content-Type": "text/markdown" } })));

    await expect(
      tryNativeMarkdown("https://example.com", parseConfig(makeEnv({ MAX_OUTPUT_BYTES: "3" })), "req_test")
    ).rejects.toMatchObject({ code: "output_too_large", status: 413 });
  });

  it("AI passes an HTML document with hostname and cssSelector", async () => {
    const aiSpy = vi.fn<ToMarkdown>(async () => ({ markdown: "# AI", tokens: 5 }));
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("<main>Hello</main>", { headers: { "Content-Type": "text/html; charset=UTF-8" } }))
    );

    const result = await tryAiMarkdown(
      makeEnv({ AI: { toMarkdown: aiSpy } }),
      markdownRequest({ ai: { cssSelector: "main" } }),
      apiKey({}),
      parseConfig(makeEnv()),
      "req_test"
    );

    expect(result.tokens).toBe(5);
    const [document] = aiSpy.mock.calls[0] ?? [];
    expect(document).toMatchObject({ name: "page.html" });
    expect((document as { blob?: Blob }).blob).toBeInstanceOf(Blob);
    expect((document as { blob: Blob }).blob.type).toBe("text/html");
    expect(aiSpy).toHaveBeenCalledWith(expect.any(Object), {
      conversionOptions: { html: { hostname: "example.com", cssSelector: "main" } }
    });
  });

  it("AI rejects unsupported content types before calling Workers AI", async () => {
    const aiSpy = vi.fn<ToMarkdown>();
    vi.stubGlobal("fetch", vi.fn(async () => new Response("{}", { headers: { "Content-Type": "application/json" } })));

    await expect(
      tryAiMarkdown(makeEnv({ AI: { toMarkdown: aiSpy } }), markdownRequest({}), apiKey({}), parseConfig(makeEnv()), "req_test")
    ).rejects.toMatchObject({ code: "conversion_failed", status: 502 });
    expect(aiSpy).not.toHaveBeenCalled();
  });

  it("browser is blocked by global disable before Cloudflare API fetch", async () => {
    const d1 = createMemoryD1();
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    const env = makeEnv({ DB: d1.database, DISABLE_BROWSER: "true" });

    await expect(
      tryBrowserMarkdown(env, markdownRequest({ mode: "browser", browser: { enabled: true } }), apiKey({ allowBrowser: true }), parseConfig(env), "req_test")
    ).rejects.toMatchObject({ code: "browser_not_allowed", status: 403 });
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

type MarkdownRequestOverrides = Omit<Partial<MarkdownRequest>, "ai" | "browser"> & {
  ai?: Partial<MarkdownRequest["ai"]>;
  browser?: Partial<MarkdownRequest["browser"]>;
};

function markdownRequest(overrides: MarkdownRequestOverrides): MarkdownRequest {
  const { ai, browser, ...requestOverrides } = overrides;
  return {
    url: "https://example.com/page",
    mode: "ai",
    format: "markdown",
    cache: { read: true, write: true, ttlSeconds: 86400 },
    ai: { allowImages: false, cssSelector: null, imageDescriptionLanguage: "en", ...ai },
    browser: { enabled: false, waitUntil: "domcontentloaded", waitForSelector: null, userAgent: null, blockAssets: true, ...browser },
    ...requestOverrides
  };
}

function apiKey(overrides: Partial<ApiKey>): ApiKey {
  return {
    id: "key_edge",
    name: "Edge key",
    prefix: "cmd_live_edge",
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
