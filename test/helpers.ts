import { vi } from "vitest";
import type { PageOutcome } from "../src/conversion/content-check";
import type { Env } from "../src/types/env";

export function makeEnv(overrides: Partial<Env> = {}): Env {
  return {
    AI: {
      async toMarkdown() {
        return { markdown: "# Mock" };
      }
    },
    ASSETS: createAssetsStub(),
    BROWSER: createBrowserRunStub(),
    DB: createD1Stub(),
    CACHE_KV: createKvStub(),
    ENVIRONMENT: "development",
    REQUIRE_AUTH: "true",
    ALLOW_ANON: "false",
    DISABLE_BROWSER: "false",
    DISABLE_IMAGE_CONVERSION: "true",
    DEFAULT_CACHE_TTL_SECONDS: "86400",
    MAX_SOURCE_BYTES: "2097152",
    MAX_OUTPUT_BYTES: "2097152",
    MAX_BROWSER_MS_PER_REQUEST: "10000",
    GLOBAL_DAILY_BROWSER_MS_LIMIT: "600000",
    GLOBAL_MONTHLY_BROWSER_MS_LIMIT: "36000000",
    GLOBAL_DAILY_IMAGE_LIMIT: "50",
    GLOBAL_MONTHLY_IMAGE_LIMIT: "500",
    TYPESAFE_API_KEY: "test-typesafe-key",
    ...overrides
  };
}

export const frontpageHtml = "<!doctype html><title>converting.md</title>";

export function createAssetsStub(fetch: (request: Request) => Promise<Response> = serveFrontpage): Fetcher {
  return {
    fetch(input: RequestInfo | URL, init?: RequestInit) {
      return fetch(new Request(input, init));
    }
  } as unknown as Fetcher;
}

async function serveFrontpage(request: Request): Promise<Response> {
  if (new URL(request.url).pathname !== "/index.html") return new Response("Not found", { status: 404 });
  return new Response(frontpageHtml, { headers: { "Content-Type": "text/html; charset=utf-8", ETag: '"home"' } });
}

export function createBrowserRunStub(
  quickAction: (action: string, options: unknown) => Promise<Response> = defaultBrowserRunQuickAction
): BrowserRun {
  return { quickAction } as unknown as BrowserRun;
}

async function defaultBrowserRunQuickAction(): Promise<Response> {
  throw new Error("Browser Run stub was called unexpectedly.");
}

function createD1Stub(): D1Database {
  return {
    prepare() {
      throw new Error("D1 stub was called unexpectedly.");
    }
  } as unknown as D1Database;
}

function createKvStub(): KVNamespace {
  return {
    async get() {
      return null;
    },
    async put() {
      return undefined;
    }
  } as unknown as KVNamespace;
}

type FetchLike = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
export type JevAnswer = PageOutcome | ((page: { requested_url: string; http_status: unknown; content: string }) => PageOutcome);

// Stubs global fetch for source requests while a fake Jev answers TypeSafe
// calls, so source spies only see source traffic. Returns the Jev requests.
export function stubFetch(sourceFetch: FetchLike, jev: JevAnswer = "real_content"): unknown[] {
  const jevRequests: unknown[] = [];
  // A vi.fn, so tests that inspect `fetch.mock.calls` keep working.
  vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = input instanceof Request ? input.url : String(input);
    if (!url.startsWith("https://api.typesafe.ai/")) return sourceFetch(input, init);

    const body = JSON.parse(String(init?.body)) as { state: { page: { requested_url: string; http_status: unknown; content: string } } };
    jevRequests.push(body);
    const choice = typeof jev === "function" ? jev(body.state.page) : jev;
    return Response.json({
      model: "jev-1.14.0",
      answers: { answer: { type: "choice", choice, probabilities: jevProbabilities(choice), confidence: 0.98 } },
      usage: { input_tokens: 600, output_tokens: 68 }
    });
  }));
  return jevRequests;
}

function jevProbabilities(choice: PageOutcome): Record<PageOutcome, number> {
  const outcomes: PageOutcome[] = ["real_content", "access_block", "javascript_shell", "consent_wall", "not_found", "login_wall"];
  return Object.fromEntries(outcomes.map((outcome) => [outcome, outcome === choice ? 0.98 : 0.004])) as Record<PageOutcome, number>;
}
