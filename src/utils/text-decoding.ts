export function decodeTextBody(body: ArrayBuffer, contentType: string | null): string {
  const charset = charsetFromContentType(contentType);
  if (!charset) return new TextDecoder().decode(body);

  try {
    return new TextDecoder(charset).decode(body);
  } catch {
    return new TextDecoder().decode(body);
  }
}

function charsetFromContentType(contentType: string | null): string | null {
  const match = /(?:^|;)\s*charset\s*=\s*("?)([^";\s]+)\1/i.exec(contentType ?? "");
  return match?.[2]?.trim() || null;
}
