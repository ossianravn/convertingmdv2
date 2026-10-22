import { ConvertingError } from "../http/errors";
import type { MarkdownRequest } from "../types/api";
import { tryBrowserMarkdown } from "./browser";
import {
  finalizeResult,
  withWarnings,
  type Candidate,
  type ConversionContext
} from "./pipeline-support";
import { assessConversionQuality, meaningfulMarkdownChars } from "./quality";
import type { ConversionResult } from "./result";

// Renders the page in Browser Run when a cheaper conversion looks structurally
// weak. Keeps the primary result when the render is no better.
export async function tryBrowserFallback(
  request: MarkdownRequest,
  context: ConversionContext,
  primary: ConversionResult | null,
  trigger: string
): Promise<Candidate> {
  try {
    const browser = withWarnings(
      finalizeResult(
        await tryBrowserMarkdown(context.env, request, context.apiKey, context.config, context.requestId, "fallback"),
        context
      ),
      [trigger]
    );
    const assessment = assessConversionQuality(browser);
    const result = withWarnings(browser, assessment.goodEnough ? [] : ["browser_fallback_weak_output", ...assessment.reasons]);

    if (assessment.goodEnough || !primary || isMeaningfullyBetter(result, primary)) {
      return { result, cacheable: assessment.cacheable };
    }

    return { result: withWarnings(primary, [trigger, "browser_fallback_weak_output", ...assessment.reasons]), cacheable: false };
  } catch (error) {
    if (!primary) throw error;
    return { result: withWarnings(primary, [trigger, fallbackFailureWarning(error)]), cacheable: false };
  }
}

function isMeaningfullyBetter(candidate: ConversionResult, primary: ConversionResult): boolean {
  const candidateChars = meaningfulMarkdownChars(candidate.markdown);
  const primaryChars = meaningfulMarkdownChars(primary.markdown);
  return candidateChars >= 300 && candidateChars >= primaryChars * 2;
}

function fallbackFailureWarning(error: unknown): string {
  if (error instanceof ConvertingError) return `browser_fallback_failed:${error.code}`;
  return "browser_fallback_failed:unknown";
}
