import { describe, expect, it } from "vitest";
import { htmlSourceWarnings } from "../src/conversion/source-profile";

describe("HTML source profile", () => {
  it("detects JavaScript app shells with little server-rendered text", () => {
    const html = encode(`
      <html>
        <body>
          <div id="root"></div>
          <div id="cookie-banner">We use cookies. Accept Decline Privacy.</div>
          <script defer src="/sections.js"></script>
          <script defer src="/app.js"></script>
        </body>
      </html>
    `);

    expect(htmlSourceWarnings(html, "text/html; charset=utf-8")).toEqual(
      expect.arrayContaining(["source_js_app_shell", "source_cookie_shell"])
    );
  });

  it("does not mark server-rendered pages as app shells", () => {
    const html = encode(`
      <html>
        <body>
          <div id="root">
            <main>
              <h1>Build a real business with AI</h1>
              <p>${"Detailed competition content and product information. ".repeat(80)}</p>
            </main>
          </div>
          <script defer src="/app.js"></script>
        </body>
      </html>
    `);

    expect(htmlSourceWarnings(html, "text/html")).not.toContain("source_js_app_shell");
  });
});

function encode(value: string): ArrayBuffer {
  const bytes = new TextEncoder().encode(value);
  const copy = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(copy).set(bytes);
  return copy;
}
