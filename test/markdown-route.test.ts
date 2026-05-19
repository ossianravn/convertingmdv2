import { describe, expect, it } from "vitest";
import { app } from "../src/app";
import { makeEnv } from "./helpers";

describe("markdown route authentication", () => {
  it("rejects missing API key on GET /v1/markdown", async () => {
    const response = await app.fetch(
      new Request("https://converting.md/v1/markdown?url=https%3A%2F%2Fexample.com"),
      makeEnv()
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "missing_api_key" }
    });
  });

  it("rejects missing API key on POST /v1/markdown", async () => {
    const response = await app.fetch(
      new Request("https://converting.md/v1/markdown", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: "https://example.com" })
      }),
      makeEnv()
    );

    expect(response.status).toBe(401);
    expect(response.headers.get("X-Converting-Request-Id")).toMatch(/^req_/);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "missing_api_key" }
    });
  });

  it("rejects query string API keys", async () => {
    const response = await app.fetch(
      new Request("https://converting.md/v1/markdown?url=https%3A%2F%2Fexample.com&api_key=cmd_live_bad"),
      makeEnv()
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "invalid_request" }
    });
  });

  it("requires auth for the convenience endpoint", async () => {
    const response = await app.fetch(new Request("https://converting.md/https://example.com/page"), makeEnv());

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "missing_api_key" }
    });
  });
});
