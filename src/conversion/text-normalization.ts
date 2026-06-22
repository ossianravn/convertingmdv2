import { decodeHTML } from "entities";
import { ConvertingError } from "../http/errors";
import { byteLength } from "../utils/bytes";
import { absolutizeMarkdownReferences } from "./markdown-references";
import type { ConversionResult } from "./result";

export function normalizeConversionResult(result: ConversionResult, maxOutputBytes: number): ConversionResult {
  const markdown = absolutizeMarkdownReferences(normalizeMarkdownText(result.markdown), result.url);
  const outputBytes = byteLength(markdown);
  if (outputBytes > maxOutputBytes) {
    throw new ConvertingError("output_too_large", "Markdown output exceeded the byte limit.", 413);
  }

  return { ...result, markdown, outputBytes };
}

export function normalizeMarkdownText(markdown: string): string {
  let fence: string | null = null;
  const prepared = stripBrowserStartupShell(normalizeLineEndings(stripBom(markdown)));
  const normalizedLines = prepared.split("\n").map((line) => {
    const marker = fenceMarker(line);
    if (fence) {
      if (marker?.startsWith(fence)) fence = null;
      return line;
    }

    if (marker) {
      fence = marker;
      return line;
    }

    return decodeOutsideInlineCode(line);
  });

  return normalizedLines.join("\n").normalize("NFC");
}

function stripBrowserStartupShell(markdown: string): string {
  const lines = markdown.split("\n");
  const shellStart = firstNonBlankLine(lines, bodyStartIndex(lines));
  if (shellStart === -1 || !isLoadingShellLine(lines[shellStart])) return markdown;

  const shellEnd = auraShellEndIndex(lines, shellStart);
  if (shellEnd === -1) return markdown;

  return [...lines.slice(0, shellStart), ...dropLeadingBlankLines(lines.slice(shellEnd + 1))].join("\n");
}

function bodyStartIndex(lines: string[]): number {
  if (lines[0]?.trim() !== "---") return 0;
  const end = lines.findIndex((line, index) => index > 0 && line.trim() === "---");
  return end === -1 ? 0 : end + 1;
}

function firstNonBlankLine(lines: string[], start: number): number {
  for (let index = start; index < lines.length; index += 1) {
    if (lines[index]?.trim()) return index;
  }
  return -1;
}

function dropLeadingBlankLines(lines: string[]): string[] {
  const first = firstNonBlankLine(lines, 0);
  return first === -1 ? [] : lines.slice(first);
}

function isLoadingShellLine(line = ""): boolean {
  return /^(loading|indlæser)$/i.test(line.trim());
}

function auraShellEndIndex(lines: string[], start: number): number {
  const windowEnd = Math.min(lines.length, start + 16);
  let sawInterrupt = false;
  let sawCssError = false;

  for (let index = start + 1; index < windowEnd; index += 1) {
    const line = shellText(lines[index]);
    if (line.includes("sorry to interrupt")) sawInterrupt = true;
    if (sawInterrupt && line.includes("css error")) sawCssError = true;
    if (sawCssError && line.includes("refresh")) return index;
  }

  return -1;
}

function shellText(line = ""): string {
  return line.toLowerCase().replace(/\s+/g, " ").trim();
}

function decodeOutsideInlineCode(line: string): string {
  let output = "";
  let index = 0;

  while (index < line.length) {
    const tickStart = line.indexOf("`", index);
    if (tickStart === -1) {
      output += decodeEntities(line.slice(index));
      break;
    }

    output += decodeEntities(line.slice(index, tickStart));
    const tickLength = countBackticks(line, tickStart);
    const tickRun = "`".repeat(tickLength);
    const tickEnd = line.indexOf(tickRun, tickStart + tickLength);
    if (tickEnd === -1) {
      output += line.slice(tickStart);
      break;
    }

    output += line.slice(tickStart, tickEnd + tickLength);
    index = tickEnd + tickLength;
  }

  return output;
}

function decodeEntities(value: string): string {
  return decodeHTML(value)
    .replace(/[\r\n\t]+/g, " ")
    .replace(/\u00A0/g, " ")
    .replace(/\u00AD/g, "")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]+/g, " ");
}

function fenceMarker(line: string): string | null {
  const match = /^\s*(`{3,}|~{3,})/.exec(line);
  return match?.[1] ?? null;
}

function countBackticks(line: string, start: number): number {
  let index = start;
  while (line[index] === "`") index += 1;
  return index - start;
}

function stripBom(value: string): string {
  return value.startsWith("\uFEFF") ? value.slice(1) : value;
}

function normalizeLineEndings(value: string): string {
  return value.replace(/\r\n?/g, "\n");
}
