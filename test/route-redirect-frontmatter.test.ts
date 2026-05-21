import { afterEach, describe, expect, it, vi } from "vitest";
import { hashApiKey } from "../src/auth/hash";
import { app } from "../src/app";
import { makeEnv } from "./helpers";
import { apiKeyRow, createMemoryD1 } from "./fakes/d1";
import { createMemoryKv } from "./fakes/kv";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("redirected markdown responses", () => {
  it("follows source redirects and returns the final URL as first frontmatter field", async () => {
    const setup = await authedSetup();
    vi.stubGlobal("fetch", edcRedirectFetch());

    const response = await app.fetch(
      new Request("https://converting.md/https://www.edc.dk/roenne", {
        headers: { Authorization: `Bearer ${setup.rawKey}` }
      }),
      setup.env
    );

    expect(response.status, await response.clone().text()).toBe(200);
    expect(response.headers.get("X-Converting-Source-Url")).toBe(finalEdcUrl);
    expect((await response.text()).startsWith(`---\nurl: ${finalEdcUrl}\ndescription:`)).toBe(true);
  });
});

const finalEdcUrl = "https://www.edc.dk/ejendomsmaegler/roenne/bornholmerbo/";

async function authedSetup() {
  const rawKey = "cmd_live_redirect_secret";
  const pepper = "pepper";
  const d1 = createMemoryD1();
  d1.seedApiKey(
    apiKeyRow({
      id: "key_redirect",
      key_hash: await hashApiKey(rawKey, pepper),
      prefix: rawKey.slice(0, 17)
    })
  );

  return {
    rawKey,
    env: makeEnv({
      DB: d1.database,
      CACHE_KV: createMemoryKv().namespace,
      API_KEY_PEPPER: pepper,
      AI: { async toMarkdown() { return { markdown: edcFrontmatter() }; } }
    })
  };
}

function edcRedirectFetch() {
  return vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.endsWith("/roenne")) return redirectResponse("/roenne/");
    if (url.endsWith("/roenne/")) return redirectResponse("/ejendomsmaegler/roenne/bornholmerbo");
    if (url.endsWith("/bornholmerbo")) return redirectResponse("/ejendomsmaegler/roenne/bornholmerbo/");
    return new Response("<!doctype html><html><head><title>EDC</title></head><body>EDC</body></html>", {
      headers: { "Content-Type": "application/octet-stream" }
    });
  });
}

function redirectResponse(location: string): Response {
  return new Response(null, { status: 301, headers: { Location: location } });
}

function edcFrontmatter(): string {
  return `---
description: EDC BornholmerBo
title: EDC BornholmerBo, 371, 3700
image: https://billeder.edc.dk/example.jpg
---

# EDC BornholmerBo`;
}
