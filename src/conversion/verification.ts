import type { ContentCheckConfig } from "../config";
import { ConvertingError } from "../http/errors";
import { TypeSafeError } from "../typesafe/system-one";
import { checkPageContent, type PageOutcome } from "./content-check";
import type { ConversionResult } from "./result";

// What to do with a fresh conversion. Policy lives here; Jev only reports what
// the page is.
export type Verdict =
  | { kind: "accept"; result: ConversionResult; cacheable: boolean }
  | { kind: "retry"; reason: string; result: ConversionResult }
  | { kind: "reject"; error: ConvertingError };

// An error page or login wall ends the request, so it needs a clear answer
// before real content would be withheld; anything less is served uncached.
const rejectThreshold = 0.7;

export async function verifyConversion(result: ConversionResult, config: ContentCheckConfig): Promise<Verdict> {
  const byStatus = verdictForStatus(result);
  if (byStatus) return byStatus;

  let outcome: PageOutcome;
  let probability: number;
  try {
    ({ outcome, probability } = await checkPageContent(config, result));
  } catch (error) {
    if (!(error instanceof TypeSafeError)) throw error;
    console.warn(JSON.stringify({ event: "content_check_unavailable", requestId: result.requestId, error: error.message }));
    return accept(withWarnings(result, ["content_check_unavailable"]), false);
  }

  const checked = withWarnings(result, outcome === "real_content" ? [] : [`content_check:${outcome}`]);
  switch (outcome) {
    case "real_content":
      return accept(checked, true);
    case "access_block":
    case "javascript_shell":
    case "consent_wall":
      return { kind: "retry", reason: outcome, result: checked };
    case "not_found":
      return probability >= rejectThreshold ? reject(notFound()) : accept(withWarnings(checked, ["content_check_uncertain"]), false);
    case "login_wall":
      return probability >= rejectThreshold ? reject(loginRequired()) : accept(withWarnings(checked, ["content_check_uncertain"]), false);
  }
}

// Unambiguous HTTP answers need no model. Anything else outside 2xx usually
// means the source refused this client (WAF, rate limit, geo block), which a
// different fetcher may get past.
export function verdictForStatus(result: ConversionResult): Verdict | null {
  const status = result.sourceStatus;
  if (status === null || (status >= 200 && status < 300)) return null;
  if (status === 404 || status === 410) return reject(notFound());
  if (status === 401) return reject(loginRequired());
  return { kind: "retry", reason: `source_status_${status}`, result: withWarnings(result, [`source_status_${status}`]) };
}

export function blockedError(reason: string): ConvertingError {
  return new ConvertingError("source_blocked", `The source did not return its content (${reason}).`, 502);
}

function notFound(): ConvertingError {
  return new ConvertingError("source_not_found", "The source page was not found.", 404);
}

function loginRequired(): ConvertingError {
  return new ConvertingError("source_login_required", "The source page requires a sign-in or subscription.", 403);
}

function accept(result: ConversionResult, cacheable: boolean): Verdict {
  return { kind: "accept", result, cacheable };
}

function reject(error: ConvertingError): Verdict {
  return { kind: "reject", error };
}

function withWarnings(result: ConversionResult, warnings: string[]): ConversionResult {
  return { ...result, warnings: [...new Set([...result.warnings, ...warnings])] };
}
