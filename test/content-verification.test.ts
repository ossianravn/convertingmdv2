import { afterEach, describe, expect, it, vi } from "vitest";
import { app } from "../src/app";
import type { Env } from "../src/types/env";
import { createMemoryD1 } from "./fakes/d1";
import { createMemoryKv } from "./fakes/kv";
import { makeEnv, stubFetch, type JevAnswer } from "./helpers";

afterEach(() => {
  vi.unstubAllGlobals();
});

const target = "https://shop.example/store-juletraeer/";
const challenge = "# 454 Checking your browser\n\nThis automatic security check will complete in a moment.";
const realPage = "# Store juletræer\n\nVi leverer og opsætter juletræer på 3-12 meter i hele Sjælland.";

interface Scenario {
  source: { status: number; markdown: string };
  frankensurf?: Response;
  jev?: JevAnswer;
  env?: Partial<Env>;
}

async function convert(scenario: Scenario, path = `/${target}`) {
  const kv = createMemoryKv();
  const d1 = createMemoryD1();
  const surf = vi.fn(async () => scenario.frankensurf ?? Response.json({ success: false, error: "not configured" }, { status: 500 }));
  const source = vi.fn(async () => new Response("<html><body>source</body></html>", {
    status: scenario.source.status,
    headers: { "Content-Type": "text/html; charset=utf-8" }
  }));
  const jevRequests = stubFetch(
    async (input) => (String(input instanceof Request ? input.url : input).startsWith("https://surf.test/") ? surf() : source()),
    scenario.jev ?? "real_content"
  );
  const env = makeEnv({
    DB: d1.database,
    CACHE_KV: kv.namespace,
    REQUIRE_AUTH: "false",
    ALLOW_ANON: "true",
    DISABLE_BROWSER: "true",
    DISABLE_FRANKENSURF: "false",
    FRANKENSURF_URL: "https://surf.test",
    FRANKENSURF_API_KEY: "surf-key",
    AI: { async toMarkdown() { return { markdown: scenario.source.markdown, tokens: 40 }; } },
    ...scenario.env
  });

  const response = await app.fetch(new Request(`https://converting.md${path}`), env);
  return { response, surf, jevRequests, kv };
}

function surfPage(markdown: string, via = "httpx"): Response {
  return Response.json({
    success: true,
    data: { markdown, metadata: { url: target, sourceURL: target, statusCode: 200, frankensurf: { via } } }
  });
}

describe("content verification and the Frankensurf fallback", () => {
  it("sends a WAF status straight to Frankensurf and caches the verified page", async () => {
    const { response, surf, jevRequests, kv } = await convert({
      source: { status: 454, markdown: challenge },
      frankensurf: surfPage(realPage)
    });

    expect(response.status, await response.clone().text()).toBe(200);
    expect(response.headers.get("X-Converting-Method")).toBe("frankensurf");
    expect(response.headers.get("X-Converting-Warnings")).toContain("frankensurf_fallback:source_status_454");
    expect(response.headers.get("X-Converting-Warnings")).toContain("frankensurf_via:httpx");
    expect(await response.text()).toContain("Store juletræer");
    expect(surf).toHaveBeenCalledOnce();
    // Only the Frankensurf result needed Jev; the 454 decided on its own.
    expect(jevRequests).toHaveLength(1);
    expect(kv.writes).toHaveLength(1);
  });

  it("asks Jev about a 200 response and falls back when it is a block page", async () => {
    const { response, surf } = await convert({
      source: { status: 200, markdown: challenge },
      frankensurf: surfPage(realPage),
      jev: (page) => (page.content.includes("Checking your browser") ? "access_block" : "real_content")
    });

    expect(response.status).toBe(200);
    expect(response.headers.get("X-Converting-Warnings")).toContain("frankensurf_fallback:access_block");
    expect(surf).toHaveBeenCalledOnce();
  });

  it("answers 404 for a soft not-found page without trying Frankensurf or caching", async () => {
    const { response, surf, kv } = await convert({ source: { status: 200, markdown: "# 404 File not found" }, jev: "not_found" });

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toMatchObject({ error: { code: "source_not_found" } });
    expect(surf).not.toHaveBeenCalled();
    expect(kv.writes).toHaveLength(0);
  });

  it("answers 404 for a source 404 without asking Jev", async () => {
    const { response, jevRequests } = await convert({ source: { status: 404, markdown: "# Not found" } });

    expect(response.status).toBe(404);
    expect(jevRequests).toHaveLength(0);
  });

  it("returns 502 source_blocked when Frankensurf is disabled", async () => {
    const { response, surf, kv } = await convert({
      source: { status: 200, markdown: challenge },
      jev: "access_block",
      env: { DISABLE_FRANKENSURF: "true" }
    });

    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toMatchObject({ error: { code: "source_blocked" } });
    expect(surf).not.toHaveBeenCalled();
    expect(kv.writes).toHaveLength(0);
  });

  it("returns 502 when Frankensurf also only gets the block page", async () => {
    const { response, surf } = await convert({
      source: { status: 200, markdown: challenge },
      frankensurf: surfPage(challenge, "camoufox"),
      jev: "access_block"
    });

    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toMatchObject({ error: { code: "source_blocked" } });
    expect(surf).toHaveBeenCalledOnce();
  });

  it("serves the page uncached when Jev is unavailable", async () => {
    const kv = createMemoryKv();
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) =>
      String(input instanceof Request ? input.url : input).startsWith("https://api.typesafe.ai/")
        ? new Response("overloaded", { status: 529 })
        : new Response("<html><body>source</body></html>", { headers: { "Content-Type": "text/html" } })
    ));
    const env = makeEnv({
      DB: createMemoryD1().database,
      CACHE_KV: kv.namespace,
      REQUIRE_AUTH: "false",
      ALLOW_ANON: "true",
      DISABLE_BROWSER: "true",
      AI: { async toMarkdown() { return { markdown: realPage, tokens: 40 }; } }
    });

    const response = await app.fetch(new Request(`https://converting.md/${target}`), env);

    expect(response.status).toBe(200);
    expect(response.headers.get("X-Converting-Warnings")).toContain("content_check_unavailable");
    expect(kv.writes).toHaveLength(0);
  });

  it("refuses the fallback once the daily Frankensurf budget is spent", async () => {
    const { response, surf } = await convert({
      source: { status: 454, markdown: challenge },
      frankensurf: surfPage(realPage),
      env: { GLOBAL_DAILY_FRANKENSURF_LIMIT: "0" }
    });

    expect(response.status).toBe(429);
    await expect(response.json()).resolves.toMatchObject({ error: { code: "frankensurf_budget_exceeded" } });
    expect(surf).not.toHaveBeenCalled();
  });
});
