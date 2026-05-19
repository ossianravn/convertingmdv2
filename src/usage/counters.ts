import type { Env } from "../types/env";
import type { UsagePeriod, UsageScope } from "../types/usage";
import { nowIso } from "../utils/dates";
import { getPeriodKeys } from "./periods";

export interface UsageCounterRow {
  scope: UsageScope;
  scope_id: string;
  period: UsagePeriod;
  period_key: string;
  requests: number;
  native_requests: number;
  ai_requests: number;
  browser_requests: number;
  image_requests: number;
  browser_ms_used: number;
  browser_ms_reserved: number;
  bytes_in: number;
  bytes_out: number;
  created_at: string;
  updated_at: string;
}

export async function ensureCounterRow(
  env: Env,
  scope: UsageScope,
  scopeId: string,
  period: UsagePeriod,
  periodKey: string,
  now: Date
): Promise<void> {
  const timestamp = nowIso(now);
  await env.DB.prepare(
    `INSERT OR IGNORE INTO usage_counters (
      scope, scope_id, period, period_key, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?)`
  )
    .bind(scope, scopeId, period, periodKey, timestamp, timestamp)
    .run();
}

export async function incrementCounter(
  env: Env,
  scope: UsageScope,
  scopeId: string,
  period: UsagePeriod,
  periodKey: string,
  column: CounterColumn,
  amount: number,
  now: Date
): Promise<void> {
  await ensureCounterRow(env, scope, scopeId, period, periodKey, now);
  await env.DB.prepare(`UPDATE usage_counters SET ${column} = ${column} + ?, updated_at = ? WHERE scope = ? AND scope_id = ? AND period = ? AND period_key = ?`)
    .bind(amount, nowIso(now), scope, scopeId, period, periodKey)
    .run();
}

export async function getCounterRow(
  env: Env,
  scope: UsageScope,
  scopeId: string,
  period: UsagePeriod,
  periodKey: string
): Promise<UsageCounterRow | null> {
  return env.DB.prepare(
    `SELECT scope, scope_id, period, period_key, requests, native_requests, ai_requests,
      browser_requests, image_requests, browser_ms_used, browser_ms_reserved,
      bytes_in, bytes_out, created_at, updated_at
    FROM usage_counters
    WHERE scope = ? AND scope_id = ? AND period = ? AND period_key = ?`
  )
    .bind(scope, scopeId, period, periodKey)
    .first<UsageCounterRow>();
}

export async function getRequestCount(
  env: Env,
  scope: UsageScope,
  scopeId: string,
  period: UsagePeriod,
  periodKey: string
): Promise<number> {
  const row = await getCounterRow(env, scope, scopeId, period, periodKey);
  return row?.requests ?? 0;
}

export async function getCounterValue(
  env: Env,
  scope: UsageScope,
  scopeId: string,
  period: UsagePeriod,
  periodKey: string,
  column: CounterColumn
): Promise<number> {
  const row = await getCounterRow(env, scope, scopeId, period, periodKey);
  return row?.[column] ?? 0;
}

export async function incrementCounterForPeriods(
  env: Env,
  scope: UsageScope,
  scopeId: string,
  column: CounterColumn,
  amount: number,
  now: Date
): Promise<void> {
  const periods = getPeriodKeys(now);
  await incrementCounter(env, scope, scopeId, "day", periods.day, column, amount, now);
  await incrementCounter(env, scope, scopeId, "month", periods.month, column, amount, now);
}

export async function incrementRequests(env: Env, apiKeyId: string, now: Date): Promise<void> {
  await incrementCounterForPeriods(env, "key", apiKeyId, "requests", 1, now);
  await incrementCounterForPeriods(env, "global", "all", "requests", 1, now);
}

export async function listUsageCounters(env: Env): Promise<UsageCounterRow[]> {
  const result = await env.DB.prepare(
    `SELECT scope, scope_id, period, period_key, requests, native_requests, ai_requests,
      browser_requests, image_requests, browser_ms_used, browser_ms_reserved,
      bytes_in, bytes_out, created_at, updated_at
    FROM usage_counters
    ORDER BY updated_at DESC
    LIMIT 500`
  ).all<UsageCounterRow>();
  return result.results;
}

export type CounterColumn =
  | "requests"
  | "native_requests"
  | "ai_requests"
  | "browser_requests"
  | "image_requests"
  | "browser_ms_used"
  | "browser_ms_reserved"
  | "bytes_in"
  | "bytes_out";
