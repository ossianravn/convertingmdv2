import type { PeriodKeys } from "../types/usage";
import { dayKey, monthKey } from "../utils/dates";

export function getPeriodKeys(now: Date): PeriodKeys {
  return {
    day: dayKey(now),
    month: monthKey(now)
  };
}

