export function absolutizeMarkdownReferences(markdown: string, baseUrl: string): string {
  const base = new URL(baseUrl);
  let fence: string | null = null;

  return markdown
    .split("\n")
    .map((line) => {
      const marker = fenceMarker(line);
      if (fence) {
        if (marker?.startsWith(fence)) fence = null;
        return line;
      }

      if (marker) {
        fence = marker;
        return line;
      }

      return transformOutsideInlineCode(line, (segment) => absolutizeHtmlAttributes(absolutizeMarkdownLinks(segment, base), base));
    })
    .join("\n");
}

function absolutizeMarkdownLinks(segment: string, base: URL): string {
  const reference = absolutizeReferenceDefinition(segment, base);
  let output = "";
  let index = 0;

  while (index < reference.length) {
    const opener = reference.indexOf("](", index);
    if (opener === -1) {
      output += reference.slice(index);
      break;
    }

    const bracket = reference.lastIndexOf("[", opener);
    if (bracket === -1 || bracket < index) {
      output += reference.slice(index, opener + 2);
      index = opener + 2;
      continue;
    }

    const close = closingParenIndex(reference, opener + 2);
    if (close === -1) {
      output += reference.slice(index);
      break;
    }

    output += reference.slice(index, opener + 2);
    output += absolutizeLinkTarget(reference.slice(opener + 2, close), base);
    output += ")";
    index = close + 1;
  }

  return output;
}

function absolutizeReferenceDefinition(segment: string, base: URL): string {
  const match = /^(\s{0,3}\[[^\]\n]+]:[ \t]*)(.*)$/.exec(segment);
  if (!match) return segment;
  return `${match[1]}${absolutizeLinkTarget(match[2] ?? "", base)}`;
}

function absolutizeLinkTarget(value: string, base: URL): string {
  const leading = value.match(/^\s*/)?.[0] ?? "";
  const rest = value.slice(leading.length);
  if (!rest) return value;

  if (rest.startsWith("<")) {
    const end = rest.indexOf(">");
    if (end === -1) return value;
    const target = rest.slice(1, end);
    return `${leading}<${absolutizeUrl(target, base)}>${rest.slice(end + 1)}`;
  }

  const end = plainTargetEnd(rest);
  const target = rest.slice(0, end);
  if (!target) return value;
  return `${leading}${absolutizeUrl(target, base)}${rest.slice(end)}`;
}

function plainTargetEnd(value: string): number {
  let depth = 0;
  let escaped = false;

  for (let index = 0; index < value.length; index += 1) {
    const char = value[index];
    if (escaped) {
      escaped = false;
      continue;
    }

    if (char === "\\") {
      escaped = true;
      continue;
    }

    if (char === "(") depth += 1;
    if (char === ")" && depth > 0) depth -= 1;
    if (depth === 0 && /\s/.test(char ?? "")) return index;
  }

  return value.length;
}

function closingParenIndex(value: string, start: number): number {
  let depth = 0;
  let escaped = false;

  for (let index = start; index < value.length; index += 1) {
    const char = value[index];
    if (escaped) {
      escaped = false;
      continue;
    }

    if (char === "\\") {
      escaped = true;
      continue;
    }

    if (char === "(") {
      depth += 1;
      continue;
    }

    if (char === ")") {
      if (depth === 0) return index;
      depth -= 1;
    }
  }

  return -1;
}

function absolutizeHtmlAttributes(segment: string, base: URL): string {
  return segment.replace(/\b(href|src|poster|srcset)=("([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/gi, (_match, attr, raw, doubleValue, singleValue, bareValue) => {
    const quote = raw.startsWith("\"") ? "\"" : raw.startsWith("'") ? "'" : "";
    const value = String(doubleValue ?? singleValue ?? bareValue ?? "");
    const absolute = attr.toLowerCase() === "srcset" ? absolutizeSrcset(value, base) : absolutizeUrl(value, base);
    return quote ? `${attr}=${quote}${absolute}${quote}` : `${attr}=${absolute}`;
  });
}

function absolutizeUrl(value: string, base: URL): string {
  if (!value.trim()) return value;
  if (/^[A-Za-z][A-Za-z0-9+.-]*:/.test(value)) return value;
  return new URL(value, base).toString();
}

function absolutizeSrcset(value: string, base: URL): string {
  return value
    .split(",")
    .map((candidate) => {
      const match = /^(\s*)(\S+)(.*)$/.exec(candidate);
      if (!match) return candidate;
      return `${match[1]}${absolutizeUrl(match[2] ?? "", base)}${match[3] ?? ""}`;
    })
    .join(",");
}

function transformOutsideInlineCode(line: string, transform: (value: string) => string): string {
  let output = "";
  let index = 0;

  while (index < line.length) {
    const tickStart = line.indexOf("`", index);
    if (tickStart === -1) {
      output += transform(line.slice(index));
      break;
    }

    output += transform(line.slice(index, tickStart));
    const tickLength = countBackticks(line, tickStart);
    const tickRun = "`".repeat(tickLength);
    const tickEnd = line.indexOf(tickRun, tickStart + tickLength);
    if (tickEnd === -1) {
      output += line.slice(tickStart);
      break;
    }

    output += line.slice(tickStart, tickEnd + tickLength);
    index = tickEnd + tickLength;
  }

  return output;
}

function fenceMarker(line: string): string | null {
  const match = /^\s*(`{3,}|~{3,})/.exec(line);
  return match?.[1] ?? null;
}

function countBackticks(line: string, start: number): number {
  let index = start;
  while (line[index] === "`") index += 1;
  return index - start;
}
