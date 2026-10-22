# Goal (incl. success criteria):
- 2026-10-22 [USER] Investigate a fallback for fetching pages when the current pipeline (native -> Workers AI -> Browser Run) fails, based on the OSS frankensurf (github.com/yail259/frankensurf), which the user's crawlermd repo already uses.
- 2026-10-22 [USER] Test URL: https://converting.md/https://jagtgaardenjuletraer.dk/store-juletraeer/ (always fails). User has permission from the site owner (Joakim Wolff; user does his SEO).
- 2026-10-22 [ASSUMPTION] "Look into" = diagnose the failure, study frankensurf and the crawlermd integration, and propose a design before building; confirm scope with the user.
- 2026-10-20 [DONE] Frontpage, converter focus, full screen and formatted copy shipped (see State).

# Constraints/Assumptions:
- 2026-06-21 [CODE] Read `.dev-docs/converting-md-prd-split/00-index.md` first; routing work touches `03a`, `08`, `10`; deploy/docs touch `04`, `11`. PRD files stay under 220 lines and `manifest.json` line counts must match.
- 2026-06-21 [CODE] Source files under 300 lines without line-squeezing; split by responsibility. No empty catch blocks, no dev fallbacks.
- 2026-06-21 [CODE] Do not edit `AGENTS.md` (user has an uncommitted change there), reset the database, or revert unrelated user changes.
- 2026-10-20 [CODE] Deploy path: Dokploy (Nixpacks) pulls `main` from GitHub and runs Wrangler; pushing to `main` deploys production, so push only with user approval.
- 2026-10-20 [USER] UI bar: user's global ui-design rules (controls sized to content, Groundwork tokens/patterns, look before reporting at wide/narrow, light/dark).
- 2026-10-20 [TOOL] Plain `git` works in this checkout (`.git`); the old `.git-local` note no longer applies.

# Key decisions:
- 2026-06-21 [CODE] D001-D004 ACTIVE (Browser Run explicit vs fallback permissions; anonymous auto fallback; networkidle2 fallback; generic weak-source signals).
- 2026-10-20 [CODE] D005 ACTIVE: Frontpage is vanilla HTML/CSS/TypeScript in `web/`, bundled by esbuild (`scripts/build-web.ts`) into `dist/web/`, served by Workers Static Assets (`ASSETS` binding); Wrangler `build.command` runs the bundle on deploy/dev.
- 2026-10-20 [CODE] D006 ACTIVE: `GET /` content-negotiates in the Worker: `text/html` -> `env.ASSETS` `index.html` with CSP; otherwise the existing JSON. `html_handling: "none"` so `/` always reaches the Worker.
- 2026-10-20 [CODE] D007 ACTIVE: Markdown parsed client-side with `marked`; preview renders in a sandboxed iframe (no scripts) with parent-controlled link opening; the same stylesheet is embedded in downloaded HTML.

