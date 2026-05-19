import { describe, expect, it } from "vitest";
import { app } from "../src/app";
import { makeEnv } from "./helpers";

describe("health route", () => {
  it("returns a healthy JSON response with a request id", async () => {
    const response = await app.fetch(new Request("https://converting.md/healthz"), makeEnv());

    expect(response.status).toBe(200);
    expect(response.headers.get("X-Converting-Request-Id")).toMatch(/^req_/);
    await expect(response.json()).resolves.toEqual({ ok: true });
  });

  it("returns root documentation as JSON", async () => {
    const response = await app.fetch(new Request("https://converting.md/"), makeEnv());

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toContain("application/json");
    expect(await response.json()).toMatchObject({ service: "converting.md" });
  });

  it("rejects query-string API keys before public routes", async () => {
    const response = await app.fetch(new Request("https://converting.md/healthz?api_key=cmd_live_bad"), makeEnv());

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ error: { code: "invalid_request" } });
  });
});
