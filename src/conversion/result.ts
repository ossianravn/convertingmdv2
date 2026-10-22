export type ConversionMethod = "native" | "ai" | "browser" | "frankensurf";

export interface ConversionResult {
  markdown: string;
  method: ConversionMethod;
  url: string;
  cached: boolean;
  tokens: number | null;
  browserMsUsed: number;
  outputBytes: number;
  inputBytes: number;
  sourceContentType: string | null;
  /** HTTP status the source answered with; null when the strategy does not report one. */
  sourceStatus: number | null;
  warnings: string[];
  requestId: string;
}

