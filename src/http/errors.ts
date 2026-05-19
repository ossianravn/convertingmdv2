import type { ErrorCode } from "../types/api";

export class ConvertingError extends Error {
  readonly code: ErrorCode;
  readonly status: number;

  constructor(code: ErrorCode, message: string, status: number) {
    super(message);
    this.name = "ConvertingError";
    this.code = code;
    this.status = status;
  }
}

export function toConvertingError(error: unknown): ConvertingError {
  if (error instanceof ConvertingError) return error;
  if (error instanceof Error) return new ConvertingError("conversion_failed", error.message, 500);
  return new ConvertingError("conversion_failed", "Unexpected conversion failure.", 500);
}

