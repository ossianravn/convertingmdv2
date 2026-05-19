# 06A — URL Security and SSRF Protection
## URL security files

Implement:

```txt
src/security/url.ts
src/security/ssrf.ts
src/security/content-type.ts
src/http/fetch-with-limits.ts
```

## Allowed and blocked schemes

Allowed schemes:

```txt
http
https
```

Blocked schemes:

```txt
file
ftp
data
blob
javascript
ws
wss
chrome
about
```

Reject any unsupported scheme before making a network request.

## Blocked hosts and networks

Block obvious private/local hosts:

```txt
localhost
*.localhost
*.local
*.internal
127.0.0.0/8
10.0.0.0/8
172.16.0.0/12
192.168.0.0/16
169.254.0.0/16
0.0.0.0/8
::1
fc00::/7
fe80::/10
```

Also block:

```txt
empty hostname
username/password in URL
ports outside 1-65535
more than 5 redirects
redirects to blocked URLs
```

Do not send cookies to target URLs.

Do not forward incoming request headers to target URLs except a safe user agent and `Accept`.

## URL normalization

Normalize URLs before cache keys:

```txt
lowercase protocol and hostname
remove default port 80/443
preserve path
preserve query
remove hash fragment
```

Examples:

```txt
HTTPS://Example.COM:443/a?b=1#frag
=> https://example.com/a?b=1

http://Example.COM:80/
=> http://example.com/
```

## Redirect handling

Implement redirect validation helper.

Rules:

```txt
max redirects: 5
validate each redirected URL
reject redirect to blocked scheme
reject redirect to blocked/private/local host
reject redirect with credentials
preserve method behavior safely for GET fetches
```

Do not rely on blind automatic redirects when using limited fetch.

Prefer `redirect: "manual"` and follow redirects explicitly with validation.

## Fetch size and timeout limits

Implement `fetchWithLimits()`.

It should support:

```txt
max bytes
max redirects
allowed content types when relevant
timeout
safe headers only
request ID for logging
```

Default source size limit:

```txt
MAX_SOURCE_BYTES = 2097152
```

Default output size limit:

```txt
MAX_OUTPUT_BYTES = 2097152
```

When source response exceeds limit, return `source_too_large` with HTTP 413.

When generated Markdown exceeds limit, return `output_too_large` with HTTP 413.

## Content-type safety

Implement content-type classification:

```txt
isHtmlContentType
isMarkdownContentType
isImageContentType
isSupportedDocumentContentType
isLikelyImageUrl
```

Image URL extensions:

```txt
.jpg
.jpeg
.png
.webp
.svg
.gif
```

Workers AI may support other document formats, but image conversion remains special because it can invoke billable AI image-description behavior.
