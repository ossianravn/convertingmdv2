import { afterEach, describe, expect, it, vi } from "vitest";
import { app } from "../src/app";
import { hashApiKey } from "../src/auth/hash";
import { getPeriodKeys } from "../src/usage/periods";
import { makeEnv } from "./helpers";
import { apiKeyRow, counterRow, createMemoryD1, type ApiKeyDbRow, type CounterDbRow } from "./fakes/d1";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("request quotas", () => {
  it("increments key and global request counters before conversion", async () => {
    const { env, rawKey, d1 } = await createKeyEnv();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("# Native", { headers: { "Content-Type": "text/markdown" } }))
    );

    const response = await app.fetch(markdownRequest(rawKey), env);

    expect(response.status).toBe(200);
    await expect(response.text()).resolves.toBe("---\nurl: https://example.com/\n---\n\n# Native");

    const periods = getPeriodKeys(new Date());
    expect(findCounter(d1.counters, "key", "day", periods.day)?.requests).toBe(1);
    expect(findCounter(d1.counters, "key", "month", periods.month)?.requests).toBe(1);
    expect(findCounter(d1.counters, "global", "day", periods.day)?.requests).toBe(1);
    expect(findCounter(d1.counters, "global", "month", periods.month)?.requests).toBe(1);
    expect(d1.apiKeys[0]?.last_used_at).toEqual(expect.any(String));
  });

  it("rejects over daily request quota and does not increment counters", async () => {
    const { env, rawKey, d1 } = await createKeyEnv({ daily_request_limit: 1 });
    const periods = getPeriodKeys(new Date());
    d1.seedCounter(counterRow({ scope_id: "key_quota", period: "day", period_key: periods.day, requests: 1 }));
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);

    const response = await app.fetch(markdownRequest(rawKey), env);

    expect(response.status).toBe(429);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "quota_exceeded" }
    });
    expect(findCounter(d1.counters, "key", "day", periods.day)?.requests).toBe(1);
    expect(findCounter(d1.counters, "global", "day", periods.day)).toBeUndefined();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("rejects over monthly request quota", async () => {
    const { env, rawKey, d1 } = await createKeyEnv({ monthly_request_limit: 1 });
    const periods = getPeriodKeys(new Date());
    d1.seedCounter(counterRow({ scope_id: "key_quota", period: "month", period_key: periods.month, requests: 1 }));
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);

    const response = await app.fetch(markdownRequest(rawKey), env);

    expect(response.status).toBe(429);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "quota_exceeded" }
    });
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

async function createKeyEnv(overrides: Partial<ApiKeyDbRow> = {}) {
  const rawKey = "cmd_live_quota_secret";
  const pepper = "pepper";
  const d1 = createMemoryD1();
  d1.seedApiKey(
    apiKeyRow({
      id: "key_quota",
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

function findCounter(
  counters: Map<string, CounterDbRow>,
  scope: "key" | "global",
  period: "day" | "month",
  periodKey: string
): CounterDbRow | undefined {
  return [...counters.values()].find((row) => {
    return row.scope === scope && row.period === period && row.period_key === periodKey;
  });
}
