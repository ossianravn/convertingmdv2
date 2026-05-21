import type { Context, Hono } from "hono";
import { parseConfig } from "../config";
import { withSourceUrlFrontmatter } from "../conversion/frontmatter";
import { convertMarkdown } from "../conversion/orchestrator";
import { conversionResponse } from "../http/responses";
import { requireApiKey } from "../middleware/auth";
import type { MarkdownRequest } from "../types/api";
import type { AppEnv } from "../types/env";
import { errorEventInput, logConversionEvent, successEventInput } from "../usage/events";
import { enforceRequestQuota } from "../usage/quota";
import { parsePostMarkdownRequest, parseQueryMarkdownRequest } from "../validation/markdown-request";
import { toConvertingError } from "../http/errors";
import { incrementConversionCounters } from "../usage/conversions";

export function registerMarkdownRoutes(app: Hono<AppEnv>): void {
  app.post("/v1/markdown", requireApiKey, async (c) => {
    const config = parseConfig(c.env);
    const request = await parsePostMarkdownRequest(c.req.raw, config.defaultCacheTtlSeconds);
    return handleMarkdownRequest(c, request, config);
  });

  app.get("/v1/markdown", requireApiKey, async (c) => {
    const config = parseConfig(c.env);
    const request = parseQueryMarkdownRequest(new URL(c.req.url), config.defaultCacheTtlSeconds);
    return handleMarkdownRequest(c, request, config);
  });
}

export async function handleMarkdownRequest(
  c: Context<AppEnv>,
  request: MarkdownRequest,
  config: ReturnType<typeof parseConfig>
): Promise<Response> {
  const requestId = c.get("requestId");
  const now = new Date();
  const apiKey = c.get("apiKey");

  try {
    const rateLimit = await enforceRequestQuota(c.env, apiKey, now);

    const rawResult = await convertMarkdown(request, {
      env: c.env,
      apiKey,
      config,
      requestId,
      now
    });
    const result = withSourceUrlFrontmatter(rawResult, config.maxOutputBytes);

    await incrementConversionCounters(c.env, apiKey.id, result, now);
    await logConversionEvent(c.env, successEventInput(apiKey.id, requestId, request.url, result, now));
    return conversionResponse(result, request.format, requestId, rateLimit);
  } catch (error) {
    const convertingError = toConvertingError(error);
    await logConversionEvent(
      c.env,
      errorEventInput(apiKey.id, requestId, request.url, convertingError.status, convertingError.code, now)
    );
    throw convertingError;
  }
}
