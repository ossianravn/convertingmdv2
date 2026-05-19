export type UsageScope = "key" | "global";
export type UsagePeriod = "day" | "month";

export interface PeriodKeys {
  day: string;
  month: string;
}

export interface UsageCounter {
  scope: UsageScope;
  scopeId: string;
  period: UsagePeriod;
  periodKey: string;
  requests: number;
  browserMsUsed: number;
  browserMsReserved: number;
  imageRequests: number;
}

