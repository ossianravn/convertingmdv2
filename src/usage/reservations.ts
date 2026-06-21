import type { AppConfig } from "../config";
import { ConvertingError } from "../http/errors";
import type { ApiKey } from "../types/api";
import type { Env } from "../types/env";
import type { UsagePeriod, UsageScope } from "../types/usage";
import { getCounterRow, incrementCounterForPeriods } from "./counters";
import { getPeriodKeys } from "./periods";
import { assertBrowserAllowed, type BrowserPermission } from "./quota";

export interface BrowserReservation {
  keyId: string;
  reservedMs: number;
}

export async function reserveBrowserBudget(
  env: Env,
  apiKey: ApiKey,
  config: AppConfig,
  now: Date,
  permission: BrowserPermission = "explicit"
): Promise<BrowserReservation> {
  assertBrowserAllowed(apiKey, config.disableBrowser, permission);

  const reservedMs = config.maxBrowserMsPerRequest;
  const periods = getPeriodKeys(now);
  await assertBrowserPeriod(env, "key", apiKey.id, "day", periods.day, apiKey.dailyBrowserMsLimit, reservedMs);
  await assertBrowserPeriod(env, "key", apiKey.id, "month", periods.month, apiKey.monthlyBrowserMsLimit, reservedMs);
  await assertBrowserPeriod(env, "global", "all", "day", periods.day, config.globalDailyBrowserMsLimit, reservedMs);
  await assertBrowserPeriod(env, "global", "all", "month", periods.month, config.globalMonthlyBrowserMsLimit, reservedMs);

  await incrementCounterForPeriods(env, "key", apiKey.id, "browser_ms_reserved", reservedMs, now);
  await incrementCounterForPeriods(env, "global", "all", "browser_ms_reserved", reservedMs, now);

  return { keyId: apiKey.id, reservedMs };
}

export async function commitBrowserUsage(
  env: Env,
  reservation: BrowserReservation,
  actualMs: number,
  now: Date
): Promise<void> {
  const chargedMs = normalizeBrowserMs(actualMs, reservation.reservedMs);
  await incrementCounterForPeriods(env, "key", reservation.keyId, "browser_ms_reserved", -reservation.reservedMs, now);
  await incrementCounterForPeriods(env, "global", "all", "browser_ms_reserved", -reservation.reservedMs, now);
  await incrementCounterForPeriods(env, "key", reservation.keyId, "browser_ms_used", chargedMs, now);
  await incrementCounterForPeriods(env, "global", "all", "browser_ms_used", chargedMs, now);
  await incrementCounterForPeriods(env, "key", reservation.keyId, "browser_requests", 1, now);
  await incrementCounterForPeriods(env, "global", "all", "browser_requests", 1, now);
}

export async function releaseBrowserReservation(
  env: Env,
  reservation: BrowserReservation,
  now: Date
): Promise<void> {
  await incrementCounterForPeriods(env, "key", reservation.keyId, "browser_ms_reserved", -reservation.reservedMs, now);
  await incrementCounterForPeriods(env, "global", "all", "browser_ms_reserved", -reservation.reservedMs, now);
}

async function assertBrowserPeriod(
  env: Env,
  scope: UsageScope,
  scopeId: string,
  period: UsagePeriod,
  periodKey: string,
  limit: number,
  reservedMs: number
): Promise<void> {
  const row = await getCounterRow(env, scope, scopeId, period, periodKey);
  const committed = row?.browser_ms_used ?? 0;
  const reserved = row?.browser_ms_reserved ?? 0;
  if (committed + reserved + reservedMs <= limit) return;

  const code = scope === "global" ? "global_browser_budget_exceeded" : "browser_budget_exceeded";
  throw new ConvertingError(code, "Browser Run budget exceeded.", 429);
}

function normalizeBrowserMs(actualMs: number, fallbackMs: number): number {
  if (!Number.isFinite(actualMs) || actualMs < 0) return fallbackMs;
  return Math.trunc(actualMs);
}
