import { describe, expect, it } from "vitest";
import { parseConfig } from "../src/config";
import { makeEnv } from "./helpers";

describe("config parsing", () => {
  it("parses typed defaults in development", () => {
    const config = parseConfig(makeEnv({ ENVIRONMENT: "development" }));

    expect(config.requireAuth).toBe(true);
    expect(config.disableImageConversion).toBe(true);
    expect(config.defaultCacheTtlSeconds).toBe(86400);
  });

  it("fails clearly on bad numeric config", () => {
    expect(() => parseConfig(makeEnv({ MAX_SOURCE_BYTES: "nope" }))).toThrow("MAX_SOURCE_BYTES");
  });

  it("requires secrets in production", () => {
    expect(() => parseConfig(makeEnv({ ENVIRONMENT: "production" }))).toThrow("Missing required production secrets");
  });

  it("requires the Browser binding in production", () => {
    const env = makeEnv({ ENVIRONMENT: "production", ADMIN_TOKEN: "admin", API_KEY_PEPPER: "pepper" });
    delete env.BROWSER;

    expect(() => parseConfig(env)).toThrow("BROWSER");
  });
});
