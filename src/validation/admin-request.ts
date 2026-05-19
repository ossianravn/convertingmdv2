import { ConvertingError } from "../http/errors";
import type { ApiKeyCreateInput, ApiKeyPatchInput, ApiKeyStatus } from "../types/api";
import { isRecord, parseJsonObject } from "../utils/json";

const statuses = new Set<ApiKeyStatus>(["active", "revoked", "inactive"]);

const defaults: ApiKeyCreateInput = {
  name: "API key",
  status: "active",
  dailyRequestLimit: 1000,
  monthlyRequestLimit: 25000,
  allowBrowser: false,
  autoBrowserFallback: false,
  dailyBrowserMsLimit: 0,
  monthlyBrowserMsLimit: 0,
  allowImages: false,
  dailyImageLimit: 0,
  monthlyImageLimit: 0
};

export async function parseCreateApiKeyRequest(request: Request): Promise<ApiKeyCreateInput> {
  const body = parseJsonObject(await readJson(request));
  return {
    name: readString(body, "name", defaults.name),
    status: readStatus(body["status"], defaults.status),
    dailyRequestLimit: readLimit(body, "dailyRequestLimit", defaults.dailyRequestLimit),
    monthlyRequestLimit: readLimit(body, "monthlyRequestLimit", defaults.monthlyRequestLimit),
    allowBrowser: readBoolean(body, "allowBrowser", defaults.allowBrowser),
    autoBrowserFallback: readBoolean(body, "autoBrowserFallback", defaults.autoBrowserFallback),
    dailyBrowserMsLimit: readLimit(body, "dailyBrowserMsLimit", defaults.dailyBrowserMsLimit),
    monthlyBrowserMsLimit: readLimit(body, "monthlyBrowserMsLimit", defaults.monthlyBrowserMsLimit),
    allowImages: readBoolean(body, "allowImages", defaults.allowImages),
    dailyImageLimit: readLimit(body, "dailyImageLimit", defaults.dailyImageLimit),
    monthlyImageLimit: readLimit(body, "monthlyImageLimit", defaults.monthlyImageLimit)
  };
}

export async function parsePatchApiKeyRequest(request: Request): Promise<ApiKeyPatchInput> {
  const body = parseJsonObject(await readJson(request));
  const patch: ApiKeyPatchInput = {};
  assignString(patch, body, "name");
  assignStatus(patch, body);
  assignLimit(patch, body, "dailyRequestLimit");
  assignLimit(patch, body, "monthlyRequestLimit");
  assignBoolean(patch, body, "allowBrowser");
  assignBoolean(patch, body, "autoBrowserFallback");
  assignLimit(patch, body, "dailyBrowserMsLimit");
  assignLimit(patch, body, "monthlyBrowserMsLimit");
  assignBoolean(patch, body, "allowImages");
  assignLimit(patch, body, "dailyImageLimit");
  assignLimit(patch, body, "monthlyImageLimit");
  return patch;
}

async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    throw new ConvertingError("invalid_request", "Request body must be valid JSON.", 400);
  }
}

function readString(body: Record<string, unknown>, key: string, fallback: string): string {
  const value = body[key];
  if (value === undefined) return fallback;
  if (typeof value === "string" && value.length > 0) return value;
  throw new ConvertingError("invalid_request", `${key} must be a non-empty string.`, 400);
}

function readStatus(value: unknown, fallback: ApiKeyStatus): ApiKeyStatus {
  if (value === undefined) return fallback;
  if (typeof value === "string" && statuses.has(value as ApiKeyStatus)) return value as ApiKeyStatus;
  throw new ConvertingError("invalid_request", "status is not supported.", 400);
}

function readLimit(body: Record<string, unknown>, key: string, fallback: number): number {
  const value = body[key];
  if (value === undefined) return fallback;
  if (typeof value === "number" && Number.isSafeInteger(value) && value >= 0) return value;
  throw new ConvertingError("invalid_request", `${key} must be a non-negative integer.`, 400);
}

function readBoolean(body: Record<string, unknown>, key: string, fallback: boolean): boolean {
  const value = body[key];
  if (value === undefined) return fallback;
  if (typeof value === "boolean") return value;
  throw new ConvertingError("invalid_request", `${key} must be a boolean.`, 400);
}

function assignString(patch: ApiKeyPatchInput, body: Record<string, unknown>, key: "name"): void {
  if (body[key] === undefined) return;
  patch[key] = readString(body, key, defaults[key]);
}

function assignStatus(patch: ApiKeyPatchInput, body: Record<string, unknown>): void {
  if (body["status"] === undefined) return;
  patch.status = readStatus(body["status"], defaults.status);
}

function assignLimit(patch: ApiKeyPatchInput, body: Record<string, unknown>, key: keyof ApiKeyPatchInput): void {
  if (body[key] === undefined) return;
  patch[key] = readLimit(body, key, 0) as never;
}

function assignBoolean(patch: ApiKeyPatchInput, body: Record<string, unknown>, key: keyof ApiKeyPatchInput): void {
  if (body[key] === undefined) return;
  patch[key] = readBoolean(body, key, false) as never;
}

export function assertAdminBody(value: unknown): Record<string, unknown> {
  if (!isRecord(value)) {
    throw new ConvertingError("invalid_request", "Admin request body must be an object.", 400);
  }

  return value;
}
