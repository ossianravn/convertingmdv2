# Cloudflare Setup Guide

This guide walks a new operator from a cloned ConvertingMD repository to a
deployed Cloudflare Worker on a custom domain.

Run all commands from the repository root.

## 1. Prepare the Local Project

Install Node 22+ and npm, then install dependencies:

```bash
npm install
```

Sign in to Cloudflare from Wrangler:

```bash
npx wrangler login
```

Confirm Wrangler can see your account:

```bash
npx wrangler whoami
```

## 2. Choose the Production Auth Mode

Public address-bar mode lets people open:

```txt
https://your-domain.com/https://example.com/page
```

Use this in `wrangler.jsonc`:

```jsonc
"REQUIRE_AUTH": "false",
"ALLOW_ANON": "true"
```

Private API-key mode requires `Authorization: Bearer ...` or `X-API-Key` for
conversion requests:

```jsonc
"REQUIRE_AUTH": "true",
"ALLOW_ANON": "false"
```

Keep `DISABLE_IMAGE_CONVERSION` set to `"true"` unless image conversion is
intentionally being enabled. Browser Run is still gated by per-key capability
and quota checks.

## 3. Create the D1 Database

Create the production D1 database:

```bash
npx wrangler d1 create converting_md
```

Copy the returned `database_id` into `wrangler.jsonc`:

```jsonc
"d1_databases": [
  {
    "binding": "DB",
    "database_name": "converting_md",
    "database_id": "<DATABASE_ID>"
  }
]
```

Use the binding name `DB`; the Worker code expects `env.DB`.

## 4. Create the KV Namespace

Create the cache namespace:

```bash
npx wrangler kv namespace create CACHE_KV
```

Copy the returned namespace ID into `wrangler.jsonc`:

```jsonc
"kv_namespaces": [
  {
    "binding": "CACHE_KV",
    "id": "<KV_NAMESPACE_ID>"
  }
]
```

Use the binding name `CACHE_KV`; the Worker code expects `env.CACHE_KV`.

## 5. Confirm the Workers AI Binding

`wrangler.jsonc` should include this binding:

```jsonc
"ai": {
  "binding": "AI"
}
```

The Worker uses `env.AI` for Cloudflare Workers AI Markdown conversion.

## 6. Set Production Secrets

Set every required production secret:

```bash
npx wrangler secret put ADMIN_TOKEN
npx wrangler secret put API_KEY_PEPPER
npx wrangler secret put CLOUDFLARE_ACCOUNT_ID
npx wrangler secret put CLOUDFLARE_BROWSER_API_TOKEN
```

Use strong random values for `ADMIN_TOKEN` and `API_KEY_PEPPER`. Do not rotate
`API_KEY_PEPPER` unless you intend to invalidate existing API keys.

If Browser Run is not being used, set `DISABLE_BROWSER` to `"true"`. This app
still validates that the browser token secret exists in production, so store a non-empty value for
`CLOUDFLARE_BROWSER_API_TOKEN`; replace it with a real Cloudflare token before
enabling Browser Run.

Do not commit `.dev.vars`, raw API keys, admin tokens, peppers, or API tokens.

If this is a brand-new Worker and Wrangler says the script does not exist yet,
finish steps 7-9 once to create it, set the secrets, then run `npm run deploy`
again. Production requests will not work until the required secrets exist.

## 7. Run the Release Gate

Run the full local verification gate:

```bash
npm run verify:release
```

Run the deployment config preflight:

```bash
npm run deploy:preflight
```

The preflight rejects missing D1/KV IDs, unsafe production vars, and invalid
auth-mode combinations.

## 8. Apply the Remote D1 Migration

Apply the checked-in D1 migration to the remote database:

```bash
npm run db:migrate -- --remote
```

If Wrangler reports `No migrations to apply!`, the remote database is already
current.

## 9. Deploy the Worker

Deploy the Worker:

```bash
npm run deploy
```

`npm run deploy` runs `npm run deploy:preflight` first.

## 10. Connect the Domain

For a Worker that owns the whole hostname, use a Cloudflare Custom Domain.

Dashboard path:

```txt
Workers & Pages -> converting-md -> Settings -> Domains & Routes -> Add -> Custom Domain
```

Use your root domain or subdomain, for example:

```txt
converting.md
```

Leave the path empty. The address-bar route needs all paths on the hostname to
reach the Worker, including `/https://example.com/page`.

## 11. Smoke Test Production

Check health:

```bash
curl -i "https://your-domain.com/healthz"
```

For public address-bar mode:

```bash
curl -i "https://your-domain.com/https://example.com"
```

For private API-key mode, create an owner key:

```bash
curl \
  -X POST "https://your-domain.com/v1/admin/api-keys" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Owner",
    "status": "active",
    "dailyRequestLimit": 1000,
    "monthlyRequestLimit": 25000,
    "allowBrowser": true,
    "autoBrowserFallback": false,
    "dailyBrowserMsLimit": 600000,
    "monthlyBrowserMsLimit": 3600000,
    "allowImages": false,
    "dailyImageLimit": 0,
    "monthlyImageLimit": 0
  }'
```

Store the returned `apiKey`; it is shown once. Then test conversion:

```bash
curl \
  -H "Authorization: Bearer cmd_live_xxx" \
  "https://your-domain.com/v1/markdown?url=https%3A%2F%2Fexample.com"
```

Check usage accounting:

```bash
curl \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  "https://your-domain.com/v1/admin/usage"
```

## 12. Operational Checks

- Keep `DISABLE_IMAGE_CONVERSION=true` unless image conversion is deliberately enabled.
- Keep Browser Run limited to trusted keys with conservative browser-ms budgets.
- Confirm `X-Converting-Method`, `X-Converting-Cache`, and request IDs appear on conversion responses.
- Watch Cloudflare Workers logs after the first deploy.
- Keep previous Worker versions available until health, conversion, cache, quota, and usage checks pass.
- Do not reset the D1 database for rollback; roll back Worker code through Cloudflare deployments.

## Official Cloudflare References

- Wrangler CLI: https://developers.cloudflare.com/workers/wrangler/
- Wrangler deploy command: https://developers.cloudflare.com/workers/wrangler/commands/workers/
- D1 Wrangler commands: https://developers.cloudflare.com/d1/wrangler-commands/
- Workers KV commands: https://developers.cloudflare.com/workers/wrangler/commands/kv/
- Workers AI bindings: https://developers.cloudflare.com/workers-ai/configuration/bindings/
- Worker secrets: https://developers.cloudflare.com/workers/configuration/secrets/
- Custom Domains: https://developers.cloudflare.com/workers/configuration/routing/custom-domains/
