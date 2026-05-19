import { ConvertingError } from "../http/errors";
import { assertPublicHostname } from "./ssrf";

const allowedProtocols = new Set(["http:", "https:"]);

export function validateAndNormalizeUrl(rawUrl: string): string {
  const url = parseUrl(rawUrl);
  if (!allowedProtocols.has(url.protocol)) {
    throw new ConvertingError("unsupported_scheme", "Only http and https URLs are supported.", 400);
  }
  if (url.username || url.password) {
    throw new ConvertingError("blocked_url", "URLs with credentials are not allowed.", 400);
  }
  validatePort(url);
  assertPublicHostname(url.hostname);

  url.protocol = url.protocol.toLowerCase();
  url.hostname = url.hostname.toLowerCase();
  url.hash = "";
  if ((url.protocol === "https:" && url.port === "443") || (url.protocol === "http:" && url.port === "80")) {
    url.port = "";
  }

  return url.toString();
}

export function assertRedirectAllowed(location: string, baseUrl: string): string {
  const redirected = new URL(location, baseUrl).toString();
  return validateAndNormalizeUrl(redirected);
}

function parseUrl(rawUrl: string): URL {
  try {
    return new URL(rawUrl);
  } catch {
    throw new ConvertingError("invalid_url", "URL is invalid.", 400);
  }
}

function validatePort(url: URL): void {
  if (!url.port) return;

  const port = Number(url.port);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new ConvertingError("blocked_url", "URL port is outside the allowed range.", 400);
  }
}

