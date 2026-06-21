# 04 — Cloudflare Config and Deployment

## Wrangler config

`wrangler.jsonc` should include:

```jsonc
{
  "$schema": "./node_modules/wrangler/config-schema.json",
  "name": "converting-md",
  "main": "src/index.ts",
  "compatibility_date": "2026-05-19",
  "ai": {
    "binding": "AI"
  },
  "browser": {
    "binding": "BROWSER",
    "remote": true
  },
  "d1_databases": [
    {
      "binding": "DB",
      "database_name": "converting_md",
      "database_id": "REPLACE_ME"
    }
  ],
  "kv_namespaces": [
    {
      "binding": "CACHE_KV",
      "id": "REPLACE_ME"
    }
  ],
  "vars": {
    "REQUIRE_AUTH": "true",
    "ALLOW_ANON": "false",
    "DISABLE_BROWSER": "false",
    "DISABLE_IMAGE_CONVERSION": "true",
    "DEFAULT_CACHE_TTL_SECONDS": "86400",
    "MAX_SOURCE_BYTES": "2097152",
    "MAX_OUTPUT_BYTES": "2097152",
    "MAX_BROWSER_MS_PER_REQUEST": "10000",
    "GLOBAL_DAILY_BROWSER_MS_LIMIT": "600000",
    "GLOBAL_MONTHLY_BROWSER_MS_LIMIT": "36000000",
    "GLOBAL_DAILY_IMAGE_LIMIT": "50",
    "GLOBAL_MONTHLY_IMAGE_LIMIT": "500"
  }
}
```

## Environment variables and secrets

`.dev.vars.example` should include:

```txt
ADMIN_TOKEN=replace_me
API_KEY_PEPPER=replace_me
```

Do not commit `.dev.vars`.

Do not commit secrets, real API keys, or real Cloudflare account IDs if they are sensitive.

## Required bindings

The Worker `Env` type must include:

```txt
AI                      Workers AI binding
BROWSER                 Browser Run binding
DB                      D1Database binding
CACHE_KV                KVNamespace binding
ADMIN_TOKEN             secret
API_KEY_PEPPER          secret
```

The Worker must fail loudly if required secrets are missing in production.

## Config parsing

Create `src/config.ts`.

It should parse string environment variables into typed values:

```txt
booleans
integers
limits
timeouts
kill switches
cache TTL
```

Acceptance criteria:

```txt
Bad numeric config fails with a clear error.
Missing required secrets fail in production.
DISABLE_BROWSER and DISABLE_IMAGE_CONVERSION are respected everywhere.
```

## Deployment steps

Document these exact steps in the README.

Create D1:

```bash
wrangler d1 create converting_md
```

Create KV:

```bash
wrangler kv namespace create CACHE_KV
```

Update `wrangler.jsonc` with generated IDs.

Apply migration:

```bash
wrangler d1 migrations apply converting_md
```

Set secrets:

```bash
wrangler secret put ADMIN_TOKEN
wrangler secret put API_KEY_PEPPER
```

Deploy:

```bash
wrangler deploy
```

Route domain:

```txt
converting.md/*
```

to the Worker in Cloudflare.

## Local development

The README should explain:

```txt
copy .dev.vars.example to .dev.vars
fill local test secrets
run npm install
run migrations locally if applicable
run npm run dev
call /healthz
create a test API key through admin endpoint
call /v1/markdown with Authorization header
```

## Production safety checklist

Before production deploy:

```txt
REQUIRE_AUTH=true
ALLOW_ANON=false
DISABLE_IMAGE_CONVERSION=true unless intentionally enabled
personal/test keys have conservative limits
browser enabled only for trusted keys
admin token is strong
API_KEY_PEPPER is strong and random
D1 migration applied
KV namespace bound
npm run check passes
```
