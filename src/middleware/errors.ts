import type { Context } from "hono";
import { errorResponse } from "../http/responses";
import { toConvertingError } from "../http/errors";
import type { AppEnv } from "../types/env";

export function handleError(error: unknown, c: Context<AppEnv>): Response {
  const requestId = c.get("requestId") ?? "req_unknown";
  return errorResponse(toConvertingError(error), requestId);
}