# State:
  - Done:
    - 2026-06-22 [TOOL] Browser Run binding migration and Aura shell cleanup committed (`cd045a5`, `e260a2b`); `main` matched `origin/main` on 2026-10-20.
    - 2026-10-20 [TOOL] Unchanged `main` failed `npm audit` (hono, vitest, nanoid, postcss, sharp/undici via wrangler). Fixed by upgrading wrangler 4.103 -> 4.151.2, @cloudflare/workers-types v4 -> v5, vitest 4.1.12, hono 4.13.13; audit clean, typecheck clean.
    - 2026-10-20 [CODE] Frontpage built: `web/` (HTML, CSS on Groundwork tokens, TS modules), `scripts/build-web.ts`, `src/routes/home.ts` (Accept negotiation + CSP), `ASSETS` binding, deploy preflight checks for assets/build, Windows path fix in file-line check, docs (README, PRD 04/08, acceptance matrix).
    - 2026-10-20 [TOOL] Verified: `npm run check` (30 files / 136 tests), PRD + env checks, audit 0, `wrangler deploy --dry-run` (runs custom build, 4 assets), `wrangler dev --local` health OK; Playwright/Chrome at 1440/1024/390 in light+dark: no overflow, no app console errors; typing, tabs (keyboard), copy, download filename, URL validation/redirect, sandboxed preview blocks scripts and javascript: links.
    - 2026-10-20 [TOOL] `npm run smoke:health` cannot spawn `npm.cmd` on Windows (pre-existing, Linux CI unaffected); equivalent manual `wrangler dev --local` + `/healthz` passed.
    - 2026-10-20 [TOOL] Committed `9b3fb58` and pushed to `origin/main`. GitHub Actions `verify:release` passed (incl. Linux health smoke). Dokploy build succeeded; container deploy ran `build:web`, uploaded 4 assets, Worker version `3d751df1-4da2-4877-8938-5ab90907d801`.
    - 2026-10-20 [TOOL] Production verified: browser Accept -> frontpage with CSP/Vary/request id; `curl https://converting.md/` -> JSON; assets 200; `/healthz` ok; `/https://example.com/` converts (method ai); Playwright on production at 1440 light and 390 dark: no overflow, no console errors; URL form redirect converts example.com.
    - 2026-10-20 [CODE] Converter prominence: hero spacing `--gap-hero`, headline max 40px, page width 90rem, panes `calc(100svh - 23rem)` (at 2030x1019: top 417->350, width 1184->1376, bottom above the fold).
    - 2026-10-20 [USER] Added full screen for the converter (Fullscreen API on `#markdown-to-html`, hidden where unsupported) and "Copy formatted" (ClipboardItem with inline-styled text/html + readable text/plain); Copy HTML now uses a code icon; pane actions go icon-only below a 36rem pane.
    - 2026-10-20 [TOOL] Verified locally in Chrome: full screen enter/exit, clipboard flavours, header fits at 2030/1440/1280 (labels) and 1024/390 (icons), no overflow.
    - 2026-10-20 [TOOL] Committed `59cb366`, pushed; Dokploy deployed Worker version `f17628ed-58dc-46e4-a5e8-740efc730775`. Production verified: layout at 2030x1019 (top 350, width 1376, ends above fold), full screen enter/exit, Copy formatted writes text/html + text/plain, `curl /` still JSON.
    - 2026-10-22 [TOOL] Test URL returns 200 + cached Markdown of a Simply.com WAF challenge ("454 Checking your browser / Request blocked"); fresh run: method ai, browserMs 0, warnings source_script_heavy,source_cookie_shell, no fallback attempted.
    - 2026-10-22 [TOOL] Same URL with a Chrome UA returns 200 / 125 KB real page from a residential IP and from the Dokploy server (45.13.225.27); `curl` UA gets 455. So Simply.com blocks Cloudflare Worker egress, not datacenter IPs in general.
    - 2026-10-22 [CODE] Gaps: source HTTP status is never checked (fetch-with-limits/ai.ts convert 4xx/5xx bodies); quality checks skip sources <=4 KB and have no challenge/WAF detection, so block pages are cached as success.
    - 2026-10-22 [TOOL] frankensurf = Python router over ~41 tools (httpx, Jina Reader, Playwright, Camoufox/Patchright/Scrapling, paid unblockers), Firecrawl-compatible `serve` API with bearer key, Docker image ~6 GB, ~1 GB RAM per concurrent browser read, Apache-2.0 alpha (v0.51, created 2026-10-06, author: AI-written, not fully reviewed); SSRF guard off by default and only checks final URL on browser rungs; no concurrency limit in serve; Jina rung sends URLs to a third party.
    - 2026-10-22 [TOOL] crawlermd does NOT integrate frankensurf (only a deprioritized decision note: 1/1,027 pages anti-bot blocked). It has its own Spider http fallback and Jev `is_block_page` detection of converting.md challenge output. Current crawlermd code is in the orca worktree `sandlance`; `C:\CodexApp\crawlermd` is ~30 commits behind.
    - 2026-10-22 [USER] Detection must use Jev (a 200 response can still be a failed page); frankensurf must be included; user questioned the value of a relay before frankensurf.
    - 2026-10-22 [TOOL] Jev (jev-1.14.0) Choice `outcome` {real_content, access_block, javascript_shell, consent_wall, not_found, login_wall} on first ~5k chars classified 10/10 test cases correctly (all p >= 0.88): Simply challenge, CF "Just a moment", Wikipedia CAPTCHA article, example.com, Simply DK home, Simply 404 + GitHub 404 (both served as 200 today), JS shell, DK cookie wall, paywall. Cost ~$0.042/Mtok input (~$0.00007/check).
    - 2026-10-22 [TOOL] Server kpi-v2-panel: 3 vCPU, 13 GiB RAM (~8.5 available), 37 GB disk free. frankensurf `serve` defaults to 127.0.0.1:3002, needs FRANKENSURF_API_KEY on non-loopback, shm 1 GB; Jina rung is always available (no off switch found yet).
    - 2026-10-22 [CODE] Built: Jev content check (`src/typesafe/system-one.ts`, `src/conversion/content-check.ts`, pinned jev-1.14.0), verdict policy (`verification.ts`: 404/410->404, 401->403, other non-2xx->Frankensurf; Jev outcomes; TypeSafe down -> uncached + warning), Frankensurf client + D1 budget (`frankensurf.ts`, `usage/frankensurf-budget.ts`, migration 0002), orchestrator split (`pipeline-support.ts`, `browser-fallback.ts`, `auto-pipeline.ts`), cache key v5, `scripts/deploy-start.sh`, `deploy/frankensurf/docker-compose.yml`, docs (README, PRD 07b/08).
    - 2026-10-22 [TOOL] Verified: 31 files / 145 tests, check/PRD/env/audit/dry-run green; live TypeSafe via new client 155-242 ms with correct answers.
    - 2026-10-22 [TOOL] Dokploy (panel.ossianravn.dev, key in local .dev.vars): created isolated Compose app `frankensurf` (composeId A7NjwI6WNyd4BwMC6XFkB, appName compose-connect-solid-state-alarm-eukfbh; rename via API did not apply) with image 0.51.0; healthy. In-container scrape of the test URL: 200 via http rung, 21,858 chars, 0.8 s. Isolation: other containers unresolvable; host gateway exposes only already-public ports.
    - 2026-10-22 [TOOL] DNS surf.converting.md -> 45.13.225.27 added by user; Dokploy domain (port 3002, Let's Encrypt) live: /health 200, unauthenticated scrape 401, keyed scrape of the test URL 200 via http in ~1 s.
  - Now:
    - 2026-10-22 [USER] Approved: enable fallback (DISABLE_FRANKENSURF="false"), apply converting.md Dokploy env (TYPESAFE_API_KEY, FRANKENSURF_API_KEY, NIXPACKS_START_CMD=bash scripts/deploy-start.sh), push, verify production.
  - Next:
    - 2026-10-22 [ASSUMPTION] Note for user: Docker Swarm ports 2377/7946 are open to the internet on kpi-v2-panel (unrelated finding).

# Open questions (UNCONFIRMED if needed - you can be more verbose here, so the user is qualified to answer!):
- 2026-10-20 [TOOL] CONFIRMED: Dokploy (Nixpacks, Node 22.12.0) on `kpi-v2-panel` (ssh alias, Codex key): install `npm run install:deploy-runner`; build `npm run check && check:env-hygiene && check:prd-docs && npm audit && deploy:preflight`; start runs `wrangler d1 migrations apply --remote` then `wrangler deploy --secrets-file`, so `build:web` runs at container start. All locked packages support Node 22.12.

# Working set (files/ids/commands):
- 2026-10-20 [CODE] `web/`, `scripts/build-web.ts`, `src/routes/home.ts`, `src/routes/catchall.ts`, `src/types/env.ts`, `wrangler.jsonc`, `scripts/check-deploy-config.ts`, `scripts/check-file-lines.ts`, `test/helpers.ts`, `test/health.test.ts`
- 2026-10-20 [TOOL] `npm ci`, `npm run build:web`, `npm run check`, `npm run verify:release`, `npx wrangler dev`
