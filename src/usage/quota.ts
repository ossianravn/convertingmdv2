import { ConvertingError } from "../http/errors";
import type { ApiKey } from "../types/api";
import type { Env } from "../types/env";
import { getPeriodKeys } from "./periods";
import { getCounterValue, getRequestCount, incrementCounterForPeriods, incrementRequests } from "./counters";

export interface RequestQuotaResult {
  dailyRemaining: number;
  monthlyRemaining: number;
}

export async function enforceRequestQuota(env: Env, apiKey: ApiKey, now: Date): Promise<RequestQuotaResult> {
  const periods = getPeriodKeys(now);
  const dailyUsed = await getRequestCount(env, "key", apiKey.id, "day", periods.day);
  const monthlyUsed = await getRequestCount(env, "key", apiKey.id, "month", periods.month);

  assertUnderLimit(dailyUsed, apiKey.dailyRequestLimit, "Daily request quota exceeded for this API key.");
  assertUnderLimit(monthlyUsed, apiKey.monthlyRequestLimit, "Monthly request quota exceeded for this API key.");

  await incrementRequests(env, apiKey.id, now);

  return {
    dailyRemaining: remainingAfterIncrement(dailyUsed, apiKey.dailyRequestLimit),
    monthlyRemaining: remainingAfterIncrement(monthlyUsed, apiKey.monthlyRequestLimit)
  };
}

export function assertBrowserAllowed(apiKey: ApiKey, disabled: boolean): void {
  if (disabled || !apiKey.allowBrowser) {
    throw new ConvertingError("browser_not_allowed", "Browser conversion is not allowed for this API key.", 403);
  }
}

export function assertImageAllowed(apiKey: ApiKey, disabled: boolean): void {
  if (disabled || !apiKey.allowImages) {
    throw new ConvertingError("image_conversion_not_allowed", "Image conversion is not allowed for this API key.", 403);
  }
}

export async function enforceImageQuota(
  env: Env,
  apiKey: ApiKey,
  config: {
    disableImageConversion: boolean;
    globalDailyImageLimit: number;
    globalMonthlyImageLimit: number;
  },
  now: Date
): Promise<void> {
  assertImageAllowed(apiKey, config.disableImageConversion);

  const periods = getPeriodKeys(now);
  await assertImagePeriod(env, "key", apiKey.id, "day", periods.day, apiKey.dailyImageLimit);
  await assertImagePeriod(env, "key", apiKey.id, "month", periods.month, apiKey.monthlyImageLimit);
  await assertImagePeriod(env, "global", "all", "day", periods.day, config.globalDailyImageLimit);
  await assertImagePeriod(env, "global", "all", "month", periods.month, config.globalMonthlyImageLimit);

  await incrementCounterForPeriods(env, "key", apiKey.id, "image_requests", 1, now);
  await incrementCounterForPeriods(env, "global", "all", "image_requests", 1, now);
}

function assertUnderLimit(used: number, limit: number, message: string): void {
  if (used >= limit) {
    throw new ConvertingError("quota_exceeded", message, 429);
  }
}

function remainingAfterIncrement(usedBefore: number, limit: number): number {
  return Math.max(0, limit - usedBefore - 1);
}

async function assertImagePeriod(
  env: Env,
  scope: "key" | "global",
  scopeId: string,
  period: "day" | "month",
  periodKey: string,
  limit: number
): Promise<void> {
  const used = await getCounterValue(env, scope, scopeId, period, periodKey, "image_requests");
  if (used < limit) return;

  const code = scope === "global" ? "global_image_budget_exceeded" : "quota_exceeded";
  throw new ConvertingError(code, "Image conversion quota exceeded.", 429);
}
