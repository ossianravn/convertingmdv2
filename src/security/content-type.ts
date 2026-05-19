const imageExtensions = [".jpg", ".jpeg", ".png", ".webp", ".svg", ".gif"];

export function isHtmlContentType(contentType: string | null): boolean {
  return normalized(contentType).startsWith("text/html");
}

export function isMarkdownContentType(contentType: string | null): boolean {
  const value = normalized(contentType);
  return value.startsWith("text/markdown") || value.startsWith("text/x-markdown");
}

export function isImageContentType(contentType: string | null): boolean {
  return normalized(contentType).startsWith("image/");
}

export function isSupportedDocumentContentType(contentType: string | null): boolean {
  const value = normalized(contentType);
  return isHtmlContentType(value) || value.startsWith("application/pdf") || value.startsWith("text/plain");
}

export function isLikelyImageUrl(url: string): boolean {
  const pathname = new URL(url).pathname.toLowerCase();
  return imageExtensions.some((extension) => pathname.endsWith(extension));
}

function normalized(contentType: string | null): string {
  return contentType?.toLowerCase().trim() ?? "";
}

