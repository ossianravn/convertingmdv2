# Acceptance Matrix

Date: 2026-05-19

This matrix maps the split PRD acceptance buckets to the local implementation and verification evidence. It is intentionally compact; detailed operational steps live in `README.md` and `RELEASE_READINESS.md`.

## Auth and Admin

Evidence:

- Implementation: `src/auth/*`, `src/middleware/auth.ts`, `src/routes/admin.ts`.
- Tests: `test/auth-admin.test.ts`, `test/markdown-route.test.ts`.

Covered criteria:

- API keys are HMAC-hashed and raw keys are returned only once at creation.
- Local key helper emits `cmd_test_` keys with D1-ready HMAC hashes for offline seed workflows.
- `Authorization: Bearer` and `X-API-Key` auth are covered; missing, invalid, revoked, and query-string API keys are rejected globally.
- Explicit anonymous mode uses `REQUIRE_AUTH=false` and `ALLOW_ANON=true`, tracks traffic as `anon_public`, and keeps Browser Run disabled for anonymous requests.
- Admin routes require `Authorization: Bearer <ADMIN_TOKEN>` and reject API keys or query-string admin tokens.
- Admin key create/list/patch and safe usage summary routes are covered.

## Quotas and Budgeting

Evidence:

- Implementation: `src/usage/*`, `src/routes/markdown.ts`, `src/conversion/browser.ts`, `src/conversion/ai.ts`.
- Tests: `test/quota.test.ts`, `test/browser-budget.test.ts`, `test/image-quota.test.ts`, `test/route-modes.test.ts`.

Covered criteria:

- Per-key daily/monthly request quotas and global request counters work.
- Cache hits count as requests but not native/AI/browser/image conversions.
- Browser Run permission, per-key budget, global budget, reservation commit, and release behavior are covered.
- Image conversion is disabled by default and gated by global and per-key limits.

## URL Security and Fetch Limits

Evidence:

- Implementation: `src/security/*`, `src/http/fetch-with-limits.ts`.
- Tests: `test/url-security.test.ts`, `test/fetch-limits.test.ts`.

Covered criteria:

- URL normalization strips fragments and default ports.
- Unsupported schemes, credentials, local/private hosts, and invalid ports are rejected.
- Redirects are validated, blocked redirects are rejected, redirect depth is bounded, and source byte limits are enforced.

## Cache

Evidence:

- Implementation: `src/cache/*`, `src/conversion/orchestrator.ts`.
- Tests: `test/cache.test.ts`, `test/orchestrator.test.ts`, `test/route-acceptance.test.ts`.

Covered criteria:

- Same URL/options can hit cache on the second request.
- Different conversion options create different cache keys.
- Cache hits avoid conversion/fetch calls and reconstruct response headers.
- Oversized output is not cached.

## Conversion Strategies

Evidence:

- Implementation: `src/conversion/native.ts`, `src/conversion/ai.ts`, `src/conversion/browser.ts`, `src/conversion/orchestrator.ts`.
- Tests: `test/conversion-edge.test.ts`, `test/browser-budget.test.ts`, `test/image-quota.test.ts`, `test/orchestrator.test.ts`, `test/route-modes.test.ts`.

Covered criteria:

- Native Markdown captures `x-markdown-tokens`, rejects HTML fallback cases, and enforces output byte limits.
- Workers AI receives HTML hostname and `cssSelector` options, blocks images by default, and exposes token counts when returned.
- Browser Run requires explicit key permission, sends the expected Cloudflare REST body with wait options and asset blocking, records `X-Browser-Ms-Used`, charges reserved max when usage is missing, respects `DISABLE_BROWSER`, and releases reservations on failure.
- Auto mode performs native-to-AI fallback and only uses Browser Run fallback when request, key, and config allow it.

## Routes, Responses, and Events

Evidence:

- Implementation: `src/routes/*`, `src/http/responses.ts`, `src/usage/events.ts`, `src/usage/admin-report.ts`.
- Tests: `test/markdown-route.test.ts`, `test/route-acceptance.test.ts`, `test/auth-admin.test.ts`.

Covered criteria:

- `POST /v1/markdown`, `GET /v1/markdown?url=`, and `GET /https://example.com` are covered.
- Missing auth is rejected on conversion routes.
- Markdown and JSON formats are covered.
- Response metadata covers request ID, method, cache, source URL/content type, output bytes, and rate-limit headers.
- Standard error shape, JSON content type, and request ID headers/body fields are covered.
- Conversion events record request IDs, status, cache status, URL hashes, and hosts without raw target URLs.

## File Limits, CI, and Release Gate

Evidence:

- Implementation: `scripts/check-file-lines.ts`, `scripts/check-env-hygiene.ts`, `scripts/check-prd-docs.ts`, `scripts/check-deploy-config.ts`, `scripts/smoke-health.ts`, `.github/workflows/check.yml`.
- Tests: `test/file-lines.test.ts`, `test/env-hygiene.test.ts`, `test/prd-docs.test.ts`, `test/deploy-preflight.test.ts`.
- Commands: `npm run verify:release`, `npm --cache /tmp/npm-cache ci --ignore-scripts`.

Covered criteria:

- File-line guard passes and is itself tested against oversized and normal fixtures.
- Env hygiene guard verifies required `.dev.vars.example` placeholders and local env ignore rules.
- PRD-doc guard verifies split PRD manifest metadata and line budgets.
- `verify:release` runs typecheck, Vitest, file-line guard, env hygiene, PRD-doc integrity, npm audit, Wrangler deploy dry-run, and local `/healthz` smoke.
- Real `npm run deploy` is guarded by a preflight that rejects placeholder D1/KV IDs and unsafe production vars before publishing.
- GitHub Actions mirrors the clean install path and release gate without publishing or requiring secrets.

## External Completion Items

Remaining external-only work:

- Replace placeholder D1/KV IDs in `wrangler.jsonc`.
- Set production secrets.
- Apply production D1 migration.
- Perform real Cloudflare deploy and domain routing.
- Commit/push through a usable git repository.
