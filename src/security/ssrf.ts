import { ConvertingError } from "../http/errors";

export function assertPublicHostname(hostname: string): void {
  const host = hostname.toLowerCase();
  if (!host) throw new ConvertingError("blocked_url", "URL hostname is required.", 400);
  if (isBlockedLocalName(host) || isBlockedIpLiteral(host)) {
    throw new ConvertingError("blocked_url", "URL targets a blocked host.", 400);
  }
}

function isBlockedLocalName(host: string): boolean {
  return (
    host === "localhost" ||
    host.endsWith(".localhost") ||
    host.endsWith(".local") ||
    host.endsWith(".internal")
  );
}

function isBlockedIpLiteral(host: string): boolean {
  const unwrapped = host.replace(/^\[/, "").replace(/\]$/, "");
  return isBlockedIpv4(unwrapped) || isBlockedIpv6(unwrapped);
}

function isBlockedIpv4(host: string): boolean {
  const parts = host.split(".");
  if (parts.length !== 4) return false;

  const octets = parts.map((part) => Number(part));
  if (octets.some((octet) => !Number.isInteger(octet) || octet < 0 || octet > 255)) return false;

  const [first, second] = octets;
  if (first === undefined || second === undefined) return false;
  return (
    first === 0 ||
    first === 10 ||
    first === 127 ||
    (first === 169 && second === 254) ||
    (first === 172 && second >= 16 && second <= 31) ||
    (first === 192 && second === 168)
  );
}

function isBlockedIpv6(host: string): boolean {
  const value = host.toLowerCase();
  return value === "::1" || value.startsWith("fc") || value.startsWith("fd") || value.startsWith("fe80:");
}

