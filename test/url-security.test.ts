import { describe, expect, it } from "vitest";
import { validateAndNormalizeUrl } from "../src/security/url";

describe("url security", () => {
  it("normalizes scheme, host, default port, and fragment", () => {
    expect(validateAndNormalizeUrl("HTTPS://Example.COM:443/a?b=1#frag")).toBe("https://example.com/a?b=1");
    expect(validateAndNormalizeUrl("http://Example.COM:80/")).toBe("http://example.com/");
  });

  it("rejects unsupported schemes", () => {
    expect(() => validateAndNormalizeUrl("file:///etc/passwd")).toThrow("Only http and https URLs");
  });

  it("rejects blocked local and private hosts", () => {
    expect(() => validateAndNormalizeUrl("http://localhost")).toThrow("blocked host");
    expect(() => validateAndNormalizeUrl("http://127.0.0.1")).toThrow("blocked host");
    expect(() => validateAndNormalizeUrl("http://10.0.0.1")).toThrow("blocked host");
    expect(() => validateAndNormalizeUrl("http://192.168.0.1")).toThrow("blocked host");
  });

  it("rejects credentials", () => {
    expect(() => validateAndNormalizeUrl("http://user:pass@example.com")).toThrow("credentials");
  });

  it("rejects ports outside the allowed range", () => {
    expect(() => validateAndNormalizeUrl("http://example.com:0/")).toThrow("port");
    expect(() => validateAndNormalizeUrl("http://example.com:65536/")).toThrow();
  });
});
