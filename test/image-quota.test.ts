import { afterEach, describe, expect, it, vi } from "vitest";
import { parseConfig } from "../src/config";
import { tryAiMarkdown } from "../src/conversion/ai";
import type { ApiKey, MarkdownRequest } from "../src/types/api";
import type { AiMarkdownResult, AiToMarkdownOptions } from "../src/types/env";
import { getPeriodKeys } from "../src/usage/periods";
import { makeEnv } from "./helpers";
import { counterRow, createMemoryD1, type CounterDbRow } from "./fakes/d1";

type ToMarkdown = (input: unknown, options?: AiToMarkdownOptions) => Promise<AiMarkdownResult>;

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("image conversion quota", () => {
  it("blocks image conversion when globally disabled", async () => {
    const d1 = createMemoryD1();
    const aiSpy = vi.fn<ToMarkdown>();
    vi.stubGlobal("fetch", imageFetch());

    await expect(callAi(d1, aiSpy, { allowImages: true })).rejects.toMatchObject({
      code: "image_conversion_not_allowed",
      status: 403
    });
    expect(aiSpy).not.toHaveBeenCalled();
    expect(d1.counters.size).toBe(0);
  });

  it("charges image quota and passes image conversion options", async () => {
    const d1 = createMemoryD1();
    const aiSpy = vi.fn<ToMarkdown>(async () => ({ markdown: "# Image", tokens: 7 }));
    vi.stubGlobal("fetch", imageFetch());

    const result = await callAi(d1, aiSpy, { allowImages: true }, { DISABLE_IMAGE_CONVERSION: "false" });

    expect(result.markdown).toBe("# Image");
    const [document] = aiSpy.mock.calls[0] ?? [];
    expect(document).toMatchObject({ name: "image.png" });
    expect((document as { blob?: Blob }).blob).toBeInstanceOf(Blob);
    expect((document as { blob: Blob }).blob.type).toBe("image/png");
    expect(aiSpy).toHaveBeenCalledWith(expect.any(Object), {
      conversionOptions: { image: { descriptionLanguage: "da" } }
    });
    expect(periodCounter(d1.counters, "key", "day")?.image_requests).toBe(1);
    expect(periodCounter(d1.counters, "global", "month")?.image_requests).toBe(1);
  });

  it("rejects key image quota before AI conversion", async () => {
    const d1 = createMemoryD1();
    const periods = getPeriodKeys(new Date());
    d1.seedCounter(
      counterRow({ scope_id: "key_image", period: "day", period_key: periods.day, image_requests: 1 })
    );
    const aiSpy = vi.fn<ToMarkdown>();
    vi.stubGlobal("fetch", imageFetch());

    await expect(
      callAi(d1, aiSpy, { allowImages: true, dailyImageLimit: 1 }, { DISABLE_IMAGE_CONVERSION: "false" })
    ).rejects.toMatchObject({ code: "quota_exceeded" });
    expect(aiSpy).not.toHaveBeenCalled();
  });

  it("rejects global image quota before AI conversion", async () => {
    const d1 = createMemoryD1();
    const periods = getPeriodKeys(new Date());
    d1.seedCounter(
      counterRow({
        scope: "global",
        scope_id: "all",
        period: "day",
        period_key: periods.day,
        image_requests: 1
      })
    );
    const aiSpy = vi.fn<ToMarkdown>();
    vi.stubGlobal("fetch", imageFetch());

    await expect(
      callAi(
        d1,
        aiSpy,
        { allowImages: true },
        { DISABLE_IMAGE_CONVERSION: "false", GLOBAL_DAILY_IMAGE_LIMIT: "1" }
      )
    ).rejects.toMatchObject({ code: "global_image_budget_exceeded" });
    expect(aiSpy).not.toHaveBeenCalled();
  });
});

async function callAi(
  d1: ReturnType<typeof createMemoryD1>,
  aiSpy: ToMarkdown,
  apiKeyOverrides: Partial<ApiKey>,
  envOverrides = {}
) {
  const env = makeEnv({
    DB: d1.database,
    AI: { toMarkdown: aiSpy },
    ...envOverrides
  });
  return tryAiMarkdown(env, markdownRequest(), apiKey(apiKeyOverrides), parseConfig(env), "req_test");
}

function imageFetch() {
  return vi.fn(async () => new Response(new Uint8Array([1, 2, 3]), { headers: { "Content-Type": "image/png" } }));
}

function markdownRequest(): MarkdownRequest {
  return {
    url: "https://example.com/image.png",
    mode: "ai",
    format: "markdown",
    cache: { read: true, write: true, ttlSeconds: 86400 },
    ai: { allowImages: true, cssSelector: null, imageDescriptionLanguage: "da" },
    browser: { enabled: false, waitUntil: "domcontentloaded", waitForSelector: null, userAgent: null, blockAssets: true }
  };
}

function apiKey(overrides: Partial<ApiKey>): ApiKey {
  return {
    id: "key_image",
    name: "Image key",
    prefix: "cmd_live_image",
    status: "active",
    dailyRequestLimit: 1000,
    monthlyRequestLimit: 25000,
    allowBrowser: false,
    autoBrowserFallback: false,
    dailyBrowserMsLimit: 0,
    monthlyBrowserMsLimit: 0,
    allowImages: false,
    dailyImageLimit: 10,
    monthlyImageLimit: 20,
    createdAt: "2026-05-19T00:00:00.000Z",
    updatedAt: "2026-05-19T00:00:00.000Z",
    lastUsedAt: null,
    ...overrides
  };
}

function periodCounter(counters: Map<string, CounterDbRow>, scope: "key" | "global", period: "day" | "month") {
  return [...counters.values()].find((row) => row.scope === scope && row.period === period);
}
