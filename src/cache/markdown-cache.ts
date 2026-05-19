import type { ConversionResult } from "../conversion/result";
import type { Env } from "../types/env";

export async function readMarkdownCache(env: Env, key: string): Promise<ConversionResult | null> {
  return env.CACHE_KV.get<ConversionResult>(key, "json");
}

export async function writeMarkdownCache(env: Env, key: string, result: ConversionResult, ttlSeconds: number): Promise<void> {
  await env.CACHE_KV.put(key, JSON.stringify(result), { expirationTtl: ttlSeconds });
}

