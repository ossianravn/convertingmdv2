import { describe, expect, it } from "vitest";
import { conversionPath } from "../web/src/target-url";

describe("frontpage URL input", () => {
  it.each([
    ["https://example.com/article", "/https://example.com/article"],
    ["  example.com/a b?x=1#intro ", "/https://example.com/a%20b?x=1"],
    ["http://example.com", "/http://example.com/"],
    ["example.com:8080/docs", "/https://example.com:8080/docs"]
  ])("turns %j into the address-bar route", (input, path) => {
    expect(conversionPath(input)).toEqual({ ok: true, path });
  });

  it.each([
    ["", "Enter a web address."],
    ["ftp://example.com/file", "Use an address that starts with http:// or https://."],
    ["https://user:secret@example.com", "Remove the username and password from the address."],
    ["mailto:someone@example.com", "Remove the username and password from the address."],
    ["localhost:3000", "Enter a full address, like example.com/page."],
    ["javascript:alert(1)", "That doesn't look like a web address."]
  ])("rejects %j", (input, message) => {
    expect(conversionPath(input)).toEqual({ ok: false, message });
  });
});
