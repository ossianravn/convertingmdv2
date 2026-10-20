import type { Hono } from "hono";
import { parseConfig } from "../config";
import { ConvertingError } from "../http/errors";
import { authenticateApiKey } from "../middleware/auth";
import type { AppEnv } from "../types/env";
import {
  isConvenienceMarkdownPath,
  parseConvenienceMarkdownRequest
} from "../validation/markdown-request";
import { handleMarkdownRequest } from "./markdown";

export function registerCatchallRoutes(app: Hono<AppEnv>): void {
  app.get("*", async (c) => {
    const url = new URL(c.req.url);
    if (!isConvenienceMarkdownPath(url)) {
      throw new ConvertingError("not_found", "Route not found.", 404);
    }

    const apiKey = await authenticateApiKey(c);
    c.set("apiKey", apiKey);
    const config = parseConfig(c.env);
    const request = parseConvenienceMarkdownRequest(url, config.defaultCacheTtlSeconds);
    return handleMarkdownRequest(c, request, config);
  });
}
