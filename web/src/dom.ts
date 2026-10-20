// Markup and script ship together, so a missing element is a bug: fail loudly.
export function requireElement<T extends Element>(
  root: ParentNode,
  selector: string,
  type: abstract new (...args: never[]) => T
): T {
  const element = root.querySelector(selector);
  if (!(element instanceof type)) {
    throw new Error(`Expected ${selector} to be a ${type.name}.`);
  }

  return element;
}

export function announce(region: HTMLElement, message: string): void {
  // Clearing first makes screen readers repeat an identical message.
  region.textContent = "";
  requestAnimationFrame(() => {
    region.textContent = message;
  });
}
