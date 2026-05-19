import { Hono } from "hono";
import { ConvertingError } from "./http/errors";
import { errorResponse } from "./http/responses";
import { handleError } from "./middleware/errors";
import { rejectQueryStringAuth } from "./middleware/query-string-auth";
import { requestIdMiddleware } from "./middleware/request-id";
import { registerAdminRoutes } from "./routes/admin";
import { registerCatchallRoutes } from "./routes/catchall";
import { registerHealthRoutes } from "./routes/health";
import { registerMarkdownRoutes } from "./routes/markdown";
import type { AppEnv } from "./types/env";

export function createApp(): Hono<AppEnv> {
  const app = new Hono<AppEnv>();

  app.use("*", requestIdMiddleware);
  app.use("*", rejectQueryStringAuth);
  app.onError(handleError);

  registerHealthRoutes(app);
  registerMarkdownRoutes(app);
  registerAdminRoutes(app);
  registerCatchallRoutes(app);

  app.notFound((c) => {
    return errorResponse(new ConvertingError("not_found", "Route not found.", 404), c.get("requestId"));
  });

  return app;
}

export const app = createApp();
