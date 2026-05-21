import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchWithLimits } from "../src/http/fetch-with-limits";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("fetchWithLimits", () => {
  it("follows validated redirects and returns the final URL", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(new Response(null, { status: 302, headers: { Location: "https://example.com/final" } }))
        .mockResolvedValueOnce(new Response("# Final", { headers: { "Content-Type": "text/markdown" } }))
    );

    const result = await fetchWithLimits("https://example.com/start", fetchOptions());

    expect(result.url).toBe("https://example.com/final");
    expect(new TextDecoder().decode(result.body)).toBe("# Final");
  });

  it("rejects redirects to blocked hosts", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(null, { status: 302, headers: { Location: "http://127.0.0.1" } }))
    );

    await expect(fetchWithLimits("https://example.com/start", fetchOptions())).rejects.toMatchObject({
      code: "blocked_url",
      status: 400
    });
  });

  it("rejects redirect chains over the configured maximum", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(null, { status: 302, headers: { Location: "https://example.com/next" } }))
    );

    await expect(fetchWithLimits("https://example.com/start", fetchOptions({ maxRedirects: 1 }))).rejects.toMatchObject({
      code: "blocked_url",
      status: 400
    });
  });

  it("rejects source bodies over the byte limit", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("too-large")));

    await expect(fetchWithLimits("https://example.com/start", fetchOptions({ maxBytes: 3 }))).rejects.toMatchObject({
      code: "source_too_large",
      status: 413
    });
  });

  it("uses runtime redirect following when manual redirects return an empty headerless response", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(new Response(null))
        .mockResolvedValueOnce(responseWithUrl("# Final", "https://example.com/final"))
    );

    const result = await fetchWithLimits("https://example.com/start", fetchOptions());

    expect(result.url).toBe("https://example.com/final");
    expect(new TextDecoder().decode(result.body)).toBe("# Final");
  });

  it("rejects runtime-followed redirects to blocked final URLs", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(new Response(null))
        .mockResolvedValueOnce(responseWithUrl("private", "http://127.0.0.1/private"))
    );

    await expect(fetchWithLimits("https://example.com/start", fetchOptions())).rejects.toMatchObject({
      code: "blocked_url",
      status: 400
    });
  });
});

function fetchOptions(overrides = {}) {
  return {
    accept: "text/markdown",
    maxBytes: 1024,
    maxRedirects: 5,
    timeoutMs: 1000,
    userAgent: "converting.md/0.1",
    ...overrides
  };
}

function responseWithUrl(body: string, url: string): Response {
  const response = new Response(body, { headers: { "Content-Type": "text/markdown" } });
  Object.defineProperty(response, "url", { value: url });
  return response;
}
