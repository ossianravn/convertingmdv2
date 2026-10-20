import { describe, expect, it } from "vitest";
import { app } from "../src/app";
import { acceptsHtml } from "../src/http/accept";
import { createAssetsStub, frontpageHtml, makeEnv } from "./helpers";

const browserAccept = "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8";

function getHome(accept: string | null, env = makeEnv()): Promise<Response> {
  const request = new Request("https://converting.md/", accept === null ? {} : { headers: { Accept: accept } });
  return Promise.resolve(app.fetch(request, env));
}

describe("home route", () => {
  it("serves the frontpage to browsers with page security headers", async () => {
    const response = await getHome(browserAccept);

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toContain("text/html");
    expect(response.headers.get("X-Converting-Request-Id")).toMatch(/^req_/);
    expect(response.headers.get("Vary")).toBe("Accept");
    expect(response.headers.get("Content-Security-Policy")).toContain("script-src 'self'");
    expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff");
    await expect(response.text()).resolves.toBe(frontpageHtml);
  });

  it.each([null, "*/*", "application/json", "text/html;q=0"])("keeps JSON for Accept %s", async (accept) => {
    const response = await getHome(accept);

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toContain("application/json");
    expect(response.headers.get("Vary")).toBe("Accept");
    await expect(response.json()).resolves.toMatchObject({ service: "converting.md" });
  });

  it("forwards conditional requests so unchanged pages return 304", async () => {
    const env = makeEnv({
      ASSETS: createAssetsStub(async (request) => {
        const matches = request.headers.get("If-None-Match") === '"home"';
        return new Response(matches ? null : frontpageHtml, { status: matches ? 304 : 200 });
      })
    });
    const response = await app.fetch(
      new Request("https://converting.md/", { headers: { Accept: browserAccept, "If-None-Match": '"home"' } }),
      env
    );

    expect(response.status).toBe(304);
  });

  it("fails loudly when the frontpage asset is missing", async () => {
    const env = makeEnv({ ASSETS: createAssetsStub(async () => new Response("Not found", { status: 404 })) });
    const response = await getHome(browserAccept, env);

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toMatchObject({ error: { code: "internal_error" } });
  });
});

describe("acceptsHtml", () => {
  it("requires an explicit, non-zero text/html range", () => {
    expect(acceptsHtml(browserAccept)).toBe(true);
    expect(acceptsHtml("TEXT/HTML; q=0.5")).toBe(true);
    expect(acceptsHtml("text/*")).toBe(false);
    expect(acceptsHtml("text/html;q=0.0")).toBe(false);
    expect(acceptsHtml(undefined)).toBe(false);
  });
});
