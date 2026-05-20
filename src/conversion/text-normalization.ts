import { decodeHTML } from "entities";
import { ConvertingError } from "../http/errors";
import { byteLength } from "../utils/bytes";
import type { ConversionResult } from "./result";

export function normalizeConversionResult(result: ConversionResult, maxOutputBytes: number): ConversionResult {
  const markdown = normalizeMarkdownText(result.markdown);
  const outputBytes = byteLength(markdown);
  if (outputBytes > maxOutputBytes) {
    throw new ConvertingError("output_too_large", "Markdown output exceeded the byte limit.", 413);
  }

  return { ...result, markdown, outputBytes };
}

export function normalizeMarkdownText(markdown: string): string {
  let fence: string | null = null;
  const normalizedLines = normalizeLineEndings(stripBom(markdown)).split("\n").map((line) => {
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
