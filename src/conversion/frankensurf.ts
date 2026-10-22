import type { AppConfig, FrankensurfConfig } from "../config";
import { ConvertingError } from "../http/errors";
import { validateAndNormalizeUrl } from "../security/url";
import type { Env } from "../types/env";
import { reserveFrankensurfCall } from "../usage/frankensurf-budget";
import { byteLength } from "../utils/bytes";
import type { ConversionResult } from "./result";

// Frankensurf (github.com/yail259/frankensurf) runs on our own server, outside
// Cloudflare. It tries a plain fetch first and escalates to stealth browsers
// only when a site pushes back. We call its Firecrawl-compatible /v1/scrape.
export async function tryFrankensurfMarkdown(
  env: Env,
  config: AppConfig,
  frankensurf: FrankensurfConfig,
  url: string,
  apiKeyId: string,
  requestId: string
): Promise<ConversionResult> {
  await reserveFrankensurfCall(env, frankensurf, apiKeyId, new Date());

  const response = await callScrape(frankensurf, url, requestId);
  const body = await readJsonBody(response);
  if (!response.ok || readPath(body, ["success"]) !== true) {
    logFailure(requestId, response.status, body);
    throw unreadable();
  }

  const markdown = readPath(body, ["data", "markdown"]);
  const finalUrl = readPath(body, ["data", "metadata", "url"]);
  const statusCode = readPath(body, ["data", "metadata", "statusCode"]);
  const via = readPath(body, ["data", "metadata", "frankensurf", "via"]);
  if (typeof markdown !== "string" || markdown.trim() === "" || typeof finalUrl !== "string") {
    logFailure(requestId, response.status, body);
    throw unreadable();
  }

  const outputBytes = byteLength(markdown);
  if (outputBytes > config.maxOutputBytes) {
    throw new ConvertingError("output_too_large", "Markdown output exceeded the byte limit.", 413);
  }

  return {
    markdown,
    method: "frankensurf",
    // Re-validated: a redirect inside Frankensurf must not land on a private host.
    url: validateAndNormalizeUrl(finalUrl),
    cached: false,
    tokens: null,
    browserMsUsed: 0,
    outputBytes,
    inputBytes: 0,
    sourceContentType: "text/html",
    sourceStatus: typeof statusCode === "number" ? statusCode : null,
    warnings: typeof via === "string" ? [`frankensurf_via:${via}`] : [],
    requestId
  };
}

async function callScrape(frankensurf: FrankensurfConfig, url: string, requestId: string): Promise<Response> {
  try {
    return await fetch(`${frankensurf.url}/v1/scrape`, {
      method: "POST",
      headers: { Authorization: `Bearer ${frankensurf.apiKey}`, "Content-Type": "application/json" },
      // Its own budget ends first, so it answers 408 instead of being cut off.
      body: JSON.stringify({ url, formats: ["markdown"], timeout: frankensurf.timeoutMs - 5000 }),
      signal: AbortSignal.timeout(frankensurf.timeoutMs)
    });
  } catch (error) {
    console.warn(JSON.stringify({ event: "frankensurf_unreachable", requestId, error: String(error) }));
    throw unreadable();
  }
}

// A proxy or crash can answer with HTML instead of the API's JSON.
async function readJsonBody(response: Response): Promise<unknown> {
  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch {
    return { error: `Non-JSON response: ${text.slice(0, 200)}` };
  }
}

function logFailure(requestId: string, status: number, body: unknown): void {
  const error = readPath(body, ["error"]);
  const tried = readPath(body, ["frankensurf", "tried"]);
  console.warn(JSON.stringify({ event: "frankensurf_failed", requestId, status, error, tried }));
}

function unreadable(): ConvertingError {
  return new ConvertingError("source_blocked", "The fallback fetcher could not read the source page.", 502);
}

function readPath(value: unknown, path: string[]): unknown {
  return path.reduce<unknown>(
    (current, key) => (typeof current === "object" && current !== null ? (current as Record<string, unknown>)[key] : undefined),
    value
  );
}
