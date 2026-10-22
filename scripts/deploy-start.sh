#!/usr/bin/env bash
# Start command for the Dokploy deploy runner (NIXPACKS_START_CMD="bash scripts/deploy-start.sh").
# Applies D1 migrations, then deploys the Worker with its secrets. The secret
# list lives here, in git, so a new secret is one reviewed change plus one
# Dokploy env var, and a missing one stops the deploy instead of the Worker.
set -euo pipefail

secret_names=(ADMIN_TOKEN API_KEY_PEPPER TYPESAFE_API_KEY FRANKENSURF_API_KEY)
secrets_file=.wrangler-secrets.env
trap 'rm -f "$secrets_file"' EXIT

: > "$secrets_file"
chmod 600 "$secrets_file"
for name in "${secret_names[@]}"; do
  value="${!name:-}"
  if [ -z "$value" ]; then
    echo "deploy-start: missing secret $name in the Dokploy environment" >&2
    exit 1
  fi
  printf '%s=%s\n' "$name" "$value" >> "$secrets_file"
done

npx wrangler d1 migrations apply converting_md --remote
npx wrangler deploy --secrets-file "$secrets_file"
rm -f "$secrets_file"

# Dokploy expects a long-running container; the Worker now runs on Cloudflare.
exec tail -f /dev/null
