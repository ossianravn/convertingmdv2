# 05 — Data Model, Quotas, Budgeting

## D1 schema

Create `migrations/0001_init.sql`.

```sql
CREATE TABLE api_keys (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  prefix TEXT NOT NULL,
  key_hash TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'active',

  daily_request_limit INTEGER NOT NULL DEFAULT 1000,
  monthly_request_limit INTEGER NOT NULL DEFAULT 25000,

  allow_browser INTEGER NOT NULL DEFAULT 0,
  auto_browser_fallback INTEGER NOT NULL DEFAULT 0,
  daily_browser_ms_limit INTEGER NOT NULL DEFAULT 0,
  monthly_browser_ms_limit INTEGER NOT NULL DEFAULT 0,

  allow_images INTEGER NOT NULL DEFAULT 0,
  daily_image_limit INTEGER NOT NULL DEFAULT 0,
  monthly_image_limit INTEGER NOT NULL DEFAULT 0,

  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  last_used_at TEXT
);

CREATE INDEX idx_api_keys_hash ON api_keys(key_hash);
CREATE INDEX idx_api_keys_prefix ON api_keys(prefix);

CREATE TABLE usage_counters (
  scope TEXT NOT NULL,
  scope_id TEXT NOT NULL,
  period TEXT NOT NULL,
  period_key TEXT NOT NULL,

  requests INTEGER NOT NULL DEFAULT 0,
  native_requests INTEGER NOT NULL DEFAULT 0,
  ai_requests INTEGER NOT NULL DEFAULT 0,
  browser_requests INTEGER NOT NULL DEFAULT 0,
  image_requests INTEGER NOT NULL DEFAULT 0,

  browser_ms_used INTEGER NOT NULL DEFAULT 0,
  browser_ms_reserved INTEGER NOT NULL DEFAULT 0,

  bytes_in INTEGER NOT NULL DEFAULT 0,
  bytes_out INTEGER NOT NULL DEFAULT 0,

  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,

  PRIMARY KEY (scope, scope_id, period, period_key)
);

CREATE TABLE conversion_events (
  id TEXT PRIMARY KEY,
  api_key_id TEXT,
  request_id TEXT NOT NULL,
  url_hash TEXT NOT NULL,
  host TEXT NOT NULL,
  method TEXT,
  status TEXT NOT NULL,
  status_code INTEGER NOT NULL,
  cache_status TEXT NOT NULL,
  source_content_type TEXT,
  input_bytes INTEGER NOT NULL DEFAULT 0,
  output_bytes INTEGER NOT NULL DEFAULT 0,
  browser_ms_used INTEGER NOT NULL DEFAULT 0,
  error_code TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX idx_conversion_events_key_time
  ON conversion_events(api_key_id, created_at);

CREATE INDEX idx_conversion_events_host_time
  ON conversion_events(host, created_at);
```

Use `scope='key'` and `scope_id=<api_key_id>` for per-key usage.

Use `scope='global'` and `scope_id='all'` for global usage.

Use period keys like:

```txt
day:   2026-05-19
month: 2026-05
```

## Request quota behavior

Before conversion:

```txt
1. Authenticate API key.
2. Ensure key is active.
3. Check daily and monthly request limits.
4. Increment request counters for key and global scope.
5. Continue only if limits are not exceeded.
```

Cache hits should still count as requests.

Cache hits should not count as native, AI, browser, or image conversions.

## Browser Run quota behavior

Before calling Browser Run:

```txt
1. Confirm DISABLE_BROWSER=false.
2. Confirm API key allow_browser=true for explicit browser mode, or auto_browser_fallback=true for automatic fallback.
3. Confirm request mode/browser settings allow browser when the request explicitly asks for browser mode.
4. Confirm key browser-ms budget has room.
5. Confirm global browser-ms budget has room.
6. Reserve MAX_BROWSER_MS_PER_REQUEST against key and global counters.
7. Call Browser Run.
8. Read X-Browser-Ms-Used.
9. Release unused reservation.
10. Add actual browser ms used.
11. Increment browser_requests.
```

Use reservation to prevent multiple concurrent requests from overspending the same budget.

Pseudo-algorithm:

```txt
reservedMs = MAX_BROWSER_MS_PER_REQUEST

tryReserveBrowserMs(keyId, reservedMs)
tryReserveBrowserMs(global, reservedMs)

try:
  result = callBrowserRun()
  actualMs = result.browserMsUsed || reservedMs
  commitBrowserUsage(keyId, reservedMs, actualMs)
  commitBrowserUsage(global, reservedMs, actualMs)
catch:
  releaseBrowserReservation(keyId, reservedMs)
  releaseBrowserReservation(global, reservedMs)
  throw
```

If the actual header is missing, assume the full reserved amount was used.

## Image conversion quota behavior

Image conversion is disabled by default.

Treat the request as image conversion when:

```txt
target content-type starts with image/
target URL extension is .jpg, .jpeg, .png, .webp, .svg, .gif
request explicitly asks for AI image description
```

Before image conversion:

```txt
1. Confirm DISABLE_IMAGE_CONVERSION=false.
2. Confirm key allow_images=true.
3. Check daily/monthly image limits.
4. Check global daily/monthly image limits.
5. Increment image counters before conversion.
```

For HTML pages with linked images:

```txt
Do not fetch linked images for AI description in v1.
Browser mode should block image asset requests by default.
```

## Counter implementation notes

Implement files:

```txt
src/usage/periods.ts
src/usage/counters.ts
src/usage/quota.ts
src/usage/reservations.ts
```

Counter functions should be small and focused:

```txt
getPeriodKeys(now)
ensureCounterRow(scope, scopeId, period, periodKey)
incrementRequests(apiKeyId)
checkRequestQuota(apiKey)
tryReserveBrowserMs(apiKeyId, reservedMs)
commitBrowserUsage(apiKeyId, reservedMs, actualMs)
releaseBrowserReservation(apiKeyId, reservedMs)
incrementImageUsage(apiKeyId)
```

Quota failures should return `429` unless the key lacks capability, in which case return `403`.
