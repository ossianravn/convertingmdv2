import type { ConversionMethod, ConversionResult } from "../conversion/result";
import { createId, sha256Hex } from "../utils/crypto";
import { nowIso } from "../utils/dates";
import type { ErrorCode } from "../types/api";
import type { Env } from "../types/env";
import { validateAndNormalizeUrl } from "../security/url";

export interface ConversionEventInput {
  apiKeyId: string;
  requestId: string;
  targetUrl: string;
  method: ConversionMethod | null;
  status: "success" | "error";
  statusCode: number;
  cacheStatus: "HIT" | "MISS";
  sourceContentType: string | null;
  inputBytes: number;
  outputBytes: number;
  browserMsUsed: number;
  errorCode: ErrorCode | null;
  now: Date;
}

export interface ConversionEventRow {
  id: string;
  api_key_id: string | null;
  request_id: string;
  url_hash: string;
  host: string;
  method: ConversionMethod | null;
  status: "success" | "error";
  status_code: number;
  cache_status: "HIT" | "MISS";
  source_content_type: string | null;
  input_bytes: number;
  output_bytes: number;
  browser_ms_used: number;
  error_code: ErrorCode | null;
  created_at: string;
}

export async function logConversionEvent(env: Env, input: ConversionEventInput): Promise<void> {
  const target = await eventTarget(input.targetUrl);
  await env.DB.prepare(
    `INSERT INTO conversion_events (
      id, api_key_id, request_id, url_hash, host, method, status, status_code,
      cache_status, source_content_type, input_bytes, output_bytes,
      browser_ms_used, error_code, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(
      createId("evt"),
      input.apiKeyId,
      input.requestId,
      target.urlHash,
      target.host,
      input.method,
      input.status,
      input.statusCode,
      input.cacheStatus,
      input.sourceContentType,
      input.inputBytes,
      input.outputBytes,
      input.browserMsUsed,
      input.errorCode,
      nowIso(input.now)
    )
    .run();
}

export async function listConversionEvents(env: Env, limit = 100): Promise<ConversionEventRow[]> {
  const boundedLimit = Math.min(Math.max(limit, 1), 500);
  const result = await env.DB.prepare(
    `SELECT id, api_key_id, request_id, url_hash, host, method, status,
      status_code, cache_status, source_content_type, input_bytes,
      output_bytes, browser_ms_used, error_code, created_at
    FROM conversion_events
    ORDER BY created_at DESC
    LIMIT ?`
  )
    .bind(boundedLimit)
    .all<ConversionEventRow>();
  return result.results;
}

export function successEventInput(
  apiKeyId: string,
  requestId: string,
  targetUrl: string,
  result: ConversionResult,
  now: Date
): ConversionEventInput {
  const cacheHit = result.cached;
  return {
    apiKeyId,
    requestId,
    targetUrl,
    method: result.method,
    status: "success",
    statusCode: 200,
    cacheStatus: cacheHit ? "HIT" : "MISS",
    sourceContentType: result.sourceContentType,
    inputBytes: cacheHit ? 0 : result.inputBytes,
    outputBytes: result.outputBytes,
    browserMsUsed: cacheHit ? 0 : result.browserMsUsed,
    errorCode: null,
    now
  };
}

export function errorEventInput(
  apiKeyId: string,
  requestId: string,
  targetUrl: string,
  statusCode: number,
  errorCode: ErrorCode,
  now: Date
): ConversionEventInput {
  return {
    apiKeyId,
    requestId,
    targetUrl,
    method: null,
    status: "error",
    statusCode,
    cacheStatus: "MISS",
    sourceContentType: null,
    inputBytes: 0,
    outputBytes: 0,
    browserMsUsed: 0,
    errorCode,
    now
  };
}

async function eventTarget(rawUrl: string): Promise<{ urlHash: string; host: string }> {
  const normalized = safeNormalizeUrl(rawUrl);
  const hashInput = normalized ?? rawUrl;
  return {
    urlHash: await sha256Hex(hashInput),
    host: eventHost(normalized ?? rawUrl)
  };
}

function safeNormalizeUrl(rawUrl: string): string | null {
  try {
    return validateAndNormalizeUrl(rawUrl);
  } catch {
    return null;
  }
}

function eventHost(rawUrl: string): string {
  try {
    return new URL(rawUrl).hostname || "invalid";
  } catch {
    return "invalid";
  }
}
