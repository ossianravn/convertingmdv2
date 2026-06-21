import { afterEach, describe, expect, it, vi } from "vitest";
import { app } from "../src/app";
import { makeEnv } from "./helpers";
import { createMemoryD1 } from "./fakes/d1";
import { createMemoryKv } from "./fakes/kv";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("anonymous automatic browser fallback", () => {
  it("uses Browser Run for weak address-bar output while keeping explicit browser mode blocked", async () => {
    const d1 = createMemoryD1();
    const fetchSpy = vi
      .fn()
      .mockResolvedValueOnce(htmlResponse(scriptHeavyShell()))
      .mockResolvedValueOnce(htmlResponse(scriptHeavyShell()))
      .mockResolvedValueOnce(browserResponse("# Hvordan booker jeg et ophold?\n\nTrin 1: Log ind og registrer dit gavekort."));
    vi.stubGlobal("fetch", fetchSpy);

    const env = makeEnv({
      DB: d1.database,
      CACHE_KV: createMemoryKv().namespace,
      REQUIRE_AUTH: "false",
      ALLOW_ANON: "true",
      CLOUDFLARE_ACCOUNT_ID: "acct",
      CLOUDFLARE_BROWSER_API_TOKEN: "token",
      AI: { async toMarkdown() { return { markdown: weakShellMarkdown(), tokens: 104 }; } }
    });

    const response = await app.fetch(new Request("https://converting.md/https://example.com/help"), env);

    expect(response.status, await response.clone().text()).toBe(200);
    expect(response.headers.get("X-Converting-Method")).toBe("browser");
    expect(response.headers.get("X-Browser-Ms-Used")).toBe("432");
    expect(response.headers.get("X-Converting-Warnings")).toContain("browser_fallback_from_weak_ai");
    expect(await response.text()).toContain("Hvordan booker jeg et ophold?");
    expect(fetchSpy).toHaveBeenCalledTimes(3);
  });
});

function htmlResponse(html: string): Response {
  return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8" } });
}

function browserResponse(markdown: string): Response {
  return new Response(markdown, { headers: { "X-Browser-Ms-Used": "432" } });
}

function scriptHeavyShell(): string {
  return `
    <!doctype html>
    <html>
      <body class="loading">
        <div id="loader">Loading</div>
        <div role="dialog"><strong>Sorry to interrupt</strong><p>CSS Error</p></div>
        <script>${"window.__chunk='x';".repeat(900)}</script>
      </body>
    </html>
  `;
}

function weakShellMarkdown(): string {
  return `---
url: https://example.com/help
description: Generic help center metadata.
---

Loading

Sorry to interrupt

CSS Error`;
}
