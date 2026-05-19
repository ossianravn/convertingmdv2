import type { Env } from "../src/types/env";

export function makeEnv(overrides: Partial<Env> = {}): Env {
  return {
    AI: {
      async toMarkdown() {
        return { markdown: "# Mock" };
      }
    },
    DB: createD1Stub(),
    CACHE_KV: createKvStub(),
    ENVIRONMENT: "development",
    REQUIRE_AUTH: "true",
    ALLOW_ANON: "false",
    DISABLE_BROWSER: "false",
    DISABLE_IMAGE_CONVERSION: "true",
    DEFAULT_CACHE_TTL_SECONDS: "86400",
    MAX_SOURCE_BYTES: "2097152",
    MAX_OUTPUT_BYTES: "2097152",
    MAX_BROWSER_MS_PER_REQUEST: "10000",
    GLOBAL_DAILY_BROWSER_MS_LIMIT: "600000",
    GLOBAL_MONTHLY_BROWSER_MS_LIMIT: "36000000",
    GLOBAL_DAILY_IMAGE_LIMIT: "50",
    GLOBAL_MONTHLY_IMAGE_LIMIT: "500",
    ...overrides
  };
}

function createD1Stub(): D1Database {
  return {
    prepare() {
      throw new Error("D1 stub was called unexpectedly.");
    }
  } as unknown as D1Database;
}

function createKvStub(): KVNamespace {
  return {
    async get() {
      return null;
    },
    async put() {
      return undefined;
    }
  } as unknown as KVNamespace;
}

