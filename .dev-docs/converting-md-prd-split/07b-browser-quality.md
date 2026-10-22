# 07B — Browser Run Strategy and Quality Checks
## Browser Run strategy

File:

```txt
src/conversion/browser.ts
```

Behavior:

```txt
Require allow_browser=true for explicit browser mode.
Require auto_browser_fallback=true for automatic fallback.
Require browser budget reservation.
Call Cloudflare Browser Run through env.BROWSER.quickAction("markdown", ...).
Pass URL, not raw HTML, for JS-heavy pages.
Use domcontentloaded by default.
Allow networkidle0/networkidle2 only when explicitly requested.
Block images, CSS, fonts, media assets by default.
Read X-Browser-Ms-Used from response headers.
Return Markdown result.
```

Binding:

```txt
BROWSER
```

Request body default:

```json
{
  "url": "https://example.com",
  "gotoOptions": {
    "waitUntil": "domcontentloaded",
    "timeout": 10000
  },
  "rejectRequestPattern": [
    "/^.*\\.(css|png|jpg|jpeg|gif|webp|svg|ico|woff|woff2|ttf|otf|mp4|webm|mp3)(\\?.*)?$/i"
  ]
}
```

Do not send cookies.

Do not support target-site authentication in v1.

Do not claim Browser Run bypasses bot protection. Cloudflare’s docs state that configurable user agents do not bypass bot protection and Browser Run requests remain identifiable as bot traffic.

Browser acceptance criteria:

```txt
mode=browser fails for key without browser permission.
mode=browser succeeds with mocked Browser Run response.
X-Browser-Ms-Used is stored.
Missing X-Browser-Ms-Used charges reserved max.
DISABLE_BROWSER=true prevents browser calls.
```

## Quality check

Implement a small `isGoodEnough()` check.

It can consider output weak when:

```txt
empty or whitespace-only
very short relative to source
contains obvious boilerplate-only text
conversion returned an explicit error marker
```

Do not over-engineer quality scoring in v1.

If AI output is weak and automatic browser fallback is not allowed, return the AI output if it exists, or return the AI error if it failed.

## Content verification and Frankensurf fallback

A source can answer 200 and still not be the page: a WAF challenge, an app
shell, a cookie wall, a soft 404 or a paywall. Every fresh conversion is checked
before it is returned or cached (`src/conversion/verification.ts`):

```txt
source 404/410            -> 404 source_not_found (no model call)
source 401                -> 403 source_login_required
other non-2xx (403/454..) -> retry through Frankensurf
2xx                       -> one Jev Choice on the first 5,000 characters:
  real_content                       -> return, cache
  access_block / javascript_shell /
  consent_wall                       -> retry through Frankensurf (auto mode)
  not_found / login_wall (p >= 0.7)  -> 404 / 403, not cached
TypeSafe unavailable      -> return uncached, warning content_check_unavailable
```

Frankensurf (github.com/yail259/frankensurf) runs on our Dokploy server, outside
Cloudflare, behind `FRANKENSURF_URL` and `FRANKENSURF_API_KEY`. Its result is
verified the same way; if it is still not the page, the request fails with 502
`source_blocked` and nothing is cached. Calls are counted in
`usage_counters.frankensurf_requests` and refused (429) past the global daily or
monthly limit. `DISABLE_FRANKENSURF=true` turns the fallback off; detection stays on.
