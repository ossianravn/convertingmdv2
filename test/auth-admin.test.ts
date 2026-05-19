import { describe, expect, it } from "vitest";
import { app } from "../src/app";
import { hashApiKey } from "../src/auth/hash";
import { getPeriodKeys } from "../src/usage/periods";
import { makeEnv } from "./helpers";
import { apiKeyRow, conversionEventRow, counterRow, createMemoryD1, type ApiKeyDbRow } from "./fakes/d1";

describe("auth and admin routes", () => {
  it("rejects revoked API keys before quota or conversion", async () => {
    const { env, rawKey } = await authedEnv({ status: "revoked" });
    const response = await app.fetch(markdownRequest(rawKey), env);

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "revoked_api_key" }
    });
  });

  it("creates an API key and returns the raw secret once", async () => {
    const d1 = createMemoryD1();
    const env = makeEnv({
      DB: d1.database,
      ADMIN_TOKEN: "admin-token",
      API_KEY_PEPPER: "pepper"
    });

    const createResponse = await app.fetch(adminCreateRequest(), env);
    expect(createResponse.status).toBe(201);

    const created = await createResponse.json<Record<string, string>>();
    expect(created["apiKey"]).toMatch(/^cmd_live_/);
    expect(d1.apiKeys).toHaveLength(1);
    expect(d1.apiKeys[0]?.key_hash).not.toBe(created["apiKey"]);

    const listResponse = await app.fetch(adminListRequest(), env);
    expect(listResponse.status).toBe(200);
    const listPayload = await listResponse.json();
    expect(listPayload).toMatchObject({
      apiKeys: [{ id: created["id"], prefix: created["prefix"] }]
    });
    expect(JSON.stringify(listPayload).includes(created["apiKey"] ?? "")).toBe(false);
  });

  it("requires admin bearer token for admin routes", async () => {
    const response = await app.fetch(new Request("https://converting.md/v1/admin/api-keys"), makeEnv());

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "missing_api_key" }
    });
  });

  it("rejects API keys and query-string admin tokens on admin routes", async () => {
    const { env, rawKey } = await authedEnv();

    const apiKeyResponse = await app.fetch(
      new Request("https://converting.md/v1/admin/api-keys", { headers: { Authorization: `Bearer ${rawKey}` } }),
      env
    );
    const queryTokenResponse = await app.fetch(
      new Request("https://converting.md/v1/admin/api-keys?admin_token=admin-token"),
      makeEnv({ ADMIN_TOKEN: "admin-token" })
    );
    const queryApiKeyResponse = await app.fetch(
      new Request("https://converting.md/v1/admin/api-keys?api_key=cmd_live_bad", {
        headers: { Authorization: "Bearer admin-token" }
      }),
      makeEnv({ ADMIN_TOKEN: "admin-token" })
    );

    expect(apiKeyResponse.status).toBe(401);
    await expect(apiKeyResponse.json()).resolves.toMatchObject({ error: { code: "invalid_api_key" } });
    expect(queryTokenResponse.status).toBe(401);
    await expect(queryTokenResponse.json()).resolves.toMatchObject({ error: { code: "missing_api_key" } });
    expect(queryApiKeyResponse.status).toBe(400);
    await expect(queryApiKeyResponse.json()).resolves.toMatchObject({ error: { code: "invalid_request" } });
  });

  it("patches key status, quotas, and capabilities without returning raw keys", async () => {
    const d1 = createMemoryD1();
    d1.seedApiKey(apiKeyRow({ id: "key_patch", name: "Patch target" }));
    const env = makeEnv({ DB: d1.database, ADMIN_TOKEN: "admin-token" });

    const revokeResponse = await app.fetch(
      adminPatchRequest("key_patch", {
        status: "revoked",
        allowBrowser: true,
        dailyBrowserMsLimit: 600000,
        monthlyRequestLimit: 42
      }),
      env
    );
    const reactivateResponse = await app.fetch(adminPatchRequest("key_patch", { status: "active", allowBrowser: false }), env);

    expect(revokeResponse.status).toBe(200);
    const revoked = await revokeResponse.json<Record<string, unknown>>();
    expect(revoked).toMatchObject({
      id: "key_patch",
      status: "revoked",
      allowBrowser: true,
      dailyBrowserMsLimit: 600000,
      monthlyRequestLimit: 42
    });
    expect(JSON.stringify(revoked)).not.toContain("apiKey");
    expect(reactivateResponse.status).toBe(200);
    await expect(reactivateResponse.json()).resolves.toMatchObject({ status: "active", allowBrowser: false });
  });

  it("returns key/global usage summaries and recent safe conversion events", async () => {
    const d1 = createMemoryD1();
    const periods = getPeriodKeys(new Date());
    d1.seedCounter(
      counterRow({ scope_id: "key_usage", period: "day", period_key: periods.day, requests: 3, ai_requests: 1, bytes_out: 120 })
    );
    d1.seedCounter(
      counterRow({ scope: "global", scope_id: "all", period: "month", period_key: periods.month, requests: 9, browser_ms_used: 333 })
    );
    d1.seedConversionEvent(conversionEventRow({ id: "evt_old", created_at: "2026-05-18T00:00:00.000Z" }));
    d1.seedConversionEvent(
      conversionEventRow({
        id: "evt_new",
        api_key_id: "key_usage",
        request_id: "req_new",
        url_hash: "hash_without_raw_url",
        method: "ai",
        cache_status: "HIT",
        output_bytes: 44,
        created_at: "2026-05-19T00:00:00.000Z"
      })
    );
    const env = makeEnv({ DB: d1.database, ADMIN_TOKEN: "admin-token" });

    const response = await app.fetch(adminUsageRequest(), env);

    expect(response.status).toBe(200);
    const payload = (await response.json()) as AdminUsagePayload;
    expect(payload.usage.summary.day.key).toContainEqual(
      expect.objectContaining({ scopeId: "key_usage", requests: 3, aiRequests: 1, bytesOut: 120 })
    );
    expect(payload.usage.summary.month.global).toContainEqual(
      expect.objectContaining({ scopeId: "all", requests: 9, browserMsUsed: 333 })
    );
    expect(payload.usage.recentEvents[0]).toMatchObject({
      id: "evt_new",
      apiKeyId: "key_usage",
      requestId: "req_new",
      urlHash: "hash_without_raw_url",
      cacheStatus: "HIT"
    });
    expect(JSON.stringify(payload)).not.toContain("https://");
    expect(JSON.stringify(payload)).not.toContain("api_key_id");
  });
});

