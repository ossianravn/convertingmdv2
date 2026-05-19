# 01 — Overview, Goals, Non-Goals

## Product summary

Build a TypeScript Cloudflare Worker API for `converting.md` that accepts a URL and returns clean Markdown.

The API should follow a tiered conversion strategy:

```txt
1. Native Markdown via Accept: text/markdown
2. Workers AI toMarkdown() for fetched HTML / supported documents
3. Cloudflare Browser Run /markdown only when explicitly allowed by API key
```

The first production version must require API-key authentication for all conversion requests.

This is intentional: unauthenticated users must not be able to trigger image conversion, Browser Run, or other usage that could create a large Cloudflare bill.

## Cloudflare context

Cloudflare Markdown for Agents works through `Accept: text/markdown` content negotiation on enabled zones.

Cloudflare Markdown for Agents can include headers such as `x-markdown-tokens` and returns a predictable Markdown structure with optional YAML frontmatter and JSON-LD.

Cloudflare documents that Markdown for Agents only converts HTML and that the origin response cannot exceed 2 MB.

Workers AI exposes `env.AI.toMarkdown()` from a Worker AI binding and supports conversion options, including HTML `hostname`, `cssSelector`, and image description options.

Cloudflare Browser Run has a `/markdown` Quick Action endpoint that accepts either `url` or `html`, can use `gotoOptions` for JavaScript-heavy pages, and returns `X-Browser-Ms-Used`, which must be tracked for budget control.

Browser Run Quick Actions are billed by browser-hours. Current Cloudflare docs list Workers Paid as including 10 browser-hours/month, then $0.09 per additional hour.

## Primary goals

Build a working API:

```txt
POST https://converting.md/v1/markdown
GET  https://converting.md/v1/markdown?url=...
GET  https://converting.md/https://example.com/page
```

All conversion endpoints must require API-key authentication.

The API should return Markdown by default:

```http
Content-Type: text/markdown; charset=utf-8
```

The API should optionally return JSON metadata:

```json
{
  "markdown": "# Example",
  "method": "native",
  "url": "https://example.com",
  "cached": false,
  "tokens": 123,
  "browserMsUsed": 0,
  "requestId": "req_..."
}
```

## Safety goals

Prevent bill shock by adding:

```txt
API-key auth
per-key daily/monthly request quotas
per-key daily/monthly Browser Run millisecond quotas
per-key daily/monthly image conversion quotas
global daily/monthly Browser Run millisecond caps
global image conversion caps
kill switches for browser and image conversion
cache before expensive fallback
```

## Developer goals

The codebase should be easy to modify with Codex later:

```txt
small modules
clear route/handler separation
one conversion strategy per file
storage logic separated from business logic
tests for each module
no giant files
```

## Hard implementation rules

Codex must follow these rules throughout the project:

1. Use TypeScript.
2. Use a Cloudflare Worker as the public conversion API.
3. Keep every source file under 300 lines.
4. Prefer files under 250 lines to avoid refactoring late.
5. Add a CI/script check that fails if any source file exceeds 300 lines.
6. Do not store raw API keys.
7. Do not call Browser Run before authentication, quota checks, and browser-ms reservation.
8. Do not allow image-file conversion unless the API key explicitly allows it.
9. Do not add a crawler in v1.
10. Do not add file upload in v1.
11. Do not add Stripe, user accounts, teams, or dashboards in v1.
12. Do not use self-hosted Playwright/Puppeteer in v1.
13. Do not put Cloudflare secrets, API keys, or admin tokens in committed files.
14. Tests must mock Cloudflare APIs.
15. Tests must not make real Browser Run or Workers AI calls.

## Non-goals for v1

Do not implement these in the first version:

```txt
No public unauthenticated conversion
No multi-page crawling
No recursive sitemap ingestion
No file upload endpoint
No PDF upload endpoint
No user dashboard
No Stripe billing
No OAuth login
No custom target-site cookies
No target-site credentials
No browser session control beyond the Cloudflare /markdown Quick Action
No AI summaries
No embeddings
No vector database
```
