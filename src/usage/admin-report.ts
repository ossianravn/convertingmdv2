import type { Env } from "../types/env";
import type { UsagePeriod, UsageScope } from "../types/usage";
import type { ConversionMethod } from "../conversion/result";
import type { ErrorCode } from "../types/api";
import { listUsageCounters, type UsageCounterRow } from "./counters";
import { listConversionEvents, type ConversionEventRow } from "./events";
import { getPeriodKeys } from "./periods";

export interface AdminUsageReport {
  summary: {
    day: PeriodUsageSummary;
    month: PeriodUsageSummary;
  };
  counters: AdminUsageCounter[];
  recentEvents: AdminConversionEvent[];
}

export interface PeriodUsageSummary {
  periodKey: string;
  key: AdminUsageCounter[];
  global: AdminUsageCounter[];
}

export interface AdminUsageCounter {
  scope: UsageScope;
  scopeId: string;
  period: UsagePeriod;
  periodKey: string;
  requests: number;
  nativeRequests: number;
  aiRequests: number;
  browserRequests: number;
  imageRequests: number;
  browserMsUsed: number;
  browserMsReserved: number;
  bytesIn: number;
  bytesOut: number;
  createdAt: string;
  updatedAt: string;
}

export interface AdminConversionEvent {
  id: string;
  apiKeyId: string | null;
  requestId: string;
  urlHash: string;
  host: string;
  method: ConversionMethod | null;
  status: "success" | "error";
  statusCode: number;
  cacheStatus: "HIT" | "MISS";
  sourceContentType: string | null;
  inputBytes: number;
  outputBytes: number;
  browserMsUsed: number;
  errorCode: ErrorCode | null;
  createdAt: string;
}

export async function getAdminUsageReport(env: Env, now = new Date()): Promise<AdminUsageReport> {
  const [counterRows, eventRows] = await Promise.all([listUsageCounters(env), listConversionEvents(env)]);
  const counters = counterRows.map(toAdminCounter);
  const periods = getPeriodKeys(now);

  return {
    summary: {
      day: periodSummary(counters, "day", periods.day),
      month: periodSummary(counters, "month", periods.month)
    },
    counters,
    recentEvents: eventRows.map(toAdminEvent)
  };
}

function periodSummary(counters: AdminUsageCounter[], period: UsagePeriod, periodKey: string): PeriodUsageSummary {
  const current = counters.filter((counter) => counter.period === period && counter.periodKey === periodKey);
  return {
    periodKey,
    key: current.filter((counter) => counter.scope === "key"),
    global: current.filter((counter) => counter.scope === "global")
  };
}

function toAdminCounter(row: UsageCounterRow): AdminUsageCounter {
  return {
    scope: row.scope,
    scopeId: row.scope_id,
    period: row.period,
    periodKey: row.period_key,
    requests: row.requests,
    nativeRequests: row.native_requests,
    aiRequests: row.ai_requests,
    browserRequests: row.browser_requests,
    imageRequests: row.image_requests,
    browserMsUsed: row.browser_ms_used,
    browserMsReserved: row.browser_ms_reserved,
    bytesIn: row.bytes_in,
    bytesOut: row.bytes_out,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function toAdminEvent(row: ConversionEventRow): AdminConversionEvent {
  return {
    id: row.id,
    apiKeyId: row.api_key_id,
    requestId: row.request_id,
    urlHash: row.url_hash,
    host: row.host,
    method: row.method,
    status: row.status,
    statusCode: row.status_code,
    cacheStatus: row.cache_status,
    sourceContentType: row.source_content_type,
    inputBytes: row.input_bytes,
    outputBytes: row.output_bytes,
    browserMsUsed: row.browser_ms_used,
    errorCode: row.error_code,
    createdAt: row.created_at
  };
}
