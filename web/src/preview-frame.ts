import { standaloneDocument } from "./html-document";
import { externalLinkTarget } from "./links";

export interface PreviewFrame {
  render(html: string): void;
}

// The frame is sandboxed without allow-scripts, so HTML inside the Markdown
// cannot run. allow-same-origin lets this script update the body in place,
// which keeps the reader's scroll position while they type.
export function mountPreviewFrame(frame: HTMLIFrameElement, css: string): PreviewFrame {
  let body: HTMLElement | null = null;
  let pending: string | null = null;

  frame.addEventListener("load", () => {
    const doc = frame.contentDocument;
    if (!doc) throw new Error("Preview frame document is not accessible.");

    doc.addEventListener("click", (event) => handleLinkClick(doc, event));
    body = doc.body;
    if (pending !== null) body.innerHTML = pending;
  });
  frame.srcdoc = standaloneDocument("", "Preview", css);

  return {
    render(html) {
      pending = html;
      if (body) body.innerHTML = html;
    }
  };
}

function handleLinkClick(doc: Document, event: MouseEvent): void {
  // Elements in the frame belong to its own realm, so instanceof Element fails.
  const target = event.target as Element | null;
  const link = target?.closest?.("a[href]");
  if (!link) return;

  event.preventDefault();
  const href = link.getAttribute("href") ?? "";
  if (href.startsWith("#")) {
    doc.getElementById(decodeURIComponent(href.slice(1)))?.scrollIntoView();
    return;
  }

  const url = externalLinkTarget(href);
  if (url) window.open(url, "_blank", "noopener,noreferrer");
}
