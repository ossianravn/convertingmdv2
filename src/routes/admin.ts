import type { Hono } from "hono";
import { createApiKey, listApiKeys, patchApiKey } from "../auth/api-keys";
import { jsonResponse } from "../http/responses";
import { requireAdminToken } from "../middleware/auth";
import type { AppEnv } from "../types/env";
import { parseCreateApiKeyRequest, parsePatchApiKeyRequest } from "../validation/admin-request";
import { getAdminUsageReport } from "../usage/admin-report";

export function registerAdminRoutes(app: Hono<AppEnv>): void {
  app.post("/v1/admin/api-keys", requireAdminToken, async (c) => {
    const input = await parseCreateApiKeyRequest(c.req.raw);
    const created = await createApiKey(c.env, input, new Date());
    return jsonResponse(created, 201, c.get("requestId"));
  });

  app.get("/v1/admin/api-keys", requireAdminToken, async (c) => {
    const keys = await listApiKeys(c.env);
    return jsonResponse({ apiKeys: keys }, 200, c.get("requestId"));
  });

  app.patch("/v1/admin/api-keys/:id", requireAdminToken, async (c) => {
    const patch = await parsePatchApiKeyRequest(c.req.raw);
    const key = await patchApiKey(c.env, c.req.param("id"), patch, new Date());
    return jsonResponse(key, 200, c.get("requestId"));
  });

  app.get("/v1/admin/usage", requireAdminToken, async (c) => {
    const usage = await getAdminUsageReport(c.env);
    return jsonResponse({ usage }, 200, c.get("requestId"));
  });
}
