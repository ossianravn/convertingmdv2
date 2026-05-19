# 11 — README, Operations, Defaults

## README requirements

The README should include:

```txt
What converting.md does
Why API keys are required
Setup instructions
Cloudflare resources to create
Wrangler commands
How to create an API key
How to call the API
Quota behavior
Browser/image conversion warnings
Deployment instructions
Testing instructions
```

## Example Markdown API usage

```bash
curl \
  -H "Authorization: Bearer cmd_live_xxx" \
  "https://converting.md/v1/markdown?url=https%3A%2F%2Fexample.com"
```

## Example JSON API usage

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

## Example convenience endpoint usage

```bash
curl \
  -H "Authorization: Bearer cmd_live_xxx" \
  "https://converting.md/https://example.com/page"
```

## Suggested personal API key limits

For the owner’s personal key:

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

That gives:

```txt
1,000 requests/day
25,000 requests/month
10 browser minutes/day
1 browser hour/month
no image conversion
browser only when explicitly requested
```

## Suggested safe test key limits

For a safe test key:

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

## Operational defaults

Recommended production defaults:

```txt
REQUIRE_AUTH=true
ALLOW_ANON=false
DISABLE_BROWSER=false
DISABLE_IMAGE_CONVERSION=true
DEFAULT_CACHE_TTL_SECONDS=86400
MAX_SOURCE_BYTES=2097152
MAX_OUTPUT_BYTES=2097152
MAX_BROWSER_MS_PER_REQUEST=10000
GLOBAL_DAILY_BROWSER_MS_LIMIT=600000
GLOBAL_MONTHLY_BROWSER_MS_LIMIT=36000000
GLOBAL_DAILY_IMAGE_LIMIT=50
GLOBAL_MONTHLY_IMAGE_LIMIT=500
```

## Browser and image warnings

README must explain:

```txt
Browser Run can create usage costs.
Browser Run is disabled per key unless explicitly allowed.
Auto browser fallback is disabled by default.
Image conversion is disabled globally by default.
Image conversion requires both global enablement and per-key allow_images=true.
HTML pages should not fetch linked images for AI description in v1.
Browser mode blocks image/font/media assets by default.
```

## Create API key flow

The README should show how to create a key with admin token:

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

The response returns the raw key once.

The README should warn users to store the key securely.

## Troubleshooting notes

Include notes for common problems:

```txt
401 missing_api_key: add Authorization: Bearer cmd_live_xxx
401 invalid_api_key: key is wrong or hash pepper changed
403 revoked_api_key: key is inactive/revoked
403 browser_not_allowed: key lacks browser permission
403 image_conversion_not_allowed: image conversion disabled or key lacks permission
429 quota_exceeded: daily/monthly request limit reached
429 browser_budget_exceeded: browser-ms budget reached
413 source_too_large: source exceeded MAX_SOURCE_BYTES
413 output_too_large: Markdown exceeded MAX_OUTPUT_BYTES
502 cloudflare_api_error: Workers AI or Browser Run API error
```

## Future features not in v1

The README can mention future possibilities, but must label them as not included in v1:

```txt
file uploads
PDF uploads
multi-page crawling
sitemap ingestion
billing/dashboard
OAuth/user accounts
RAG chunking
embeddings
structured extraction
```
