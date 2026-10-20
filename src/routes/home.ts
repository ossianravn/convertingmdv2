import type { Context, Hono } from "hono";
import { acceptsHtml } from "../http/accept";
import { ConvertingError } from "../http/errors";
import { requestHeaders } from "../http/headers";
import { setPageHeaders } from "../http/page-headers";
import { jsonResponse } from "../http/responses";
import type { AppEnv } from "../types/env";

const routeIndex = {
  service: "converting.md",
  routes: ["GET /healthz", "POST /v1/markdown", "GET /v1/markdown?url=", "GET /https://example.com/page"],
  auth: "Conversion routes require Authorization: Bearer cmd_live_... unless anonymous mode is enabled."
};

export function registerHomeRoutes(app: Hono<AppEnv>): void {
  app.get("/", async (c) => {
    if (acceptsHtml(c.req.header("Accept"))) return homePage(c);

    return jsonResponse(routeIndex, 200, c.get("requestId"), { Vary: "Accept" });
  });
}

async function homePage(c: Context<AppEnv>): Promise<Response> {
  // Forward the browser's headers so conditional requests can return 304.
  const asset = await c.env.ASSETS.fetch(new Request(new URL("/index.html", c.req.url), c.req.raw));
  if (!asset.ok && asset.status !== 304) {
    throw new ConvertingError("internal_error", `Frontpage asset returned ${asset.status}.`, 500);
  }

  const headers = requestHeaders(c.get("requestId"));
  asset.headers.forEach((value, key) => headers.set(key, value));
  headers.set("Vary", "Accept");
  setPageHeaders(headers);
  return new Response(asset.body, { status: asset.status, headers });
}
