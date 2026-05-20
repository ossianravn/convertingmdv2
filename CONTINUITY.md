# Goal (incl. success criteria):
- Commit and push the README/open-source update, selecting a standard OSS license that fits the repository.
- Success means the repo has a standard license file, package metadata and README agree on the license, release checks pass, and the resulting commit is pushed to `origin/main`.

# Constraints/Assumptions:
- Read `.dev-docs/converting-md-prd-split/00-index.md` first; for this docs task, use focused PRD docs `04-cloudflare-config-deployment.md` and `11-readme-ops-defaults.md`.
- Read `.dev-docs/context/WORKING.md` before editing; latest handoff says normalization was committed/pushed at `745cd9b`, production still needs deploy for normalized `md:v4` output.
- Current production Wrangler config is temporary browser address-bar mode: `REQUIRE_AUTH=false`, `ALLOW_ANON=true`; Browser Run and image conversion remain protected.
- Keep files under 300 lines without line-squeezing; split or rewrite by responsibility where needed.
- Do not edit `AGENTS.md`, reset the database, use `git checkout`, or revert user changes without explicit confirmation.
- `.git` is not usable in this sandbox; use `GIT_DIR=.git-local GIT_WORK_TREE=.` for git inspection.
- Use `.git-local` for commit/push operations; `.dev-docs/context/` is untracked handoff material and should not be swept into the commit unless explicitly requested.

# Key decisions:
- Treat the README opening as end-user facing: lead with `https://converting.md/https://example.com/page`, then explain that the repo can also run private API-key mode.
- Keep open-source messaging factual and operational; do not leak agent/developer handoff context into the README.
- Use the MIT License: it is a standard permissive OSS license with SPDX identifier `MIT`, fits a reusable Cloudflare Worker app, and avoids adding copyleft obligations.

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
  - Now:
    - Updating the continuity ledger after push.
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
