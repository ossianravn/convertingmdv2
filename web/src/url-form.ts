import { requireElement } from "./dom";
import { conversionPath } from "./target-url";

// Without script the form still works: it submits to /v1/markdown?url=.
export function mountUrlForm(form: HTMLFormElement): void {
  const input = requireElement(form, "input[name=url]", HTMLInputElement);
  const error = requireElement(form, ".field-error", HTMLElement);
  const submit = requireElement(form, "button[type=submit]", HTMLButtonElement);

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    if (submit.dataset["state"] === "busy") return;

    const result = conversionPath(input.value);
    if (!result.ok) {
      showError(input, error, result.message);
      input.focus();
      return;
    }

    submit.dataset["state"] = "busy";
    submit.setAttribute("aria-disabled", "true");
    window.location.assign(result.path);
  });

  input.addEventListener("input", () => showError(input, error, null));

  // Back from the Markdown page restores this page from cache, still busy.
  window.addEventListener("pageshow", () => {
    submit.dataset["state"] = "idle";
    submit.removeAttribute("aria-disabled");
  });
}

function showError(input: HTMLInputElement, error: HTMLElement, message: string | null): void {
  error.textContent = message ?? "";
  error.hidden = message === null;
  if (message === null) input.removeAttribute("aria-invalid");
  else input.setAttribute("aria-invalid", "true");
}
