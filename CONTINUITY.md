# Goal (incl. success criteria):
- 2026-06-21 [USER] Unblock Dokploy deployment for the pushed Smartbox Browser Run fallback fix.
- 2026-06-21 [ASSUMPTION] Success means `npm audit` no longer fails in the Docker build, release checks pass locally, and the dependency fix is committed/pushed to `origin/main`.

# Constraints/Assumptions:
- 2026-06-21 [CODE] Read `.dev-docs/converting-md-prd-split/00-index.md` before acting; focused docs for this change are `03a`, `05`, `07b`, `08`, `10`, and `11`.
- 2026-06-21 [CODE] Current production/default public setup is unauthenticated address-bar conversion (`REQUIRE_AUTH=false`, `ALLOW_ANON=true`) with Browser Run globally enabled only when `DISABLE_BROWSER=false`.
- 2026-06-21 [CODE] Explicit anonymous Browser Run remains blocked; automatic fallback may run only after auth/config gates and browser-ms budget reservation.
- 2026-06-21 [CODE] Keep source files under 300 lines without line-squeezing; do not edit `AGENTS.md`, reset the database, use `git checkout`, or revert unrelated user changes.
- 2026-06-21 [TOOL] Use `GIT_DIR=.git-local GIT_WORK_TREE=.` for git inspection in this repo.
- 2026-06-21 [USER] User requested committing and pushing the Smartbox fallback fix so Dokploy can pick it up.
- 2026-06-21 [USER] Dokploy build failed at `npm --cache /tmp/npm-cache audit` with advisories in `undici`, `vite`, and `ws` dependency paths.
- 2026-06-21 [ASSUMPTION] Fix should be dependency/lockfile-only unless audit requires a source/config adjustment.

# Key decisions:
- 2026-06-21 [CODE] D001 ACTIVE: Keep explicit Browser Run permission (`allowBrowser`) separate from automatic fallback permission (`autoBrowserFallback`) in quota and reservation checks.
- 2026-06-21 [CODE] D002 ACTIVE: Anonymous/default `mode=auto` conversions can use Browser Run fallback when globally enabled and budgeted, while explicit `mode=browser` remains forbidden without `allowBrowser`.
- 2026-06-21 [CODE] D003 ACTIVE: Automatic fallback should render like a real page by upgrading the default `domcontentloaded` wait to `networkidle2` and allowing CSS; explicit Browser Run keeps caller-configured wait and asset blocking.
- 2026-06-21 [CODE] D004 ACTIVE: Fallback is triggered by generic weak-source/output signals (`source_low_visible_text`, `source_script_heavy`, `source_cookie_shell`, output-too-short/frontmatter-dominant), not domain-specific rules.

# State:
  - Done:
    - 2026-06-21 [TOOL] Reproduced the Smartbox symptom: direct fetch returns a Salesforce/Aura shell with `Loading`, `Sorry to interrupt`, and `CSS Error`; browser rendering returns the Danish FAQ article.
    - 2026-06-21 [TOOL] Live `converting.md` returned `x-converting-method: ai` plus weak-source/output warnings, proving the existing Browser Run fallback gate did not activate for public/default traffic.
    - 2026-06-21 [CODE] Patched anonymous API-key config to permit automatic fallback budgets when Browser Run is globally enabled, while keeping explicit browser and image conversion disabled.
    - 2026-06-21 [CODE] Patched Browser Run quota/reservation to accept an explicit-vs-fallback permission purpose.
    - 2026-06-21 [CODE] Patched Browser Run fallback defaults to use `networkidle2` and avoid blocking CSS while preserving explicit Browser Run behavior.
    - 2026-06-21 [CODE] Patched the orchestrator to enable fallback internally for eligible `mode=auto` requests before cache-key creation.
    - 2026-06-21 [CODE] Added/updated regression tests for anonymous Smartbox-like fallback, fallback budget semantics, source-profile warnings, explicit anonymous Browser Run blocking, and guarded fallback behavior.
    - 2026-06-21 [CODE] Updated README, release readiness, acceptance matrix, Cloudflare setup, and PRD docs to match the explicit-vs-fallback Browser Run policy.
    - 2026-06-21 [TOOL] Verification passed: focused Vitest files, `npm run typecheck`, `npm run check`, `npm run deploy:dry-run`, `npm run smoke:health`, and `git diff --check`.
    - 2026-06-21 [TOOL] `npm run verify:release` passed its check/env/PRD phases but failed at `npm audit` due existing dependency advisories in `esbuild`, `hono`, `undici`, `vite`, and `ws` dependency paths.
    - 2026-06-21 [TOOL] `npm audit fix` updated the lockfile dependency graph to clean versions of `wrangler`/`miniflare`, `undici`, `ws`, `vite`, `esbuild`, and `hono`.
    - 2026-06-21 [TOOL] `npm run verify:release` passed after the dependency update: 27 test files / 104 tests, env hygiene, PRD docs, `npm audit`, Wrangler dry-run, and health smoke.
    - 2026-06-21 [TOOL] Committed and pushed dependency audit fix as `81ac235` (`Update dependencies for clean audit`) to `origin/main`.
  - Now:
    - 2026-06-21 [TOOL] Dependency audit fix is pushed; Dokploy should rebuild from `origin/main`.
  - Next:
    - 2026-06-21 [TOOL] If Dokploy still fails, inspect the next build log; expected audit blocker is resolved.

# Open questions (UNCONFIRMED if needed - you can be more verbose here, so the user is qualified to answer!):
- 2026-06-21 [ASSUMPTION] UNCONFIRMED: whether Dokploy's Docker warnings about secrets-as-ARG/ENV block deploy after audit is fixed; current log shows them as warnings, not the failing step.

# Working set (files/ids/commands):
- 2026-06-21 [CODE] `src/auth/anonymous.ts`
- 2026-06-21 [CODE] `src/middleware/auth.ts`
- 2026-06-21 [CODE] `src/usage/quota.ts`
- 2026-06-21 [CODE] `src/usage/reservations.ts`
- 2026-06-21 [CODE] `src/conversion/browser.ts`
- 2026-06-21 [CODE] `src/conversion/orchestrator.ts`
- 2026-06-21 [CODE] `test/anonymous-browser-fallback.test.ts`
- 2026-06-21 [CODE] `test/browser-budget.test.ts`
- 2026-06-21 [CODE] `test/browser-fallback.test.ts`
- 2026-06-21 [CODE] `test/route-acceptance.test.ts`
- 2026-06-21 [CODE] `test/source-profile.test.ts`
- 2026-06-21 [TOOL] `npm test -- test/source-profile.test.ts test/browser-budget.test.ts test/browser-fallback.test.ts test/anonymous-browser-fallback.test.ts test/route-acceptance.test.ts`
- 2026-06-21 [TOOL] `npm run typecheck`
- 2026-06-21 [TOOL] `npm run check`
- 2026-06-21 [TOOL] `npm run verify:release` failed only at `npm audit`
- 2026-06-21 [CODE] `package-lock.json`
- 2026-06-21 [TOOL] `npm run verify:release` passed after dependency update
- 2026-06-21 [TOOL] `npm run deploy:dry-run`
- 2026-06-21 [TOOL] `npm run smoke:health`
- 2026-06-21 [TOOL] `GIT_DIR=.git-local GIT_WORK_TREE=. git diff --check`
