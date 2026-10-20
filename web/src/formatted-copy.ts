import { plainText } from "./plain-text";

// Word and Google Docs read the text/html flavour. They ignore stylesheets, so
// the few styles that carry meaning (table borders, code font) go inline, in
// light-document colours whatever theme the page uses.
const inlineStyles: Array<[selector: string, style: string]> = [
  ["table", "border-collapse: collapse;"],
  ["th, td", "border: 1px solid #d0d7de; padding: 4px 8px;"],
  ["th", "background: #f6f8fa;"],
  ["pre", "background: #f6f8fa; padding: 8px 12px; white-space: pre-wrap;"],
  ["code, pre", "font-family: Consolas, Menlo, 'Courier New', monospace;"],
  ["blockquote", "margin-left: 0; padding-left: 12px; border-left: 3px solid #d0d7de; color: #57606a;"]
];

export function formattedClipboardItem(html: string): ClipboardItem {
  // DOMParser builds an inert document: no scripts run and nothing loads.
  const doc = new DOMParser().parseFromString(html, "text/html");
  for (const [selector, style] of inlineStyles) {
    for (const element of doc.body.querySelectorAll<HTMLElement>(selector)) {
      element.style.cssText += style;
    }
  }
  for (const cell of doc.body.querySelectorAll<HTMLElement>("th[align], td[align]")) {
    cell.style.textAlign = cell.getAttribute("align") ?? "";
  }

  return new ClipboardItem({
    "text/html": new Blob([doc.body.innerHTML], { type: "text/html" }),
    "text/plain": new Blob([plainText(doc.body)], { type: "text/plain" })
  });
}
