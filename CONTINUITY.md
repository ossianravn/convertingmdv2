# Goal (incl. success criteria):
- Create a step-by-step guide for setting up ConvertingMD on Cloudflare, then commit and push it.
- Success means the repo contains a Cloudflare setup guide grounded in current repo config and official Cloudflare behavior, README links to it, verification passes, and the changes are pushed to `origin/main`.

# Constraints/Assumptions:
- Read `.dev-docs/converting-md-prd-split/00-index.md` first; for this docs task, use focused PRD docs `04-cloudflare-config-deployment.md` and `11-readme-ops-defaults.md`.
- Use official Cloudflare docs for current Wrangler/D1/KV/secrets/domain behavior where relevant.
- Current production Wrangler config is temporary browser address-bar mode: `REQUIRE_AUTH=false`, `ALLOW_ANON=true`; Browser Run and image conversion remain protected.
- Keep files under 300 lines without line-squeezing; split or rewrite by responsibility where needed.
- Do not edit `AGENTS.md`, reset the database, use `git checkout`, or revert user changes without explicit confirmation.
- `.git` is not usable in this sandbox; use `GIT_DIR=.git-local GIT_WORK_TREE=.` for git inspection.
- Use `.git-local` for commit/push operations; `.dev-docs/context/` is untracked handoff material and should not be swept into the commit unless explicitly requested.

# Key decisions:
- Add the detailed Cloudflare setup as a separate root-level guide rather than expanding the already concise README.

# State:
  - Done:
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
    - Updating continuity after the guide push.
  - Next:
    - Report final state to the user.

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
