import { isHtmlContentType } from "../security/content-type";
import type { ConversionResult } from "./result";

export type QualityReason =
  | "output_empty"
  | "output_too_short_for_source"
  | "output_frontmatter_dominant"
  | "output_boilerplate_only"
  | "output_javascript_required"
  | "output_conversion_error_marker";

export interface QualityAssessment {
  goodEnough: boolean;
  cacheable: boolean;
  browserRecommended: boolean;
  reasons: QualityReason[];
  meaningfulChars: number;
}

export function isGoodEnough(markdown: string, inputBytes: number): boolean {
  return assessMarkdown(markdown, inputBytes, null, []).goodEnough;
}

export function assessConversionQuality(result: ConversionResult): QualityAssessment {
  return assessMarkdown(result.markdown, result.inputBytes, result.sourceContentType, result.warnings);
}

export function meaningfulMarkdownChars(markdown: string): number {
  return countLettersAndNumbers(stripMarkdownNoise(stripFrontmatter(markdown.trim())));
}

function assessMarkdown(
  markdown: string,
  inputBytes: number,
  sourceContentType: string | null,
  warnings: string[]
): QualityAssessment {
  const trimmed = markdown.trim();
  const body = stripFrontmatter(trimmed);
  const meaningfulChars = meaningfulMarkdownChars(trimmed);
  const reasons = new Set<QualityReason>();

  if (!trimmed) reasons.add("output_empty");
  if (trimmed.includes("CONVERSION_ERROR")) reasons.add("output_conversion_error_marker");
  if (looksLikeJavascriptRequired(body)) reasons.add("output_javascript_required");
  if (isTooShortForSource(meaningfulChars, inputBytes)) reasons.add("output_too_short_for_source");
  if (warnings.includes("source_js_app_shell") && meaningfulChars < 1600) reasons.add("output_too_short_for_source");
  if (isFrontmatterDominant(trimmed, body, meaningfulChars, inputBytes)) reasons.add("output_frontmatter_dominant");
  if (isBoilerplateOnly(body, meaningfulChars, inputBytes)) reasons.add("output_boilerplate_only");

  const reasonList = [...reasons];
  const htmlSource = isHtmlContentType(sourceContentType);
  const sourceSuggestsBrowser = warnings.includes("source_js_app_shell") || warnings.includes("source_low_visible_text");

  return {
    goodEnough: reasonList.length === 0,
    cacheable: reasonList.length === 0,
    browserRecommended: htmlSource && (reasonList.length > 0 || sourceSuggestsBrowser),
    reasons: reasonList,
    meaningfulChars
  };
}

function stripFrontmatter(markdown: string): string {
  if (!markdown.startsWith("---")) return markdown;
  return markdown.replace(/^---\s*[\s\S]*?\s*---\s*/, "");
}

function stripMarkdownNoise(markdown: string): string {
  return markdown
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/!\[[^\]]*]\([^)]+\)/g, " ")
    .replace(/\[[^\]]*]\([^)]+\)/g, " ")
    .replace(/https?:\/\/\S+/g, " ")
    .replace(/[`*_>#|[\]()-]/g, " ");
}

function isTooShortForSource(meaningfulChars: number, inputBytes: number): boolean {
  if (inputBytes <= 4000) return false;
  if (meaningfulChars < 80) return true;
  return inputBytes > 10000 && meaningfulChars < 500;
}

function isFrontmatterDominant(markdown: string, body: string, meaningfulChars: number, inputBytes: number): boolean {
  if (!markdown.startsWith("---")) return false;
  if (inputBytes <= 4000) return false;
  const bodyChars = countLettersAndNumbers(stripMarkdownNoise(body));
  return bodyChars < 350 || meaningfulChars < 550;
}

function isBoilerplateOnly(body: string, meaningfulChars: number, inputBytes: number): boolean {
  if (inputBytes <= 4000 || meaningfulChars > 700) return false;
  const lower = body.toLowerCase();
  const hasBoilerplateSignal = boilerplateSignals.some((signal) => lower.includes(signal));
  const hasContentStructure = /^#{1,6}\s+\S/m.test(body) || /^\s*[-*]\s+\S/m.test(body) || /\|.+\|/.test(body);
  return hasBoilerplateSignal && !hasContentStructure;
}

function looksLikeJavascriptRequired(body: string): boolean {
  return javascriptRequiredPatterns.some((pattern) => pattern.test(body));
}

function countLettersAndNumbers(value: string): number {
  return value.match(/[\p{L}\p{N}]/gu)?.length ?? 0;
}

const boilerplateSignals = [
  "cookie",
  "consent",
  "privacy",
  "gdpr",
  "accept",
  "decline",
  "enable javascript",
  "requires javascript",
  "access denied"
];

const javascriptRequiredPatterns = [
  /enable javascript/i,
  /requires javascript/i,
  /javascript must be enabled/i,
  /habilita(?:r|do)? javascript/i,
  /activez javascript/i,
  /javascript aktivieren/i,
  /ativar javascript/i,
  /w[łl]ącz javascript/i
];
