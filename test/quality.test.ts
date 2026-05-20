import { describe, expect, it } from "vitest";
import { assessConversionQuality } from "../src/conversion/quality";
import type { ConversionResult } from "../src/conversion/result";

describe("conversion quality", () => {
  it("flags frontmatter plus cookie banner output as weak and browser-worthy", () => {
    const assessment = assessConversionQuality(
      result({
        markdown: `---
description: Build a real AI business in 90 days.
title: Build with Gemini XPRIZE
---

We use cookies to improve your experience and analyze site traffic.

Decline Accept`,
        inputBytes: 30542,
        warnings: ["source_js_app_shell", "source_cookie_shell"]
      })
    );

    expect(assessment.goodEnough).toBe(false);
    expect(assessment.browserRecommended).toBe(true);
    expect(assessment.reasons).toEqual(expect.arrayContaining(["output_frontmatter_dominant"]));
  });

  it("keeps short multilingual pages acceptable when the source is also small", () => {
    const assessment = assessConversionQuality(
      result({
        markdown: "## こんにちは\n\nこれは小さな案内ページです。開始日、参加方法、連絡先を簡潔に説明しています。",
        inputBytes: 1800
      })
    );

    expect(assessment.goodEnough).toBe(true);
    expect(assessment.browserRecommended).toBe(false);
  });

  it("flags JavaScript-required messages across common languages", () => {
    const assessment = assessConversionQuality(
      result({
        markdown: "Bitte JavaScript aktivieren, um diese Seite zu verwenden.",
        inputBytes: 12000,
        warnings: ["source_js_app_shell"]
      })
    );

    expect(assessment.goodEnough).toBe(false);
    expect(assessment.reasons).toEqual(expect.arrayContaining(["output_javascript_required"]));
  });
});

function result(overrides: Partial<ConversionResult>): ConversionResult {
  return {
    markdown: "# Good",
    method: "ai",
    url: "https://example.com",
    cached: false,
    tokens: null,
    browserMsUsed: 0,
    outputBytes: 6,
    inputBytes: 1000,
    sourceContentType: "text/html; charset=utf-8",
    warnings: [],
    requestId: "req_quality",
    ...overrides
  };
}
