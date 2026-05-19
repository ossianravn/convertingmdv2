# 09C — Implementation Phases 9–12
## Phase 9 — Browser Run conversion

Tasks:

```txt
Implement Browser Run REST client.
Require browser capability.
Require browser-ms reservation.
Send Cloudflare API token.
Use /browser-rendering/markdown.
Default waitUntil=domcontentloaded.
Default blockAssets=true.
Read X-Browser-Ms-Used.
Commit actual browser usage.
Release reservation on failure.
```

Acceptance criteria:

```txt
mode=browser fails for key without browser permission.
mode=browser succeeds with mocked Browser Run response.
X-Browser-Ms-Used is stored.
Missing X-Browser-Ms-Used charges reserved max.
DISABLE_BROWSER=true prevents browser calls.
```

## Phase 10 — Conversion orchestrator

Tasks:

```txt
Implement auto/native/ai/browser mode flow.
Add quality check for AI output.
Add browser fallback only when explicitly allowed.
Wire cache into orchestrator.
Wire usage counters into orchestrator.
```

Acceptance criteria:

```txt
mode=native only tries native.
mode=ai only tries AI.
mode=browser only tries browser.
mode=auto tries native then AI.
mode=auto does not use browser unless request and key allow it.
Failed native can fall back to AI.
Failed/weak AI can fall back to browser only when allowed.
```

## Phase 11 — Public routes

Tasks:

```txt
Implement POST /v1/markdown.
Implement GET /v1/markdown?url=.
Implement catchall GET /https://...
Implement landing page GET /.
Add CORS only if needed.
```

Acceptance criteria:

```txt
POST /v1/markdown works.
GET /v1/markdown works.
GET /https://example.com works with auth header.
GET / returns simple docs.
All conversion routes require API key.
```

## Phase 12 — Final hardening

Tasks:

```txt
Add README with setup instructions.
Add deployment steps.
Add all tests.
Add file-line check.
Run npm run check.
Fix any files over 300 lines.
Review secrets are not committed.
```

Acceptance criteria:

```txt
npm run check passes.
No source file over 300 lines.
README explains local dev, D1 migration, KV setup, secrets, deploy.
```
