# 08 — Routes, Responses, Errors

## Public routes

Implement:

```txt
GET  /
GET  /healthz
POST /v1/markdown
GET  /v1/markdown?url=...
GET  /https://example.com/page
```

`GET /` should return a simple landing/documentation response.

`GET /healthz` should return:

```json
{ "ok": true }
```

All conversion routes require API-key authentication.

Admin routes require admin token authentication.

## Route behavior

`POST /v1/markdown` reads JSON options.

`GET /v1/markdown?url=...` uses default options and reads the URL from the `url` query parameter.

`GET /https://...` uses default options and treats the entire path and query string as the target URL.

Do not allow `?api_key=` auth on any route.

Add CORS only if needed.

If CORS is added, it should not weaken auth requirements.

## Successful Markdown response

Default response type:

```http
Content-Type: text/markdown; charset=utf-8
```

Every successful conversion response should include:

```http
X-Converting-Request-Id: req_...
X-Converting-Method: native | ai | browser
X-Converting-Cache: HIT | MISS
X-Converting-Source-Url: https://example.com
X-Converting-Source-Content-Type: text/html
X-Converting-Output-Bytes: 12345
```

When available:

```http
X-Markdown-Tokens: 1234
X-Browser-Ms-Used: 1842
X-RateLimit-Remaining-Day: 999
X-RateLimit-Remaining-Month: 24999
```

## JSON response format

For `format=json`, return:

```json
{
  "markdown": "# Example",
  "method": "ai",
  "url": "https://example.com",
  "cached": false,
  "tokens": 1234,
  "browserMsUsed": 0,
  "outputBytes": 12345,
  "warnings": [],
  "requestId": "req_..."
}
```

## Error response format

Use one consistent error format:

```json
{
  "error": {
    "code": "quota_exceeded",
    "message": "Daily Browser Run budget exceeded for this API key.",
    "requestId": "req_..."
  }
}
```

Every error response should include:

```http
Content-Type: application/json; charset=utf-8
X-Converting-Request-Id: req_...
```

## Error codes

Important error codes:

```txt
missing_api_key
invalid_api_key
revoked_api_key
quota_exceeded
browser_not_allowed
image_conversion_not_allowed
invalid_url
blocked_url
unsupported_scheme
source_too_large
output_too_large
conversion_failed
browser_budget_exceeded
global_browser_budget_exceeded
global_image_budget_exceeded
cache_error
cloudflare_api_error
```

## HTTP status mapping

```txt
400 invalid request / invalid URL
401 missing or invalid API key
403 capability not allowed
408 timeout
413 source or output too large
429 quota exceeded
500 internal error
502 Cloudflare conversion API error
504 conversion timeout
```

## Request ID behavior

Every request should get an ID like:

```txt
req_<random>
```

The request ID should be:

```txt
available in context
included in all responses
included in conversion_events
included in logs when logging exists
```

## Conversion event logging

Log one `conversion_events` row per conversion request.

For cache hits:

```txt
method can be cached original method
status should be success
cache_status should be HIT
browser_ms_used should be 0
```

For errors:

```txt
status should be error
status_code should match response
error_code should be set
cache_status should usually be MISS
```

Do not store full raw URLs in `conversion_events` unless intentionally accepted.

Store:

```txt
url_hash
host
```

This reduces sensitive URL logging.
