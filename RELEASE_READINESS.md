# Release Readiness

Date: 2026-05-19

This artifact records the local release evidence for the ConvertingMD v1 Worker. It does not replace the README; it is the short handoff checklist for deploy/publish.

For PRD acceptance traceability, see `ACCEPTANCE_MATRIX.md`.

## Verified Gates

Run from the repository root:

```bash
npm --cache /tmp/npm-cache ci --ignore-scripts
npm run verify:release
API_KEY_PEPPER=pepper npm run create-local-key
```

Latest local results:

- `npm --cache /tmp/npm-cache ci --ignore-scripts`: passed and left `package-lock.json` unchanged.
- `npm run check`: passed with 19 test files and 75 tests.
- `npm run check:env-hygiene`: passed for `.dev.vars.example` placeholders and local env ignore rules.
- `npm run check:prd-docs`: passed for split PRD manifest metadata and line budgets.
- `npm --cache /tmp/npm-cache audit`: passed with 0 vulnerabilities.
- `npm run deploy:dry-run`: passed and produced a Worker bundle without publishing.
- `npm run deploy:preflight`: expected to fail until placeholder D1/KV IDs are replaced.
- `npm run smoke:health`: passed against local Wrangler `/healthz`.
- `npm run verify:release`: passed and runs the check, env hygiene, PRD-doc, audit, deploy dry-run, and health-smoke gates together.
- `API_KEY_PEPPER=pepper npm run create-local-key`: passed and generated a local test key/hash pair.

## CI Gate

`.github/workflows/check.yml` runs on pull requests and pushes to `main`.

The workflow installs dependencies with lifecycle scripts disabled, then runs:

```bash
npm ci --ignore-scripts
npm run verify:release
```

## Deploy Prerequisites

Before a real deployment:

- Replace `REPLACE_ME` D1 and KV IDs in `wrangler.jsonc`.
- Confirm `npm run deploy:preflight` passes.
- Set strong production secrets with `wrangler secret put`.
- Apply the production D1 migration with `npm run db:migrate`.
- Confirm `REQUIRE_AUTH=true` and `ALLOW_ANON=false`.
- Keep `DISABLE_IMAGE_CONVERSION=true` unless intentionally enabling image conversion.
- Enable Browser Run only for trusted API keys with conservative browser-ms limits.
- Confirm `ADMIN_TOKEN` and `API_KEY_PEPPER` are strong random values.

## Deploy Sequence

```bash
npm run verify:release
npm run deploy:preflight
npm run db:migrate
npm run deploy
```

For Dokploy/Nixpacks, set the install command to
`npm run install:deploy-runner` so the deploy image repairs npm's optional
Rolldown native binding issue before the test gate runs.

After deploy:

- Route `converting.md/*` to the Worker in Cloudflare.
- Call `/healthz`.
- Create an admin API key with conservative limits.
- Call `/v1/markdown` with the new API key.
- Check `/v1/admin/usage` for request and conversion-event accounting.

## Rollback Notes

- Wrangler deployments create Worker versions; roll back through Cloudflare if the deployed version misbehaves.
- Keep the previous Worker version available until health, auth, conversion, cache, and usage checks pass.
- Do not rotate `API_KEY_PEPPER` during rollback unless all API keys are intentionally invalidated.
- Do not reset D1 data to roll back application code.

## Known External Blockers

- This workspace is not a usable git repository, so local git status/commit/push cannot be verified here.
- Real Cloudflare deployment requires account access, generated binding IDs, and production secrets.
