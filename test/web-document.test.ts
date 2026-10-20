import { describe, expect, it } from "vitest";
import { downloadFileName, standaloneDocument } from "../web/src/html-document";
import { externalLinkTarget } from "../web/src/links";
import { renderMarkdown } from "../web/src/markdown";

describe("frontpage Markdown rendering", () => {
  it("renders GitHub-flavoured Markdown and takes the title from the first heading", () => {
    const rendered = renderMarkdown(
      "Intro\n\n## Release *notes* & `v2`\n\n| A | B |\n| - | :-: |\n| 1 | 2 |\n\n- [x] Done"
    );

    expect(rendered.title).toBe("Release notes & v2");
    expect(rendered.html).toContain("<table>");
    expect(rendered.html).toContain('<th align="center">B</th>');
    expect(rendered.html).toContain('<input checked="" disabled="" type="checkbox">');
  });

  it("has no title without a heading", () => {
    expect(renderMarkdown("Just text").title).toBeNull();
  });

  it("wraps the body in a standalone document with an escaped title", () => {
    const html = standaloneDocument("<p>Hi</p>\n", 'Tom & "Jerry" <3', "body { color: red; }");

    expect(html).toMatch(/^<!doctype html>\n<html>/);
    expect(html).toContain("<title>Tom &amp; &quot;Jerry&quot; &lt;3</title>");
    expect(html).toContain("<style>\nbody { color: red; }\n</style>");
    expect(html).toContain("<body>\n<p>Hi</p>\n</body>");
  });

  it.each([
    ["Release notes", "release-notes.html"],
    ["Ærøskøbing café: 2026 plan!", "ærøskøbing-café-2026-plan.html"],
    ["!!!", "document.html"],
    [null, "document.html"],
    ["a".repeat(80), `${"a".repeat(60)}.html`]
  ])("names the download for %j", (title, fileName) => {
    expect(downloadFileName(title)).toBe(fileName);
  });

  it("opens only ordinary links from the preview", () => {
    expect(externalLinkTarget("https://example.com/a")).toBe("https://example.com/a");
    expect(externalLinkTarget("mailto:hi@example.com")).toBe("mailto:hi@example.com");
    expect(externalLinkTarget("javascript:alert(1)")).toBeNull();
    expect(externalLinkTarget("docs/readme.md")).toBeNull();
  });
});
