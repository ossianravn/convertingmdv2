# 02B — Repo Structure and Standards
## Repo structure

Create this structure:

```txt
converting-md/
  package.json
  tsconfig.json
  wrangler.jsonc
  vitest.config.ts
  .dev.vars.example
  README.md

  migrations/
    0001_init.sql

  scripts/
    check-file-lines.ts
    create-local-key.ts

  src/
    index.ts
    app.ts
    config.ts

    types/
      env.ts
      api.ts
      usage.ts

    routes/
      health.ts
      markdown.ts
      admin.ts
      catchall.ts

    middleware/
      auth.ts
      errors.ts
      request-id.ts
      cors.ts

    auth/
      api-keys.ts
      hash.ts
      admin.ts

    usage/
      quota.ts
      counters.ts
      reservations.ts
      periods.ts

    conversion/
      orchestrator.ts
      native.ts
      ai.ts
      browser.ts
      quality.ts
      result.ts

    cache/
      markdown-cache.ts
      cache-key.ts

    security/
      url.ts
      ssrf.ts
      content-type.ts

    http/
      fetch-with-limits.ts
      responses.ts
      headers.ts

    validation/
      markdown-request.ts
      admin-request.ts

    utils/
      crypto.ts
      dates.ts
      bytes.ts
      json.ts

  test/
    auth.test.ts
    quota.test.ts
    url-security.test.ts
    cache.test.ts
    native-conversion.test.ts
    ai-conversion.test.ts
    browser-conversion.test.ts
    markdown-route.test.ts
    file-lines.test.ts
```

Codex may add more files, but no source file may exceed 300 lines.

## Modular implementation rules

Keep each implementation concern isolated:

```txt
routes/        HTTP route wiring only
middleware/    request lifecycle and shared HTTP middleware
auth/          API key and admin-token logic
usage/         quota, counters, reservations, periods
conversion/    conversion orchestration and strategy implementations
cache/         KV cache keying and storage
security/      URL safety, SSRF checks, content-type classification
http/          response helpers, headers, limited fetch
validation/    request body/query parsing and validation
utils/         tiny reusable helpers only
```

Do not place conversion logic inside route handlers.

Do not place database SQL construction directly inside route files unless it is tiny and specific to that route.

Do not place Cloudflare Browser Run REST logic anywhere except `src/conversion/browser.ts` or a small helper file imported by it.

## File size enforcement

Add script:

```txt
scripts/check-file-lines.ts
```

It should:

```txt
scan src/, test/, scripts/
ignore node_modules, dist, .wrangler, migrations, package-lock.json
fail if any .ts/.tsx file has >300 lines
print offending files
exit 1 on failure
```

Add package scripts:

```json
{
  "scripts": {
    "dev": "wrangler dev",
    "deploy": "wrangler deploy",
    "test": "vitest",
    "typecheck": "tsc --noEmit",
    "check:file-lines": "tsx scripts/check-file-lines.ts",
    "check": "npm run typecheck && npm run test && npm run check:file-lines"
  }
}
```

Codex must run this before considering implementation complete:

```bash
npm run check
```

## Initial project setup requirements

Create the Worker project with:

```txt
TypeScript
Wrangler
Vitest
Hono or a small custom router
/healthz route
standard error middleware
request-id middleware
```

Acceptance criteria:

```txt
npm run typecheck passes.
npm run dev starts Worker.
GET /healthz returns JSON { ok: true }.
No source file >300 lines.
```
