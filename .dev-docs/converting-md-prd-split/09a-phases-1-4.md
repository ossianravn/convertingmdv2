# 09A — Implementation Phases 1–4
## Phase 1 — Project setup

Tasks:

```txt
Initialize package.json.
Add TypeScript.
Add Wrangler.
Add Vitest.
Add Hono or a small custom router.
Add tsconfig.json.
Add wrangler.jsonc.
Add .dev.vars.example.
Add src/index.ts and src/app.ts.
Add /healthz route.
```

Acceptance criteria:

```txt
npm run typecheck passes.
npm run dev starts Worker.
GET /healthz returns JSON { ok: true }.
No source file >300 lines.
```

## Phase 2 — Types, config, and error handling

Tasks:

```txt
Create src/types/env.ts.
Create src/config.ts.
Create src/http/responses.ts.
Create src/middleware/errors.ts.
Create src/middleware/request-id.ts.
Create common ErrorCode type.
Create consistent JSON error response helper.
```

Acceptance criteria:

```txt
Every response has X-Converting-Request-Id.
Errors use the standard error shape.
Config parses env vars into typed values.
Bad env config fails loudly.
```

## Phase 3 — D1 migration and API-key auth

Tasks:

```txt
Create 0001_init.sql.
Implement key hashing with API_KEY_PEPPER.
Implement auth middleware.
Implement API key lookup in D1.
Implement last_used_at update.
Implement POST /v1/admin/api-keys.
Implement GET /v1/admin/api-keys.
Implement PATCH /v1/admin/api-keys/:id.
```

Acceptance criteria:

```txt
Raw API key is returned only once.
D1 stores only key hash and prefix.
Missing conversion API key returns 401.
Invalid conversion API key returns 401.
Revoked key returns 403.
Admin endpoints require ADMIN_TOKEN.
```

## Phase 4 — Quotas and budget counters

Tasks:

```txt
Implement usage periods: day and month.
Implement request quota checks.
Implement request counter increment.
Implement image quota checks.
Implement browser-ms reservation.
Implement browser-ms commit/release.
Implement global counters.
```

Acceptance criteria:

```txt
Daily request limit is enforced.
Monthly request limit is enforced.
Browser cannot run without reservation.
Reservations are released on browser failure.
Global browser-ms cap is enforced.
Image quota is enforced.
```
