import { createMiddleware } from "hono/factory";
import { ConvertingError } from "../http/errors";
import type { AppEnv } from "../types/env";

export const rejectQueryStringAuth = createMiddleware<AppEnv>(async (c, next) => {
  const url = new URL(c.req.url);
  if (url.searchParams.has("api_key")) {
    throw new ConvertingError("invalid_request", "Query-string API keys are not supported.", 400);
  }

  await next();
});
