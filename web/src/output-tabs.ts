export type OutputView = "preview" | "html";

// WAI-ARIA tabs with automatic activation: arrows, Home and End move between
// Preview and HTML.
export function mountOutputTabs(tablist: HTMLElement, onChange: (view: OutputView) => void): void {
  const tabs = Array.from(tablist.querySelectorAll<HTMLButtonElement>("[role=tab]"));

  const select = (tab: HTMLButtonElement, focus: boolean): void => {
    for (const other of tabs) {
      const selected = other === tab;
      other.setAttribute("aria-selected", String(selected));
      other.tabIndex = selected ? 0 : -1;
      panelFor(other).hidden = !selected;
    }

    if (focus) tab.focus();
    onChange(viewOf(tab));
  };

  for (const [index, tab] of tabs.entries()) {
    tab.addEventListener("click", () => select(tab, false));
    tab.addEventListener("keydown", (event) => {
      const next = nextIndex(event.key, index, tabs.length);
      if (next === null) return;

      event.preventDefault();
      const nextTab = tabs[next];
      if (nextTab) select(nextTab, true);
    });
  }
}

function nextIndex(key: string, index: number, count: number): number | null {
  if (key === "ArrowRight") return (index + 1) % count;
  if (key === "ArrowLeft") return (index - 1 + count) % count;
  if (key === "Home") return 0;
  if (key === "End") return count - 1;
  return null;
}

function panelFor(tab: HTMLButtonElement): HTMLElement {
  const panel = document.getElementById(tab.getAttribute("aria-controls") ?? "");
  if (!panel) throw new Error(`Tab ${tab.id} has no panel.`);
  return panel;
}

function viewOf(tab: HTMLButtonElement): OutputView {
  const view = tab.dataset["view"];
  if (view !== "preview" && view !== "html") throw new Error(`Tab ${tab.id} has no known data-view.`);
  return view;
}
