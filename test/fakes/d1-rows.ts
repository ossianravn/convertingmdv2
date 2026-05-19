import type { UsagePeriod, UsageScope } from "../../src/types/usage";

export interface ApiKeyDbRow {
  id: string;
  name: string;
  prefix: string;
  key_hash: string;
  status: string;
  daily_request_limit: number;
  monthly_request_limit: number;
  allow_browser: number;
  auto_browser_fallback: number;
  daily_browser_ms_limit: number;
  monthly_browser_ms_limit: number;
  allow_images: number;
  daily_image_limit: number;
  monthly_image_limit: number;
  created_at: string;
  updated_at: string;
  last_used_at: string | null;
}

export interface CounterDbRow {
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

export interface ConversionEventDbRow {
  id: string;
  api_key_id: string | null;
  request_id: string;
  url_hash: string;
  host: string;
  method: string | null;
  status: string;
  status_code: number;
  cache_status: string;
  source_content_type: string | null;
  input_bytes: number;
  output_bytes: number;
  browser_ms_used: number;
  error_code: string | null;
  created_at: string;
}

export interface MemoryD1State {
  apiKeys: ApiKeyDbRow[];
  counters: Map<string, CounterDbRow>;
  conversionEvents: ConversionEventDbRow[];
}

export function apiKeyRow(overrides: Partial<ApiKeyDbRow>): ApiKeyDbRow {
  return {
    id: "key_test",
    name: "Test key",
    prefix: "cmd_live_test",
    key_hash: "hash",
    status: "active",
    daily_request_limit: 1000,
    monthly_request_limit: 25000,
    allow_browser: 0,
    auto_browser_fallback: 0,
    daily_browser_ms_limit: 0,
    monthly_browser_ms_limit: 0,
    allow_images: 0,
    daily_image_limit: 0,
    monthly_image_limit: 0,
    created_at: "2026-05-19T00:00:00.000Z",
    updated_at: "2026-05-19T00:00:00.000Z",
    last_used_at: null,
    ...overrides
  };
}

export function counterRow(overrides: Partial<CounterDbRow>): CounterDbRow {
  return {
    scope: "key",
    scope_id: "key_test",
    period: "day",
    period_key: "2026-05-19",
    requests: 0,
    native_requests: 0,
    ai_requests: 0,
    browser_requests: 0,
    image_requests: 0,
    browser_ms_used: 0,
    browser_ms_reserved: 0,
    bytes_in: 0,
    bytes_out: 0,
    created_at: "2026-05-19T00:00:00.000Z",
    updated_at: "2026-05-19T00:00:00.000Z",
    ...overrides
  };
}

export function conversionEventRow(overrides: Partial<ConversionEventDbRow>): ConversionEventDbRow {
  return {
    id: "evt_test",
    api_key_id: "key_test",
    request_id: "req_test",
    url_hash: "hash_test",
    host: "example.com",
    method: "native",
    status: "success",
    status_code: 200,
    cache_status: "MISS",
    source_content_type: "text/markdown",
    input_bytes: 10,
    output_bytes: 8,
    browser_ms_used: 0,
    error_code: null,
    created_at: "2026-05-19T00:00:00.000Z",
    ...overrides
  };
}

export function counterKey(scope: UsageScope, scopeId: string, period: UsagePeriod, periodKey: string): string {
  return `${scope}:${scopeId}:${period}:${periodKey}`;
}
