# Goal (incl. success criteria):
- 2026-10-20 [USER] Replace the JSON response at `https://converting.md/` with an open frontpage: a Markdown-to-HTML converter like markdowntohtml.com (modern, clean, no slop) plus a URL input that sends the user to `converting.md/{url}`.
- 2026-10-20 [ASSUMPTION] Success: browsers get the HTML page at `/`; API clients (`Accept` without `text/html`) still get the JSON route list; live preview, Preview/HTML views, Copy HTML, Download .html, URL redirect; light/dark; wide and narrow layouts reviewed in a real browser; `npm run verify:release` passes.

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
  - Now:
    - 2026-10-20 [USER] Approved commit + push. Committing the frontpage (excluding the user's `AGENTS.md` change) and pushing to `origin/main`.
  - Next:
    - 2026-10-20 [TOOL] Watch the Dokploy redeploy on `kpi-v2-panel` (container `convertingmd-app-*`; start cmd runs D1 migrations then `wrangler deploy`), then verify `https://converting.md/` in a browser and that `curl https://converting.md/` still returns JSON.

# Open questions (UNCONFIRMED if needed - you can be more verbose here, so the user is qualified to answer!):
- 2026-10-20 [TOOL] CONFIRMED: Dokploy (Nixpacks, Node 22.12.0) on `kpi-v2-panel` (ssh alias, Codex key): install `npm run install:deploy-runner`; build `npm run check && check:env-hygiene && check:prd-docs && npm audit && deploy:preflight`; start runs `wrangler d1 migrations apply --remote` then `wrangler deploy --secrets-file`, so `build:web` runs at container start. All locked packages support Node 22.12.

# Working set (files/ids/commands):
- 2026-10-20 [CODE] `web/`, `scripts/build-web.ts`, `src/routes/home.ts`, `src/routes/catchall.ts`, `src/types/env.ts`, `wrangler.jsonc`, `scripts/check-deploy-config.ts`, `scripts/check-file-lines.ts`, `test/helpers.ts`, `test/health.test.ts`
- 2026-10-20 [TOOL] `npm ci`, `npm run build:web`, `npm run check`, `npm run verify:release`, `npx wrangler dev`
