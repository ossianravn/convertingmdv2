# 06B — KV Cache Behavior
## Cache namespace

Use KV namespace:

```txt
CACHE_KV
```

Cache key format:

```txt
md:v1:<sha256(normalizedUrl + mode + relevantOptions)>
```

Relevant options:

```txt
url
mode
cssSelector
browser waitUntil
browser waitForSelector
browser blockAssets
userAgent
image settings
output format version
```

## Cache behavior

Cache only successful conversions.

Default TTL:

```txt
24 hours
```

Suggested TTLs:

```txt
200 OK success: 24h
404 source: 10m
5xx source: do not cache in v1
conversion error: do not cache in v1
```

Do not cache outputs larger than `MAX_OUTPUT_BYTES`.

On cache hit:

```txt
return cached markdown
set X-Converting-Cache: HIT
do not call native/AI/browser
do not increment conversion-specific counters
```

Cache hits still count as requests.

## Cache metadata object

Store enough metadata to reconstruct headers and JSON responses:

```json
{
  "markdown": "# Example",
  "method": "ai",
  "url": "https://example.com",
  "sourceContentType": "text/html",
  "tokens": 1234,
  "browserMsUsed": 0,
  "inputBytes": 12345,
  "outputBytes": 6789,
  "createdAt": "2026-05-19T12:00:00.000Z"
}
```
