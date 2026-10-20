import { announce } from "./dom";
import { copyText } from "./stateful-button";

// Buttons with data-copy="<id>" copy the text of that element.
export function mountCodeCopyButtons(root: ParentNode, status: HTMLElement): void {
  for (const button of root.querySelectorAll<HTMLButtonElement>("button[data-copy]")) {
    const source = document.getElementById(button.dataset["copy"] ?? "");
    if (!source) throw new Error(`Copy button targets missing #${button.dataset["copy"]}.`);

    button.addEventListener("click", async () => {
      const copied = await copyText(button, source.textContent ?? "");
      announce(status, copied ? "Copied" : "Couldn't copy");
    });
  }
}
