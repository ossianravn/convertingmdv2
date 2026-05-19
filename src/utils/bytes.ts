const encoder = new TextEncoder();

export function byteLength(value: string): number {
  return encoder.encode(value).byteLength;
}

export function assertMaxBytes(value: string, maxBytes: number, label: string): void {
  const size = byteLength(value);
  if (size > maxBytes) {
    throw new Error(`${label} exceeds ${maxBytes} bytes`);
  }
}

