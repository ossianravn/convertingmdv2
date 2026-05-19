import { describe, expect, it } from "vitest";
import { findPrdDocIssues } from "../scripts/check-prd-docs";

describe("PRD docs check", () => {
  it("accepts manifest metadata that matches split Markdown docs", () => {
    const lineCounts = new Map([
      ["00-index.md", 3],
      ["01-overview.md", 2]
    ]);

    expect(
      findPrdDocIssues({
        manifest: {
          file_count: 2,
          max_markdown_lines_target: 3,
          files: ["00-index.md", "01-overview.md"],
          line_counts: { "00-index.md": 3, "01-overview.md": 2 }
        },
        markdownFiles: ["00-index.md", "01-overview.md"],
        lineCounts
      })
    ).toEqual([]);
  });

  it("rejects stale manifest metadata and oversized PRD files", () => {
    const issues = findPrdDocIssues({
      manifest: {
        file_count: 1,
        max_markdown_lines_target: 3,
        files: ["00-index.md"],
        line_counts: { "00-index.md": 2, "01-overview.md": 4 }
      },
      markdownFiles: ["00-index.md", "01-overview.md"],
      lineCounts: new Map([
        ["00-index.md", 3],
        ["01-overview.md", 4]
      ])
    });

    expect(issues).toEqual([
      { path: "manifest.json.file_count", message: "file_count must match Markdown file count." },
      { path: "manifest.json.files", message: "files must match PRD Markdown files exactly." },
      { path: "manifest.json.line_counts.00-index.md", message: "Expected 3." },
      { path: "01-overview.md", message: "PRD file has 4 lines; limit is 3." }
    ]);
  });
});