interface AdminUsagePayload {
  usage: {
    summary: {
      day: { key: AdminUsageCounter[]; global: AdminUsageCounter[] };
      month: { key: AdminUsageCounter[]; global: AdminUsageCounter[] };
    };
    recentEvents: Array<Record<string, unknown>>;
  };
}

interface AdminUsageCounter {
  scopeId: string;
  requests: number;
  aiRequests?: number;
  browserMsUsed?: number;
  bytesOut?: number;
}

async function authedEnv(overrides: Partial<ApiKeyDbRow> = {}) {
  const rawKey = "cmd_live_test_secret";
  const pepper = "pepper";
  const d1 = createMemoryD1();
  d1.seedApiKey(
    apiKeyRow({
      key_hash: await hashApiKey(rawKey, pepper),
      prefix: rawKey.slice(0, 17),
      ...overrides
    })
  );

  return {
    rawKey,
    d1,
    env: makeEnv({ DB: d1.database, API_KEY_PEPPER: pepper })
  };
}

function markdownRequest(rawKey: string): Request {
  return new Request("https://converting.md/v1/markdown?url=https%3A%2F%2Fexample.com", {
    headers: { Authorization: `Bearer ${rawKey}` }
  });
}

function adminCreateRequest(): Request {
  return new Request("https://converting.md/v1/admin/api-keys", {
    method: "POST",
    headers: {
      Authorization: "Bearer admin-token",
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ name: "Personal key", dailyRequestLimit: 10, monthlyRequestLimit: 20 })
  });
}

function adminListRequest(): Request {
  return new Request("https://converting.md/v1/admin/api-keys", {
    headers: { Authorization: "Bearer admin-token" }
  });
}

function adminUsageRequest(): Request {
  return new Request("https://converting.md/v1/admin/usage", {
    headers: { Authorization: "Bearer admin-token" }
  });
}

function adminPatchRequest(id: string, body: Record<string, unknown>): Request {
  return new Request(`https://converting.md/v1/admin/api-keys/${id}`, {
    method: "PATCH",
    headers: {
      Authorization: "Bearer admin-token",
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });
}
