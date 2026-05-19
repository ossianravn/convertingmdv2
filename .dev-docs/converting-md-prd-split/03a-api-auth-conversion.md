# 03A — API Auth and Conversion Endpoints
## Authentication requirement

All conversion endpoints require API-key authentication.

Allowed auth headers:

```http
Authorization: Bearer cmd_live_...
```

or:

```http
X-API-Key: cmd_live_...
```

Prefer `Authorization: Bearer`.

Do not support `?api_key=` in v1 because query-string keys leak into logs, browser history, and analytics.

## API key format

API keys should have this format:

```txt
cmd_live_<base64url-random>
cmd_test_<base64url-random>
```

Store only:

```txt
key id
name
prefix
sha256/hmac hash
status
quota fields
capability fields
created_at
last_used_at
```

Raw keys are returned only once when created.

Do not store raw API keys in D1, KV, logs, tests, or comments.

## POST /v1/markdown

Request:

```json
{
  "url": "https://example.com/article",
  "mode": "auto",
  "format": "markdown",
  "cache": {
    "read": true,
    "write": true,
    "ttlSeconds": 86400
  },
  "ai": {
    "cssSelector": "main",
    "allowImages": false,
    "imageDescriptionLanguage": "en"
  },
  "browser": {
    "enabled": false,
    "waitUntil": "domcontentloaded",
    "waitForSelector": null,
    "userAgent": null,
    "blockAssets": true
  }
}
```

Allowed `mode` values:

```txt
auto
native
ai
browser
```

Allowed `format` values:

```txt
markdown
json
```

Default behavior:

```txt
mode: auto
format: markdown
cache.read: true
cache.write: true
browser.enabled: false
ai.allowImages: false
browser.blockAssets: true
```

Important behavior:

```txt
mode=auto may try native and AI.
mode=auto may only fall back to browser if:
  - browser.enabled=true in request
  - the API key allows browser
  - the API key allows automatic browser fallback
  - global browser kill switch is off
  - per-key and global browser-ms budgets allow it
```

## GET /v1/markdown?url=...

Equivalent to `POST /v1/markdown` with default options.

Example:

```bash
curl \
  -H "Authorization: Bearer cmd_live_xxx" \
  "https://converting.md/v1/markdown?url=https%3A%2F%2Fexample.com"
```

For target URLs that contain their own query strings, the target URL must be URL-encoded inside the `url` parameter.

## GET /https://example.com/page

Convenience endpoint inspired by `markdown.new`.

Example:

```bash
curl \
  -H "Authorization: Bearer cmd_live_xxx" \
  "https://converting.md/https://example.com/page"
```

Rules:

```txt
This route only supports default options.
It requires Authorization header auth.
It treats the entire path after the first slash as the target URL.
If a query string exists, it belongs to the target URL, not to converting.md options.
```

Example:

```txt
https://converting.md/https://example.com/page?x=1
```

means:

```txt
target URL = https://example.com/page?x=1
```

not:

```txt
converting.md option x=1
```
