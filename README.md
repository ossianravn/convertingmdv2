# converting.md

`converting.md` is a Cloudflare Worker API that accepts a URL and returns clean Markdown. The v1 API is private by default: every conversion route requires an API key so Workers AI, Browser Run, and image conversion cannot be triggered anonymously.

## Current Implementation

This repository implements the v1 Worker foundation:

- Cloudflare Worker entrypoint with Hono routing
- `/healthz`, admin, markdown, and convenience route wiring
- typed config parsing and standard JSON error responses
- D1 migration for API keys, usage counters, and conversion events
- API-key hashing helpers that store hashes only
- URL security, limited fetch, cache, conversion, and quota modules split by responsibility
- native Markdown, Workers AI, and Browser Run conversion strategies
- request quotas, Browser Run browser-ms reservations, and image-conversion quota gates
- Markdown result cache with cache-hit short-circuiting
- conversion event logging that stores URL hashes and hostnames, not raw target URLs
- file-line enforcement for TypeScript files

Conversion routes authenticate first, charge request quota, check cache, then use the selected conversion mode. Browser Run and image conversion remain fail-closed behind global config and per-key capability checks.

## Local Setup

```bash
npm install
cp .dev.vars.example .dev.vars
npm run db:migrate:local
npm run dev
```

Fill `.dev.vars` with local test values:

```txt
ADMIN_TOKEN=replace_me
API_KEY_PEPPER=replace_me
CLOUDFLARE_ACCOUNT_ID=replace_me
CLOUDFLARE_BROWSER_API_TOKEN=replace_me
```

Health check:

```bash
curl http://127.0.0.1:8787/healthz
```

Expected response:

```json
{ "ok": true }
```

Create a local test key through the running Worker:

```bash
curl \
  -X POST "http://127.0.0.1:8787/v1/admin/api-keys" \
  -H "Authorization: Bearer replace_me" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Local test key",
    "dailyRequestLimit": 50,
    "monthlyRequestLimit": 500
  }'
```

Use the returned `apiKey` for local conversion calls:

```bash
curl \
  -H "Authorization: Bearer cmd_live_xxx" \
  "http://127.0.0.1:8787/v1/markdown?url=https%3A%2F%2Fexample.com"
```

For offline local seed workflows, `API_KEY_PEPPER=replace_me npm run create-local-key` prints a raw test key and D1-ready hash.

## API Usage

Markdown response:

```bash
curl \
  -H "Authorization: Bearer cmd_live_xxx" \
  "https://converting.md/v1/markdown?url=https%3A%2F%2Fexample.com"
```

JSON response:

```bash
curl \
  -X POST "https://converting.md/v1/markdown" \
  -H "Authorization: Bearer cmd_live_xxx" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://example.com",
    "mode": "auto",
    "format": "json"
  }'
```

Convenience endpoint:

```bash
curl \
  -H "Authorization: Bearer cmd_live_xxx" \
  "https://converting.md/https://example.com/page"
```

Prefer `Authorization: Bearer`; `X-API-Key` is accepted. Do not pass API keys in query strings.

Supported modes:

```txt
auto     native first, then Workers AI, with Browser Run only when explicitly allowed
native   Accept: text/markdown strategy only
ai       Workers AI toMarkdown strategy only
browser  Browser Run /markdown strategy only
```

Successful conversion responses include:

```txt
X-Converting-Request-Id
X-Converting-Method
X-Converting-Cache
X-Converting-Source-Url
X-Converting-Source-Content-Type
X-Converting-Output-Bytes
X-RateLimit-Remaining-Day
X-RateLimit-Remaining-Month
X-Markdown-Tokens
X-Browser-Ms-Used
```

## Admin Key Creation

```bash
curl \
  -X POST "https://converting.md/v1/admin/api-keys" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Personal key",
    "status": "active",
    "dailyRequestLimit": 1000,
    "monthlyRequestLimit": 25000,
    "allowBrowser": true,
    "autoBrowserFallback": false,
    "dailyBrowserMsLimit": 600000,
    "monthlyBrowserMsLimit": 3600000,
    "allowImages": false,
    "dailyImageLimit": 0,
    "monthlyImageLimit": 0
  }'
```

