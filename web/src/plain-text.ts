// Readable text for apps that only accept plain text: bullets, numbers and
// tab-separated table cells instead of Markdown syntax.
const spacedBlocks = new Set(["P", "H1", "H2", "H3", "H4", "H5", "H6", "PRE", "BLOCKQUOTE", "TABLE", "DL"]);
const skipped = new Set(["SCRIPT", "STYLE", "TEMPLATE"]);

export function plainText(root: Node): string {
  return children(root, 0)
    .split("\n")
    .map((line) => line.trimEnd())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function children(node: Node, depth: number): string {
  return Array.from(node.childNodes, (child) => visit(child, depth)).join("");
}

function visit(node: Node, depth: number): string {
  if (node.nodeType === Node.TEXT_NODE) {
    const text = node.textContent ?? "";
    return node.parentElement?.closest("pre") ? text : text.replace(/\s+/g, " ");
  }
  if (!(node instanceof Element) || skipped.has(node.tagName)) return "";

  switch (node.tagName) {
    case "BR":
      return "\n";
    case "HR":
      return "\n\n———\n\n";
    case "IMG":
      return node.getAttribute("alt") ?? "";
    case "INPUT":
      return node.getAttribute("type") === "checkbox" ? (node.hasAttribute("checked") ? "☑" : "☐") : "";
    case "UL":
    case "OL":
      return depth === 0 ? `\n\n${children(node, depth)}\n\n` : children(node, depth);
    case "LI":
      return `\n${"  ".repeat(depth)}${listMarker(node)}${children(node, depth + 1).trim()}`;
    case "TR":
      return `\n${Array.from(node.children, (cell) => children(cell, depth).trim()).join("\t")}`;
  }

  const inner = children(node, depth);
  return spacedBlocks.has(node.tagName) ? `\n\n${inner}\n\n` : inner;
}

function listMarker(item: Element): string {
  // A task item's checkbox takes the bullet's place.
  if (item.firstElementChild?.matches("input[type=checkbox]")) return "";

  const list = item.parentElement;
  if (list?.tagName !== "OL") return "• ";

  const start = Number(list.getAttribute("start") ?? "1");
  return `${start + Array.from(list.children).indexOf(item)}. `;
}
