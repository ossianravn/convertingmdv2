export function parseJsonObject(value: unknown): Record<string, unknown> {
  if (!isRecord(value)) {
    throw new Error("Expected a JSON object");
  }

  return value;
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

