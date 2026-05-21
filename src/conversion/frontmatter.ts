import { ConvertingError } from "../http/errors";
import { byteLength } from "../utils/bytes";
import type { ConversionResult } from "./result";

export function withSourceUrlFrontmatter(result: ConversionResult, maxOutputBytes: number): ConversionResult {
  const markdown = ensureSourceUrlFrontmatter(result.markdown, result.url);
  const outputBytes = byteLength(markdown);
  if (outputBytes > maxOutputBytes) {
    throw new ConvertingError("output_too_large", "Markdown output exceeded the byte limit.", 413);
  }

  return { ...result, markdown, outputBytes };
}

export function ensureSourceUrlFrontmatter(markdown: string, url: string): string {
  const lines = markdown.replace(/\r\n?/g, "\n").split("\n");
  if (lines[0]?.trim() !== "---") return createFrontmatter(url, markdown);

  const closingIndex = lines.findIndex((line, index) => index > 0 && line.trim() === "---");
  if (closingIndex === -1) return createFrontmatter(url, markdown);

  const metadata = lines.slice(1, closingIndex).filter((line) => !isUrlField(line));
  return ["---", `url: ${url}`, ...metadata, ...lines.slice(closingIndex)].join("\n");
}

function createFrontmatter(url: string, markdown: string): string {
  return markdown ? `---\nurl: ${url}\n---\n\n${markdown}` : `---\nurl: ${url}\n---\n`;
}

function isUrlField(line: string): boolean {
  return /^url\s*:/i.test(line.trim());
}
