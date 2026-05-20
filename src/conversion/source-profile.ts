import { isHtmlContentType } from "../security/content-type";
import { decodeTextBody } from "../utils/text-decoding";

export type SourceWarning =
  | "source_js_app_shell"
  | "source_low_visible_text"
  | "source_script_heavy"
  | "source_cookie_shell";

export function htmlSourceWarnings(body: ArrayBuffer, contentType: string | null): SourceWarning[] {
  if (!isHtmlContentType(contentType)) return [];

  const html = decodeTextBody(body, contentType);
  const bodyHtml = extractBody(html);
  const visibleText = htmlToVisibleText(bodyHtml);
  const visibleChars = countLettersAndNumbers(visibleText);
  const scriptBytes = totalScriptBytes(html);
  const warnings = new Set<SourceWarning>();

  if (isLikelyAppShell(bodyHtml, html, visibleChars)) warnings.add("source_js_app_shell");
  if (html.length > 10000 && visibleChars < 900) warnings.add("source_low_visible_text");
  if (scriptBytes > Math.max(4000, visibleText.length * 2)) warnings.add("source_script_heavy");
  if (hasCookieShell(bodyHtml) && visibleChars < 1400) warnings.add("source_cookie_shell");

  return [...warnings];
}

function extractBody(html: string): string {
  return /<body\b[^>]*>([\s\S]*?)<\/body>/i.exec(html)?.[1] ?? html;
}

function htmlToVisibleText(html: string): string {
  return html
    .replace(/<script\b[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[\s\S]*?<\/style>/gi, " ")
    .replace(/<svg\b[\s\S]*?<\/svg>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&[a-z]+;|&#\d+;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function totalScriptBytes(html: string): number {
  return [...html.matchAll(/<script\b[\s\S]*?<\/script>/gi)].reduce((total, match) => total + match[0].length, 0);
}

function isLikelyAppShell(bodyHtml: string, html: string, visibleChars: number): boolean {
  if (visibleChars >= 1800) return false;

  return hasEmptyAppRoot(bodyHtml) && (hasFrameworkScript(html) || hasDeferredAppScript(html));
}

function hasEmptyAppRoot(bodyHtml: string): boolean {
  return /<[^>]+\bid=["'](?:root|app|__next|__nuxt|svelte|q-app)["'][^>]*>\s*<\/[^>]+>/i.test(bodyHtml);
}

function hasFrameworkScript(html: string): boolean {
  return /\b(?:react|react-dom|next\/static|nuxt|svelte|angular|vite|webpack)\b/i.test(html);
}

function hasDeferredAppScript(html: string): boolean {
  return /<script\b[^>]+\b(?:defer|type=["']module["'])[^>]+\bsrc=["'][^"']*(?:app|main|index|sections|bundle|chunk)[^"']*\.js/i.test(html);
}

function hasCookieShell(bodyHtml: string): boolean {
  return /\b(?:cookie|consent|privacy|gdpr|accept|decline)\b/i.test(bodyHtml);
}

function countLettersAndNumbers(value: string): number {
  return value.match(/[\p{L}\p{N}]/gu)?.length ?? 0;
}
