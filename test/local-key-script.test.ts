import { describe, expect, it } from "vitest";
import { hashApiKey } from "../src/auth/hash";
import { createLocalKeyPayload } from "../scripts/create-local-key";

describe("local key script helper", () => {
  it("creates cmd_test keys with a matching HMAC hash", async () => {
    const payload = await createLocalKeyPayload("pepper");

    expect(payload.id).toMatch(/^key_[A-Za-z0-9_-]+$/);
    expect(payload.apiKey).toMatch(/^cmd_test_[A-Za-z0-9_-]+$/);
    expect(payload.prefix).toBe(payload.apiKey.slice(0, 17));
    expect(payload.keyHash).toMatch(/^[a-f0-9]{64}$/);
    await expect(hashApiKey(payload.apiKey, "pepper")).resolves.toBe(payload.keyHash);
  });
});
