import { ConvertingError } from "./errors";
import { assertRedirectAllowed, validateAndNormalizeUrl } from "../security/url";

export interface FetchWithLimitsOptions {
  accept: string;
  maxBytes: number;
  maxRedirects: number;
  timeoutMs: number;
  userAgent: string;
}

export interface LimitedFetchResult {
  url: string;
  response: Response;
  body: ArrayBuffer;
  bytesRead: number;
}

export async function fetchWithLimits(url: string, options: FetchWithLimitsOptions): Promise<LimitedFetchResult> {
  let currentUrl = validateAndNormalizeUrl(url);

  for (let redirects = 0; redirects <= options.maxRedirects; redirects += 1) {
    const response = await fetchOnce(currentUrl, options);

    if (isRedirect(response.status)) {
      const location = response.headers.get("Location");
      if (!location) throw new ConvertingError("conversion_failed", "Redirect response did not include Location.", 502);
      currentUrl = assertRedirectAllowed(location, currentUrl);
      continue;
    }

    const body = await readBodyWithLimit(response, options.maxBytes);
    return {
      url: currentUrl,
      response,
      body,
      bytesRead: body.byteLength
    };
  }

  throw new ConvertingError("blocked_url", "Too many redirects.", 400);
}

async function fetchOnce(url: string, options: FetchWithLimitsOptions): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs);

  try {
    return await fetch(url, {
      method: "GET",
      redirect: "manual",
      signal: controller.signal,
      headers: {
        Accept: options.accept,
        "User-Agent": options.userAgent
      }
    });
  } finally {
    clearTimeout(timeout);
  }
}

async function readBodyWithLimit(response: Response, maxBytes: number): Promise<ArrayBuffer> {
  const body = await response.arrayBuffer();
  if (body.byteLength > maxBytes) {
    throw new ConvertingError("source_too_large", "Source response exceeded the byte limit.", 413);
  }

  return body;
}

function isRedirect(status: number): boolean {
  return status >= 300 && status < 400;
}

