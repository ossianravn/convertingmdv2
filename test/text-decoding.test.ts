import { describe, expect, it } from "vitest";
import { decodeTextBody } from "../src/utils/text-decoding";

describe("text body decoding", () => {
  it("decodes UTF-8 when no charset is declared", () => {
    expect(decodeTextBody(arrayBuffer(new TextEncoder().encode("København")), "text/plain")).toBe("København");
  });

  it("respects source charset declarations", () => {
    const latin1 = Uint8Array.from([0x4b, 0xf8, 0x62, 0x65, 0x6e, 0x68, 0x61, 0x76, 0x6e]);

    expect(decodeTextBody(arrayBuffer(latin1), 'text/plain; charset="iso-8859-1"')).toBe("København");
  });
});

function arrayBuffer(value: Uint8Array): ArrayBuffer {
  const buffer = new ArrayBuffer(value.byteLength);
  new Uint8Array(buffer).set(value);
  return buffer;
}
