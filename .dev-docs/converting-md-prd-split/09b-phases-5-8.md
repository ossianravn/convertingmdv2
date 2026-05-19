# 09B — Implementation Phases 5–8
## Phase 5 — URL validation and SSRF controls

Tasks:

```txt
Implement URL parser/normalizer.
Reject unsupported schemes.
Reject credentials in URLs.
Reject localhost/private IP literals.
Reject suspicious local hostnames.
Implement redirect validation helper.
Implement max redirect count.
```

Acceptance criteria:

```txt
http and https public URLs pass.
file:// URLs fail.
localhost fails.
127.0.0.1 fails.
10.x.x.x fails.
192.168.x.x fails.
URLs with username/password fail.
Hash fragments are removed from normalized URL.
```

## Phase 6 — Cache layer

Tasks:

```txt
Implement cache-key generation.
Implement KV read/write.
Implement cache metadata object.
Implement X-Converting-Cache headers.
```

Acceptance criteria:

```txt
Same URL/options hits cache on second request.
Different options create different cache keys.
Cache hit does not call conversion strategies.
Oversized output is not cached.
```

## Phase 7 — Native Markdown conversion

Tasks:

```txt
Implement fetchWithLimits().
Implement native conversion strategy.
Send Accept: text/markdown.
Read x-markdown-tokens.
Respect MAX_SOURCE_BYTES.
Validate redirects.
```

Acceptance criteria:

```txt
Native Markdown response returns method=native.
HTML response does not count as successful native conversion.
Large response returns source_too_large.
Redirect to blocked URL is rejected.
```

## Phase 8 — Workers AI conversion

Tasks:

```txt
Implement content-type detection.
Implement image-blocking logic.
Fetch target body with byte limit.
Create Blob.
Call env.AI.toMarkdown().
Pass HTML conversionOptions.hostname.
Pass cssSelector when provided.
Pass image options only when image conversion is allowed.
Normalize ConversionResult.
```

Acceptance criteria:

```txt
HTML source converts through mocked AI binding.
cssSelector is passed through.
Image URL is blocked by default.
Image URL succeeds only with allow_images=true and quota available.
AI token count is included when available.
```
