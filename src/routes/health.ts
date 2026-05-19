import type { Hono } from "hono";
import { jsonResponse } from "../http/responses";
import type { AppEnv } from "../types/env";

export function registerHealthRoutes(app: Hono<AppEnv>): void {
  app.get("/healthz", (c) => {
    return jsonResponse({ ok: true }, 200, c.get("requestId"));
  });
}

