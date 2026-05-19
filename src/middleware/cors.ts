import { createMiddleware } from "hono/factory";
import type { AppEnv } from "../types/env";

export const corsMiddleware = createMiddleware<AppEnv>(async (c, next) => {
  await next();
  c.header("Vary", "Origin");
});
