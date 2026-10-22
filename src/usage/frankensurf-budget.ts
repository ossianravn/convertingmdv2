import type { FrankensurfConfig } from "../config";
import { ConvertingError } from "../http/errors";
import type { Env } from "../types/env";
import type { UsagePeriod } from "../types/usage";
import { getCounterRow, incrementCounterForPeriods } from "./counters";
import { getPeriodKeys } from "./periods";

// Frankensurf runs browsers on our own server, so every call is counted before
// it is made and the request fails closed once a global budget is spent. Calls
// are counted per key too, for usage reports.
export async function reserveFrankensurfCall(
  env: Env,
  config: FrankensurfConfig,
  apiKeyId: string,
  now: Date
): Promise<void> {
  const periods = getPeriodKeys(now);
  await assertWithinLimit(env, "day", periods.day, config.globalDailyLimit);
  await assertWithinLimit(env, "month", periods.month, config.globalMonthlyLimit);

  await incrementCounterForPeriods(env, "global", "all", "frankensurf_requests", 1, now);
  await incrementCounterForPeriods(env, "key", apiKeyId, "frankensurf_requests", 1, now);
}

async function assertWithinLimit(env: Env, period: UsagePeriod, periodKey: string, limit: number): Promise<void> {
  const row = await getCounterRow(env, "global", "all", period, periodKey);
  if ((row?.frankensurf_requests ?? 0) < limit) return;

  throw new ConvertingError("frankensurf_budget_exceeded", "The fallback fetch budget is spent for now.", 429);
}
