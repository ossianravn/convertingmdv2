export type ConversionPath = { ok: true; path: string } | { ok: false; message: string };

const schemePattern = /^[a-z][a-z\d+.-]*:\/\//i;

// Turns what someone typed into the address-bar route: "example.com/a"
// becomes "/https://example.com/a". The server still validates the target.
export function conversionPath(input: string): ConversionPath {
  const trimmed = input.trim();
  if (trimmed === "") return invalid("Enter a web address.");

  const url = parseUrl(schemePattern.test(trimmed) ? trimmed : `https://${trimmed}`);
  if (!url) return invalid("That doesn't look like a web address.");
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    return invalid("Use an address that starts with http:// or https://.");
  }
  if (url.username !== "" || url.password !== "") return invalid("Remove the username and password from the address.");
  if (!url.hostname.includes(".")) return invalid("Enter a full address, like example.com/page.");

  url.hash = "";
  return { ok: true, path: `/${url.href}` };
}

function parseUrl(value: string): URL | null {
  return URL.canParse(value) ? new URL(value) : null;
}

function invalid(message: string): ConversionPath {
  return { ok: false, message };
}
