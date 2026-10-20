import { mountCodeCopyButtons } from "./code-copy";
import { mountConverter } from "./converter";
import documentCss from "./document.css";
import { requireElement } from "./dom";
import { mountUrlForm } from "./url-form";

const status = requireElement(document, "#page-status", HTMLElement);

mountUrlForm(requireElement(document, "#url-form", HTMLFormElement));
mountConverter(requireElement(document, "#converter", HTMLElement), documentCss, status);
mountCodeCopyButtons(document, status);
