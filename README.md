# converting.md

Turn a web page into Markdown from the address bar:

```txt
https://converting.md/https://example.com/page
```

The hosted `converting.md` deployment is configured for this public convenience
route. It returns normalized Markdown with decoded HTML entities and stable
Unicode text, so clients do not need to clean up values like `p&#xE5;`.

This repository contains the Cloudflare Worker that powers the service. It can
also be self-hosted in private API-key mode for teams, products, or higher-risk
workloads.

## Address-Bar Usage

Open a page by prefixing its full URL with `https://converting.md/`:

```txt
https://converting.md/https://www.edc.dk/nyhedsartikler/flere-lejligheder-til-salg-i-koebenhavn/
```

That convenience route uses default non-browser conversion options. It is meant
for quick page-to-Markdown conversion and does not accept API keys in query
strings.

For private deployments, browser address-bar usage only works if anonymous
conversion is enabled:

```txt
REQUIRE_AUTH=false
ALLOW_ANON=true
```

When anonymous conversion is enabled, requests are tracked as `anon_public`.
Browser Run and image conversion still remain blocked for anonymous traffic.

## What It Does

- accepts a URL and returns Markdown
- supports native Markdown, Workers AI toMarkdown, and guarded Browser Run modes
- caches successful Markdown output in Cloudflare KV
- stores API keys as hashes only
- tracks quotas and conversion events in Cloudflare D1
- blocks unsafe URLs, redirects, oversized sources, and oversized output
- normalizes Markdown output across fresh and cached conversions
- keeps image conversion disabled by default

The Worker is intentionally fail-closed. If auth, config, quota, URL safety, or
conversion capability is unclear, the request is rejected before paid conversion
services are called.

## API Usage

Use API-key mode when you do not want public anonymous conversion:

```txt
REQUIRE_AUTH=true
ALLOW_ANON=false
```

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

Convenience endpoint with headers:

```bash
curl \
  -H "Authorization: Bearer cmd_live_xxx" \
  "https://converting.md/https://example.com/page"
```

Prefer `Authorization: Bearer`. `X-API-Key` is also accepted. Query-string API
keys are rejected.

Supported modes:

```txt
auto     native first, then Workers AI, with Browser Run only when explicitly allowed
native   Accept: text/markdown strategy only
ai       Workers AI toMarkdown strategy only
browser  Browser Run /markdown strategy only
```

In `mode=auto`, weak AI output from JavaScript app shells, metadata-only pages,
or boilerplate-only pages can fall back to Browser Run only when:

- the request explicitly sends `browser.enabled=true`
- the API key has `allowBrowser=true`
- the API key has `autoBrowserFallback=true`
- Browser Run is globally enabled
- browser-ms reservation and quota checks pass

Successful responses include request, cache, method, source, output-byte, quota,
token, browser-ms, and warning headers where applicable.

## Local Development

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

Use the returned `apiKey`:

```bash
curl \
  -H "Authorization: Bearer cmd_live_xxx" \
  "http://127.0.0.1:8787/v1/markdown?url=https%3A%2F%2Fexample.com"
```

For offline local seed workflows, run
`API_KEY_PEPPER=replace_me npm run create-local-key`.

## Admin Keys

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

The raw API key is returned once. Store it securely.

Revoke, reactivate, or edit key limits with:

```txt
PATCH /v1/admin/api-keys/:id
```

Admin usage summary:

```bash
curl \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  "https://converting.md/v1/admin/usage"
```

## Cloudflare Setup

For a step-by-step production setup walkthrough, see
[CLOUDFLARE_SETUP.md](./CLOUDFLARE_SETUP.md).

Create D1 and KV:

```bash
wrangler d1 create converting_md
wrangler kv namespace create CACHE_KV
```

Update `wrangler.jsonc` with the generated IDs, then apply migrations:

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
npm run deploy
```

Route `converting.md/*` to the Worker in Cloudflare.

Dokploy/Nixpacks deploy runners should use:

```bash
NIXPACKS_INSTALL_CMD=npm run install:deploy-runner
```

## Production Checklist

- choose public address-bar mode or private API-key mode explicitly
- keep `DISABLE_IMAGE_CONVERSION=true` unless intentionally enabling images
- enable Browser Run only for trusted keys
- use strong `ADMIN_TOKEN` and `API_KEY_PEPPER` secrets
- keep personal and test keys on conservative limits
- apply the D1 migration and bind KV before deploy
- run `npm run verify:release` before deploy

Suggested limits:

| Key | Requests | Browser | Images |
|---|---:|---:|---:|
| Owner | 1,000/day, 25,000/month | allowed, 600,000 ms/day, 3,600,000 ms/month, no auto fallback | disabled |
| Test | 50/day, 500/month | disabled | disabled |

## Verification

```bash
npm run check
npm run verify:release
npm run deploy:preflight
```

The release gate runs TypeScript, Vitest, the file-line guard, env hygiene,
split-PRD integrity, npm audit, Wrangler deploy dry-run, and a local `/healthz`
smoke.

## Troubleshooting

- `401 missing_api_key`: add `Authorization: Bearer cmd_live_xxx`
- `401 invalid_api_key`: key is wrong or the hash pepper changed
- `403 revoked_api_key`: key is inactive or revoked
- `403 browser_not_allowed`: key lacks browser permission
- `403 image_conversion_not_allowed`: image conversion is disabled or disallowed
- `429 quota_exceeded`: daily or monthly request limit reached
- `429 browser_budget_exceeded`: Browser Run budget reached
- `413 source_too_large`: source exceeded `MAX_SOURCE_BYTES`
- `413 output_too_large`: Markdown exceeded `MAX_OUTPUT_BYTES`
- `502 cloudflare_api_error`: Workers AI or Browser Run returned an API error

## Open Source Notes

This project is released under the MIT License. It is a Worker application, not
an npm library; `private: true` prevents accidental npm publishing.

Future features not included in v1: file uploads, PDF uploads, multi-page
crawling, sitemap ingestion, billing, OAuth/user accounts, embeddings/vector
storage, and structured extraction.
