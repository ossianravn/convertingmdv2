export function isGoodEnough(markdown: string, inputBytes: number): boolean {
  const trimmed = markdown.trim();
  if (trimmed.length === 0) return false;
  if (trimmed.length < 80 && inputBytes > 4000) return false;
  if (/^(cookie|enable javascript|access denied)$/i.test(trimmed)) return false;
  if (trimmed.includes("CONVERSION_ERROR")) return false;
  return true;
}

