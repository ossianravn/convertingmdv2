import { Marked, type Token } from "marked";

export interface RenderedMarkdown {
  html: string;
  title: string | null;
}

const marked = new Marked({ gfm: true, breaks: false });

export function renderMarkdown(source: string): RenderedMarkdown {
  const tokens = marked.lexer(source);
  const title = firstHeadingText(tokens);
  return { html: marked.parser(tokens), title };
}

function firstHeadingText(tokens: Token[]): string | null {
  const heading = tokens.find((token) => token.type === "heading");
  if (!heading) return null;

  const text = plainText([heading]).replace(/\s+/g, " ").trim();
  return text === "" ? null : text;
}

function plainText(tokens: Token[]): string {
  return tokens
    .map((token) => {
      if ("tokens" in token && Array.isArray(token.tokens) && token.tokens.length > 0) return plainText(token.tokens);
      if (token.type === "html") return "";
      return "text" in token && typeof token.text === "string" ? token.text : "";
    })
    .join("");
}
