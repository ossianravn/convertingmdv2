import type { ApiKey, ApiKeyCreateInput, ApiKeyPatchInput, ApiKeyStatus } from "../types/api";
import type { Env } from "../types/env";
import { ConvertingError } from "../http/errors";
import { createApiKeySecret, createId } from "../utils/crypto";
import { nowIso } from "../utils/dates";
import { hashApiKey } from "./hash";

interface ApiKeyRow {
  id: string;
  name: string;
  prefix: string;
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

export interface CreatedApiKey {
  id: string;
  name: string;
  prefix: string;
  apiKey: string;
  createdAt: string;
}

export function readApiKeyFromRequest(request: Request): string | null {
  const authorization = request.headers.get("Authorization");
  if (authorization?.startsWith("Bearer ")) {
    return authorization.slice("Bearer ".length).trim();
  }

  return request.headers.get("X-API-Key");
}

export async function getApiKeyByRawKey(env: Env, rawApiKey: string): Promise<ApiKey | null> {
  const keyHash = await hashApiKey(rawApiKey, requiredPepper(env));
  const row = await env.DB.prepare(selectApiKeySql("WHERE key_hash = ?")).bind(keyHash).first<ApiKeyRow>();
  return row ? mapApiKey(row) : null;
}

export async function touchApiKeyLastUsed(env: Env, apiKeyId: string, now: Date): Promise<void> {
  await env.DB.prepare("UPDATE api_keys SET last_used_at = ?, updated_at = ? WHERE id = ?")
    .bind(nowIso(now), nowIso(now), apiKeyId)
    .run();
}

export async function createApiKey(env: Env, input: ApiKeyCreateInput, now: Date): Promise<CreatedApiKey> {
  const id = createId("key");
  const apiKey = `cmd_live_${createApiKeySecret()}`;
  const createdAt = nowIso(now);
  const prefix = apiKey.slice(0, 17);
  const keyHash = await hashApiKey(apiKey, requiredPepper(env));

  await env.DB.prepare(
    `INSERT INTO api_keys (
      id, name, prefix, key_hash, status,
      daily_request_limit, monthly_request_limit,
      allow_browser, auto_browser_fallback,
      daily_browser_ms_limit, monthly_browser_ms_limit,
      allow_images, daily_image_limit, monthly_image_limit,
      created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(
      id,
      input.name,
      prefix,
      keyHash,
      input.status,
      input.dailyRequestLimit,
      input.monthlyRequestLimit,
      boolToInt(input.allowBrowser),
      boolToInt(input.autoBrowserFallback),
      input.dailyBrowserMsLimit,
      input.monthlyBrowserMsLimit,
      boolToInt(input.allowImages),
      input.dailyImageLimit,
      input.monthlyImageLimit,
      createdAt,
      createdAt
    )
    .run();

  return { id, name: input.name, prefix, apiKey, createdAt };
}

export async function listApiKeys(env: Env): Promise<ApiKey[]> {
  const result = await env.DB.prepare(`${selectApiKeySql("")} ORDER BY created_at DESC`).all<ApiKeyRow>();
  return result.results.map(mapApiKey);
}

export async function patchApiKey(env: Env, id: string, patch: ApiKeyPatchInput, now: Date): Promise<ApiKey> {
  const updates = apiKeyPatchUpdates(patch);
  if (updates.length > 0) {
    const assignments = updates.map(([column]) => `${column} = ?`).join(", ");
    const values = updates.map(([, value]) => value);
    await env.DB.prepare(`UPDATE api_keys SET ${assignments}, updated_at = ? WHERE id = ?`)
      .bind(...values, nowIso(now), id)
      .run();
  }

  const row = await env.DB.prepare(selectApiKeySql("WHERE id = ?")).bind(id).first<ApiKeyRow>();
  if (!row) throw new ConvertingError("not_found", "API key not found.", 404);
  return mapApiKey(row);
}

function apiKeyPatchUpdates(patch: ApiKeyPatchInput): Array<[string, string | number]> {
  const updates: Array<[string, string | number]> = [];
  if (patch.name !== undefined) updates.push(["name", patch.name]);
  if (patch.status !== undefined) updates.push(["status", patch.status]);
  if (patch.dailyRequestLimit !== undefined) updates.push(["daily_request_limit", patch.dailyRequestLimit]);
  if (patch.monthlyRequestLimit !== undefined) updates.push(["monthly_request_limit", patch.monthlyRequestLimit]);
  if (patch.allowBrowser !== undefined) updates.push(["allow_browser", boolToInt(patch.allowBrowser)]);
  if (patch.autoBrowserFallback !== undefined) updates.push(["auto_browser_fallback", boolToInt(patch.autoBrowserFallback)]);
  if (patch.dailyBrowserMsLimit !== undefined) updates.push(["daily_browser_ms_limit", patch.dailyBrowserMsLimit]);
  if (patch.monthlyBrowserMsLimit !== undefined) updates.push(["monthly_browser_ms_limit", patch.monthlyBrowserMsLimit]);
  if (patch.allowImages !== undefined) updates.push(["allow_images", boolToInt(patch.allowImages)]);
  if (patch.dailyImageLimit !== undefined) updates.push(["daily_image_limit", patch.dailyImageLimit]);
  if (patch.monthlyImageLimit !== undefined) updates.push(["monthly_image_limit", patch.monthlyImageLimit]);
  return updates;
}

function selectApiKeySql(whereClause: string): string {
  return `SELECT
    id, name, prefix, status,
    daily_request_limit, monthly_request_limit,
    allow_browser, auto_browser_fallback,
    daily_browser_ms_limit, monthly_browser_ms_limit,
    allow_images, daily_image_limit, monthly_image_limit,
    created_at, updated_at, last_used_at
  FROM api_keys ${whereClause}`;
}

function mapApiKey(row: ApiKeyRow): ApiKey {
  return {
    id: row.id,
    name: row.name,
    prefix: row.prefix,
    status: row.status as ApiKeyStatus,
    dailyRequestLimit: row.daily_request_limit,
    monthlyRequestLimit: row.monthly_request_limit,
    allowBrowser: row.allow_browser === 1,
    autoBrowserFallback: row.auto_browser_fallback === 1,
    dailyBrowserMsLimit: row.daily_browser_ms_limit,
    monthlyBrowserMsLimit: row.monthly_browser_ms_limit,
    allowImages: row.allow_images === 1,
    dailyImageLimit: row.daily_image_limit,
    monthlyImageLimit: row.monthly_image_limit,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    lastUsedAt: row.last_used_at
  };
}

function requiredPepper(env: Env): string {
  if (!env.API_KEY_PEPPER) {
    throw new ConvertingError("conversion_failed", "API key pepper is not configured.", 500);
  }

  return env.API_KEY_PEPPER;
}

function boolToInt(value: boolean): number {
  return value ? 1 : 0;
}

