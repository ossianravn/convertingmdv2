# 02A — Architecture and Cloudflare Resources
## Recommended architecture

Use this architecture:

```txt
Client
  ↓
Cloudflare Worker on converting.md
  ↓
Auth middleware
  ↓
Quota / budget middleware
  ↓
Cache lookup
  ↓
Conversion orchestrator
      ├─ native Markdown strategy
      ├─ Workers AI toMarkdown strategy
      └─ Browser Run /markdown strategy
  ↓
Cache write
  ↓
Markdown or JSON response
```

Use a Cloudflare Worker for v1, even if other sites are hosted on Ubuntu/Dokploy.

Dokploy is not needed for v1.

Later, Dokploy can host an admin dashboard, usage dashboard, or billing app.

The conversion endpoint should live on Cloudflare because it can use Workers AI bindings directly and cache close to users.

## Cloudflare resources

Use these Cloudflare resources:

```txt
Cloudflare Worker      Main runtime
Workers AI binding     env.AI.toMarkdown()
D1 database            API keys, quotas, usage counters, logs
KV namespace           Markdown result cache
Worker secrets         Cloudflare API tokens, admin token, API key pepper
```
