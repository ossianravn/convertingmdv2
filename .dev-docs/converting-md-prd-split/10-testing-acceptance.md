# 10 — Testing and Final Acceptance

## Test framework

Use Vitest.

Tests must mock Cloudflare APIs.

Tests must not make real Browser Run or Workers AI calls.

No tests may call the real internet except where Cloudflare Worker test tooling requires a mocked fetch.

## Required test files

Create tests such as:

```txt
test/auth.test.ts
test/quota.test.ts
test/url-security.test.ts
test/cache.test.ts
test/native-conversion.test.ts
test/ai-conversion.test.ts
test/browser-conversion.test.ts
test/markdown-route.test.ts
test/file-lines.test.ts
```

Codex may split tests further if needed to keep each file under 300 lines.

## Required auth tests

Tests must cover:

```txt
API key hashing
missing API key returns 401
invalid API key returns 401
revoked key returns 403
admin token required for admin routes
raw API key returned only once during creation
raw API key not returned in list endpoint
query-string API key rejected or ignored
```

## Required quota tests

Tests must cover:

```txt
daily request quota exceeded returns 429
monthly request quota exceeded returns 429
cache hit counts as request
cache hit does not count as native/AI/browser conversion
browser disabled returns 403
browser budget reservation and release
global browser-ms cap enforced
image quota enforced
global image cap enforced
```

## Required URL security tests

Tests must cover:

```txt
URL normalization
blocked schemes
blocked local/private hosts
credentials in URL are rejected
hash fragments are removed
redirects to blocked URLs are rejected
more than 5 redirects rejected
ports outside 1-65535 rejected
```

Required blocked examples:

```txt
file:///etc/passwd
http://localhost
http://127.0.0.1
http://10.0.0.1
http://192.168.0.1
http://user:pass@example.com
```

## Required cache tests

Tests must cover:

```txt
same URL/options hits cache on second request
different options create different cache keys
cache hit avoids conversion call
oversized output is not cached
cache metadata reconstructs response headers
```

## Required conversion tests

Native strategy tests:

```txt
text/markdown response returns method=native
x-markdown-tokens is captured
HTML response is not successful native conversion
large response returns source_too_large
redirect validation is applied
```

AI strategy tests:

```txt
HTML source calls mocked env.AI.toMarkdown
HTML hostname is passed to conversion options
cssSelector is passed through
image URL blocked by default
image URL allowed only for allow_images key
AI token count included when available
```

Browser strategy tests:

```txt
mode=browser fails for key without browser permission
mode=browser succeeds with mocked Browser Run response
X-Browser-Ms-Used is recorded
missing X-Browser-Ms-Used charges reserved max
DISABLE_BROWSER=true prevents browser calls
failure releases reservation
```

## Required route tests

Tests must cover:

```txt
POST /v1/markdown works with auth
GET /v1/markdown?url= works with auth
GET /https://example.com works with auth
all conversion routes reject missing auth
format=markdown returns text/markdown
format=json returns JSON object
standard error shape is used
request ID header is present
```

## File line limit tests

The file-line script must be tested.

It should fail on a fixture or temporary file over 300 lines.

It should pass on normal project files.

## Final quality gates

Codex must run:

```bash
npm run check
```

This must include:

```txt
typecheck
tests
file-line check
```

## v1 completion definition

The project is complete when:

```txt
Cloudflare Worker deploys successfully.
All conversion endpoints require API key auth.
Native Markdown strategy works.
Workers AI toMarkdown strategy works.
Browser Run strategy works only with explicit permission.
Image conversion is blocked by default.
Per-key request quotas work.
Per-key browser-ms quotas work.
Global browser-ms caps work.
Cache works.
Admin can create/revoke keys.
All tests pass.
No source file exceeds 300 lines.
README is complete.
```

## Final safety principle

The product must fail closed.

When unsure whether a request is allowed, whether a URL is safe, whether image conversion is happening, or whether browser budget remains, reject the request before calling Cloudflare conversion services.
