const openableProtocols = new Set(["http:", "https:", "mailto:"]);

// Links in the preview open in a new tab, but only to ordinary destinations.
// Relative links have nothing to resolve against and stay inert.
export function externalLinkTarget(href: string): string | null {
  if (!URL.canParse(href)) return null;

  const url = new URL(href);
  return openableProtocols.has(url.protocol) ? url.href : null;
}
