export type ButtonState = "idle" | "done" | "failed";

const resetDelayMs = 1600;
const timers = new WeakMap<HTMLButtonElement, number>();

// Each state's label is already in the markup, stacked in one grid cell, so
// the button keeps the width of its widest label as the state changes.
export function flashState(button: HTMLButtonElement, state: Exclude<ButtonState, "idle">): void {
  window.clearTimeout(timers.get(button));
  button.dataset["state"] = state;
  timers.set(
    button,
    window.setTimeout(() => {
      button.dataset["state"] = "idle";
    }, resetDelayMs)
  );
}

export async function copyText(button: HTMLButtonElement, text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    flashState(button, "done");
    return true;
  } catch (error) {
    console.error("Clipboard write failed", error);
    flashState(button, "failed");
    return false;
  }
}
