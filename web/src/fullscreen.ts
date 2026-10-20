// Shows the converter in browser full screen. Esc exits natively. The button
// stays hidden where the browser cannot put an element in full screen (iPhone).
export function mountFullscreenToggle(button: HTMLButtonElement, target: HTMLElement): void {
  if (!document.fullscreenEnabled) return;

  button.hidden = false;
  button.addEventListener("click", () => {
    const request = document.fullscreenElement === target ? document.exitFullscreen() : target.requestFullscreen();
    request.catch((error: unknown) => console.error("Full screen change failed", error));
  });
  document.addEventListener("fullscreenchange", () => {
    button.dataset["state"] = document.fullscreenElement === target ? "active" : "idle";
  });
}
