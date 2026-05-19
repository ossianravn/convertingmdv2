# Converting.md PRD Index

This folder is the source of truth for the `converting.md` v1 implementation.

Codex must read this file first, then read the files relevant to the task it is performing. Do not rely on heuristics or inferred behavior when a detail is specified in one of these files.

Every Markdown file in this PRD pack is intentionally kept under 220 lines so Codex can read focused sections without skipping details.

## File map

| File | Purpose |
|---|---|
| `01-overview-goals-nongoals.md` | Product summary, goals, non-goals, and hard implementation rules. |
| `02a-architecture-cloudflare.md` | Recommended architecture and Cloudflare resources. |
| `02b-repo-standards.md` | Repo structure, modularity rules, file-size enforcement, and initial setup requirements. |
| `03a-api-auth-conversion.md` | API-key authentication and conversion endpoints. |
| `03b-admin-endpoints.md` | Admin authentication, admin key-management endpoints, and admin acceptance criteria. |
| `04-cloudflare-config-deployment.md` | Wrangler config, environment variables, secrets, Cloudflare bindings, and deployment steps. |
| `05-data-model-quotas-budgeting.md` | D1 schema, quota counters, Browser Run reservations, and image-conversion budget rules. |
| `06a-url-security.md` | URL normalization, SSRF protection, redirect handling, content-type safety, and limited fetch. |
| `06b-cache.md` | KV namespace, cache key design, cache TTLs, cache hit behavior, and cache metadata. |
| `07a-orchestrator-native-ai.md` | Conversion orchestrator, mode behavior, native Markdown strategy, and Workers AI strategy. |
| `07b-browser-quality.md` | Browser Run strategy, asset blocking, browser-budget expectations, and quality checks. |
| `08-routes-responses-errors.md` | Route behavior, response headers, JSON response format, error format, and HTTP status mapping. |
| `09a-phases-1-4.md` | Implementation phases 1–4: setup, config/errors, auth/admin, quotas. |
| `09b-phases-5-8.md` | Implementation phases 5–8: URL security, cache, native conversion, Workers AI. |
| `09c-phases-9-12.md` | Implementation phases 9–12: Browser Run, orchestrator, public routes, hardening. |
| `10-testing-acceptance.md` | Test requirements, mocks, completion definition, and final quality gates. |
| `11-readme-ops-defaults.md` | README requirements, example API calls, suggested default key limits, and operational notes. |

## Required reading order for full implementation

```txt
00-index.md
01-overview-goals-nongoals.md
02a-architecture-cloudflare.md
02b-repo-standards.md
03a-api-auth-conversion.md
03b-admin-endpoints.md
04-cloudflare-config-deployment.md
05-data-model-quotas-budgeting.md
06a-url-security.md
06b-cache.md
07a-orchestrator-native-ai.md
07b-browser-quality.md
08-routes-responses-errors.md
09a-phases-1-4.md
09b-phases-5-8.md
09c-phases-9-12.md
10-testing-acceptance.md
11-readme-ops-defaults.md
```

## Required reading for focused changes

```txt
Auth/API-key work:        03a, 03b, 05, 08, 10
Quota/budget work:        05, 08, 10
URL security work:        06a, 10
Cache work:               06b, 07a, 10
Native conversion work:   07a, 06a, 10
Workers AI work:          07a, 05, 06a, 10
Browser Run work:         07b, 05, 06a, 10
Routing/API work:         03a, 03b, 08, 10
Deployment/docs work:     04, 11
Implementation planning:  09a, 09b, 09c
```

## Critical cross-file rules

These rules apply globally, even when the task is scoped to one file:

1. Every source file must stay under 300 lines.
2. Prefer every source file under 250 lines.
3. Every PRD Markdown file in this folder should stay under 220 lines.
4. All conversion endpoints require API-key authentication.
5. Raw API keys must never be stored.
6. Browser Run must never be called before auth, quota checks, and browser-ms reservation.
7. Image conversion must be disabled by default.
8. Tests must mock Cloudflare Workers AI and Browser Run calls.
9. The v1 product must fail closed.

## External documentation references

Use these Cloudflare docs as implementation references when needed:

```txt
Markdown for Agents:
https://developers.cloudflare.com/fundamentals/reference/markdown-for-agents/

Workers AI Markdown conversion:
https://developers.cloudflare.com/workers-ai/features/markdown-conversion/

Workers AI toMarkdown binding usage:
https://developers.cloudflare.com/workers-ai/features/markdown-conversion/usage/binding/

Workers AI toMarkdown REST API usage:
https://developers.cloudflare.com/workers-ai/features/markdown-conversion/usage/rest-api/

Browser Run Markdown endpoint:
https://developers.cloudflare.com/browser-run/quick-actions/markdown-endpoint/

Browser Run pricing:
https://developers.cloudflare.com/browser-run/pricing/

Workers pricing:
https://developers.cloudflare.com/workers/platform/pricing/
```

## Product principle

The most important v1 principle is: **fail closed**.

When unsure whether a request is allowed, whether a URL is safe, whether image conversion is happening, or whether browser budget remains, reject the request before calling Cloudflare conversion services.
