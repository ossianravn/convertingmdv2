import { describe, expect, it } from "vitest";
import { absolutizeMarkdownReferences } from "../src/conversion/markdown-references";

describe("Markdown reference URL normalization", () => {
  it("absolutizes markdown and HTML URL references outside code", () => {
    const input = [
      "[Root](/saelg-bolig/)",
      "[Relative](../team?x=1#bio)",
      "[Anchor](#contact)",
      "![Logo](/images/logo.png \"Logo\")",
      "[Wrapped](</files/salgs dokument.pdf>)",
      "[Mail](mailto:371@edc.dk) [Phone](tel:56955683) [External](https://edc.dk/)",
      "[card]: /api/v1/employees/vcard/abc \"Card\"",
      "<a href=\"/kontakt\">Kontakt</a><img src='./images/shop.jpg' srcset=\"/images/shop.jpg 1x, ./images/shop@2x.jpg 2x\">",
      "`[Code](/not-changed)`",
      "```",
      "[Fenced](/not-changed)",
      "```"
    ].join("\n");

    expect(absolutizeMarkdownReferences(input, "https://www.edc.dk/ejendomsmaegler/roenne/bornholmerbo/")).toBe(
      [
        "[Root](https://www.edc.dk/saelg-bolig/)",
        "[Relative](https://www.edc.dk/ejendomsmaegler/roenne/team?x=1#bio)",
        "[Anchor](https://www.edc.dk/ejendomsmaegler/roenne/bornholmerbo/#contact)",
        "![Logo](https://www.edc.dk/images/logo.png \"Logo\")",
        "[Wrapped](<https://www.edc.dk/files/salgs%20dokument.pdf>)",
        "[Mail](mailto:371@edc.dk) [Phone](tel:56955683) [External](https://edc.dk/)",
        "[card]: https://www.edc.dk/api/v1/employees/vcard/abc \"Card\"",
        "<a href=\"https://www.edc.dk/kontakt\">Kontakt</a><img src='https://www.edc.dk/ejendomsmaegler/roenne/bornholmerbo/images/shop.jpg' srcset=\"https://www.edc.dk/images/shop.jpg 1x, https://www.edc.dk/ejendomsmaegler/roenne/bornholmerbo/images/shop@2x.jpg 2x\">",
        "`[Code](/not-changed)`",
        "```",
        "[Fenced](/not-changed)",
        "```"
      ].join("\n")
    );
  });
});
