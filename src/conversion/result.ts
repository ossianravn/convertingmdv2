export type ConversionMethod = "native" | "ai" | "browser";

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
  warnings: string[];
  requestId: string;
}

