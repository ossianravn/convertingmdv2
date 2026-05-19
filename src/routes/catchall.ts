import type { Hono } from "hono";
import { parseConfig } from "../config";
import { ConvertingError } from "../http/errors";
import { jsonResponse } from "../http/responses";
import { authenticateApiKey } from "../middleware/auth";
import type { AppEnv } from "../types/env";
import {
  isConvenienceMarkdownPath,
  parseConvenienceMarkdownRequest
} from "../validation/markdown-request";
import { handleMarkdownRequest } from "./markdown";

export function registerCatchallRoutes(app: Hono<AppEnv>): void {
  app.get("/", (c) => {
    return jsonResponse(
      {
        service: "converting.md",
        routes: ["GET /healthz", "POST /v1/markdown", "GET /v1/markdown?url=", "GET /https://example.com/page"],
        auth: "Conversion routes require Authorization: Bearer cmd_live_... unless anonymous mode is enabled."
      },
      200,
      c.get("requestId")
    );
  });

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
