// A complete HTML file around converted Markdown. The preview frame and the
// download use the same document, so what you see is what you save.
export function standaloneDocument(bodyHtml: string, title: string, css: string): string {
  return [
    "<!doctype html>",
    "<html>",
    "<head>",
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    `<title>${escapeHtml(title)}</title>`,
    "<style>",
    css.trim(),
    "</style>",
    "</head>",
    "<body>",
    bodyHtml.trim(),
    "</body>",
    "</html>",
    ""
  ].join("\n");
}

export function downloadFileName(title: string | null): string {
  // Letters in any script are kept: a Danish title stays readable.
  const words = (title ?? "").normalize("NFC").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "-");
  const slug = Array.from(words.replace(/^-+/, "")).slice(0, 60).join("").replace(/-+$/, "");

  return `${slug === "" ? "document" : slug}.html`;
}

export function escapeHtml(text: string): string {
  return text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}
