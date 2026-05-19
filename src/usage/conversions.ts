import type { ConversionResult } from "../conversion/result";
import type { Env } from "../types/env";
import { incrementCounterForPeriods } from "./counters";

export async function incrementConversionCounters(
  env: Env,
  apiKeyId: string,
  result: ConversionResult,
  now: Date
): Promise<void> {
  if (result.cached) return;

  await incrementMethodCounter(env, apiKeyId, result, now);
  await incrementBytes(env, apiKeyId, result, now);
}

async function incrementMethodCounter(
  env: Env,
  apiKeyId: string,
  result: ConversionResult,
  now: Date
): Promise<void> {
  if (result.method === "browser") return;

  const column = result.method === "native" ? "native_requests" : "ai_requests";
  await incrementCounterForPeriods(env, "key", apiKeyId, column, 1, now);
  await incrementCounterForPeriods(env, "global", "all", column, 1, now);
}

async function incrementBytes(env: Env, apiKeyId: string, result: ConversionResult, now: Date): Promise<void> {
  await incrementCounterForPeriods(env, "key", apiKeyId, "bytes_in", result.inputBytes, now);
  await incrementCounterForPeriods(env, "global", "all", "bytes_in", result.inputBytes, now);
  await incrementCounterForPeriods(env, "key", apiKeyId, "bytes_out", result.outputBytes, now);
  await incrementCounterForPeriods(env, "global", "all", "bytes_out", result.outputBytes, now);
}

