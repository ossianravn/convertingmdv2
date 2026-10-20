import { announce, requireElement } from "./dom";
import { formattedClipboardItem } from "./formatted-copy";
import { downloadFileName, standaloneDocument } from "./html-document";
import { renderMarkdown, type RenderedMarkdown } from "./markdown";
import { mountOutputTabs, type OutputView } from "./output-tabs";
import { mountPreviewFrame } from "./preview-frame";
import { createRenderScheduler } from "./render-scheduler";
import { copyItem, copyText } from "./stateful-button";

export function mountConverter(root: HTMLElement, documentCss: string, status: HTMLElement): void {
  const editor = requireElement(root, "#markdown-input", HTMLTextAreaElement);
  const htmlOutput = requireElement(root, "#html-output", HTMLElement);
  const copyFormattedButton = requireElement(root, "#copy-formatted", HTMLButtonElement);
  const copyHtmlButton = requireElement(root, "#copy-html", HTMLButtonElement);
  const downloadButton = requireElement(root, "#download-html", HTMLButtonElement);
  const preview = mountPreviewFrame(requireElement(root, "#preview-frame", HTMLIFrameElement), documentCss);

  let view: OutputView = "preview";
  let rendered: RenderedMarkdown = renderMarkdown(editor.value);

  // Only the visible output is updated; switching views catches up.
  const show = (): void => {
    if (view === "preview") preview.render(rendered.html);
    else htmlOutput.textContent = rendered.html;
  };
  const scheduler = createRenderScheduler(() => {
    rendered = renderMarkdown(editor.value);
    show();
  });

  editor.addEventListener("input", () => scheduler.schedule());
  mountOutputTabs(requireElement(root, "[role=tablist]", HTMLElement), (next) => {
    view = next;
    show();
  });

  copyFormattedButton.addEventListener("click", async () => {
    scheduler.flush();
    const copied = await copyItem(copyFormattedButton, () => formattedClipboardItem(rendered.html));
    announce(status, copied ? "Formatted text copied" : "Couldn't copy the formatted text");
  });
  copyHtmlButton.addEventListener("click", async () => {
    scheduler.flush();
    const copied = await copyText(copyHtmlButton, rendered.html);
    announce(status, copied ? "HTML copied" : "Couldn't copy the HTML");
  });
  downloadButton.addEventListener("click", () => {
    scheduler.flush();
    downloadDocument(rendered, documentCss);
  });

  show();
}

function downloadDocument(rendered: RenderedMarkdown, css: string): void {
  const html = standaloneDocument(rendered.html, rendered.title ?? "Document", css);
  const url = URL.createObjectURL(new Blob([html], { type: "text/html;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = downloadFileName(rendered.title);
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
