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