The raw API key is returned only once in the create response. Store it securely.

Revoke, reactivate, or edit key limits with `PATCH /v1/admin/api-keys/:id` using the same admin bearer token.

Admin usage summary:

```bash
curl \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  "https://converting.md/v1/admin/usage"
```

## Cloudflare Resources

Create D1:

```bash
wrangler d1 create converting_md
```

Create KV:

```bash
wrangler kv namespace create CACHE_KV
```

Update `wrangler.jsonc` with generated IDs, then apply the migration:

```bash
npm run db:migrate
```

Set secrets:

```bash
wrangler secret put ADMIN_TOKEN
wrangler secret put API_KEY_PEPPER
wrangler secret put CLOUDFLARE_ACCOUNT_ID
wrangler secret put CLOUDFLARE_BROWSER_API_TOKEN
```

Deploy:

```bash
wrangler deploy
```

Check the deploy bundle without publishing:

```bash
npm run deploy:dry-run
```

Check real-deploy readiness:

```bash
npm run deploy:preflight
```

Route `converting.md/*` to the Worker in Cloudflare.

## Safety Defaults

- `REQUIRE_AUTH=true`
- `ALLOW_ANON=false`
- `DISABLE_IMAGE_CONVERSION=true`
- Browser Run is disabled per key unless explicitly allowed.
- Auto browser fallback is disabled by default.
- Browser mode blocks image, font, and media assets by default.
- HTML pages should not fetch linked images for AI description in v1.

## Production Checklist

- `REQUIRE_AUTH=true`
- `ALLOW_ANON=false`
- `DISABLE_IMAGE_CONVERSION=true` unless intentionally enabled
- personal and test keys have conservative limits
- Browser Run is enabled only for trusted keys
- `ADMIN_TOKEN` and `API_KEY_PEPPER` are strong random secrets
- D1 migration is applied and KV is bound
- `npm run verify:release` passes before deploy

## Suggested Limits

Owner key:

```txt
dailyRequestLimit: 1000
monthlyRequestLimit: 25000
allowBrowser: true
autoBrowserFallback: false
dailyBrowserMsLimit: 600000
monthlyBrowserMsLimit: 3600000
allowImages: false
dailyImageLimit: 0
monthlyImageLimit: 0
```

Safe test key:

```txt
dailyRequestLimit: 50
monthlyRequestLimit: 500
allowBrowser: false
autoBrowserFallback: false
dailyBrowserMsLimit: 0
monthlyBrowserMsLimit: 0
allowImages: false
dailyImageLimit: 0
monthlyImageLimit: 0
```

## Troubleshooting

- `401 missing_api_key`: add `Authorization: Bearer cmd_live_xxx`
- `401 invalid_api_key`: key is wrong or the hash pepper changed
- `403 revoked_api_key`: key is inactive or revoked
- `403 browser_not_allowed`: key lacks browser permission
- `403 image_conversion_not_allowed`: image conversion is disabled or the key lacks permission
- `429 quota_exceeded`: daily or monthly request limit reached
- `429 browser_budget_exceeded`: Browser Run budget reached
- `413 source_too_large`: source exceeded `MAX_SOURCE_BYTES`
- `413 output_too_large`: Markdown exceeded `MAX_OUTPUT_BYTES`
- `502 cloudflare_api_error`: Workers AI or Browser Run returned an API error

## Verification

```bash
npm run verify:release
```

The release gate runs TypeScript, Vitest, the file-line guard, env hygiene, PRD-doc integrity, npm audit, Wrangler deploy dry-run, and a local `/healthz` smoke.

## Future Features Not In V1

- file uploads
- PDF uploads
- multi-page crawling
- sitemap ingestion
- billing dashboard
- OAuth or user accounts
- embeddings or vector storage
- structured extraction
