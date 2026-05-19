import { createMiddleware } from "hono/factory";
import { createRequestId } from "../utils/crypto";
import type { AppEnv } from "../types/env";

export const requestIdMiddleware = createMiddleware<AppEnv>(async (c, next) => {
  const requestId = c.req.header("X-Converting-Request-Id") ?? createRequestId();
  c.set("requestId", requestId);
  await next();
  c.header("X-Converting-Request-Id", requestId);
});

