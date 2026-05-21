# Goal (incl. success criteria):
- Fix conversion for source URLs that redirect, including `https://www.edc.dk/roenne`, and add `url: {url}` as the first frontmatter field in all successful markdown returns.
- Success means redirects are followed with PRD-required validation, redirect and non-redirect markdown outputs include the resolved source URL first in frontmatter, regression tests cover the behavior, verification passes, and unrelated handoff files remain uncommitted unless explicitly requested.

# Constraints/Assumptions:
- Read `.dev-docs/converting-md-prd-split/00-index.md` first; for this bug fix, use focused PRD docs `06a-url-security.md`, `08-routes-responses-errors.md`, and tests docs if needed.
- Current production Wrangler config is temporary browser address-bar mode: `REQUIRE_AUTH=false`, `ALLOW_ANON=true`; Browser Run and image conversion remain protected.
- Keep files under 300 lines without line-squeezing; split or rewrite by responsibility where needed.
- Do not edit `AGENTS.md`, reset the database, use `git checkout`, or revert user changes without explicit confirmation.
- `.git` is not usable in this sandbox; use `GIT_DIR=.git-local GIT_WORK_TREE=.` for git inspection.
- Use `.git-local` for commit/push operations; `.dev-docs/context/` is untracked handoff material and should not be swept into the commit unless explicitly requested.

# Key decisions:
- Add the detailed Cloudflare setup as a separate root-level guide rather than expanding the already concise README.
- Keep redirect validation in `fetchWithLimits`; decorate successful route results with source URL frontmatter at the route boundary so cache hits and all methods share one external response contract.

# State:
  - Done:
    - User reported `https://converting.md/https://www.edc.dk/roenne` fails with `conversion_failed` because the source redirects to `https://www.edc.dk/ejendomsmaegler/roenne/bornholmerbo/`.
    - Read relevant PRD docs `06a-url-security.md` and `08-routes-responses-errors.md`; PRD requires max 5 explicit redirects, each redirected URL validated, and successful responses include source URL headers.
    - Confirmed `fetchWithLimits` already follows validated redirects with `redirect: "manual"` and existing unit coverage.
    - Added `src/conversion/frontmatter.ts` to insert `url: {resolvedSourceUrl}` as the first YAML frontmatter field, replacing any existing top-level `url:` field in the frontmatter block.
    - Applied frontmatter decoration in `src/routes/markdown.ts` before counters, event logging, and response generation.
    - Added `test/route-redirect-frontmatter.test.ts` for the EDC-style redirect chain and final URL frontmatter.
    - Updated route/cache/quota/mode tests for decorated markdown and output byte accounting.
    - Verification passed: `npm run typecheck`, `npm test` (25 files, 95 tests), `npm run check:file-lines`, and `npm run verify:release`.
    - Current turn: read `CONTINUITY.md`, `.dev-docs/context/WORKING.md`, and `.dev-docs/converting-md-prd-split/00-index.md`.
    - Handoff says README OSS readiness, MIT license, and `CLOUDFLARE_SETUP.md` work are complete, verified, committed, and pushed to `origin/main`.
    - Loaded `CONTINUITY.md`, `.dev-docs/context/WORKING.md`, `.dev-docs/converting-md-prd-split/00-index.md`, and focused PRD docs `04` and `11`.
    - Confirmed README is currently 299 lines, so updates need consolidation rather than append-only changes.
    - Confirmed `.git-local` status shows `CONTINUITY.md` modified and `.dev-docs/context/` untracked.
    - Rewrote `README.md` to lead with the public address-bar route, then document private API mode, setup, admin keys, deploy, production checks, verification, troubleshooting, and open-source notes.
    - Kept `README.md` under the 300-line budget at 293 lines.
    - Verification passed: `npm run check:file-lines`, `npm run check:prd-docs`, `npm run verify:release` (24 test files, 94 tests), and `npm run deploy:preflight`.
    - User asked to choose a standard OSS license, commit, and push.
    - Added `LICENSE` with MIT text, set `package.json`/lockfile license metadata to `MIT`, and updated README open-source notes.
    - Verification passed after license changes: `npm run verify:release` (24 test files, 94 tests), `npm run deploy:preflight`, and README stayed under 300 lines at 292 lines.
    - Committed and pushed `68edf60` (`Prepare README for open source release`) to `origin/main`.
    - Read current README, `RELEASE_READINESS.md`, `wrangler.jsonc`, PRD deployment docs, and checked official Cloudflare docs for Wrangler deploy, D1, KV, Workers AI bindings, secrets, and custom domains.
    - Added `CLOUDFLARE_SETUP.md` with a 12-step setup flow covering local preparation, auth mode, D1, KV, Workers AI binding, secrets, verification, remote migration, deploy, custom domain, production smoke tests, and operations.
    - Linked `CLOUDFLARE_SETUP.md` from the README Cloudflare Setup section.
    - Verification passed after guide changes: `npm run verify:release` (24 test files, 94 tests), `npm run deploy:preflight`, `npm run check:file-lines`, and `npm run check:prd-docs`.
    - Committed and pushed `0d08fb6` (`Add Cloudflare setup guide`) to `origin/main`.
  - Now:
    - User requested commit and push for the redirect/frontmatter fix.
  - Next:
    - Stage only intended source/test/ledger files, commit, push to `origin/main`, and report the commit hash.

# Open questions (UNCONFIRMED if needed - you can be more verbose here, so the user is qualified to answer!):
- None.

# Working set (files/ids/commands):
- `README.md`
- `CONTINUITY.md`
- `.dev-docs/context/WORKING.md`
- `.dev-docs/converting-md-prd-split/00-index.md`
- `.dev-docs/converting-md-prd-split/04-cloudflare-config-deployment.md`
- `.dev-docs/converting-md-prd-split/11-readme-ops-defaults.md`
- `GIT_DIR=.git-local GIT_WORK_TREE=. git status --short`
- `npm run verify:release`
- `npm run deploy:preflight`
- `LICENSE`
- `package.json`
- `package-lock.json`
- Commit `68edf60`
- `CLOUDFLARE_SETUP.md`
- Commit `0d08fb6`
- `src/security/url.ts`
- `src/http/fetch-with-limits.ts`
- `src/conversion/frontmatter.ts`
- `src/routes/markdown.ts`
- `test/route-redirect-frontmatter.test.ts`
- `test/route-acceptance.test.ts`
- `test/cache.test.ts`
- `test/quota.test.ts`
- `test/route-modes.test.ts`
