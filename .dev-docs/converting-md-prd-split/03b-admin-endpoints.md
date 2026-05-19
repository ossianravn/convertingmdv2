# 03B — Admin Authentication and Endpoints
## Admin authentication

Admin endpoints use:

```http
Authorization: Bearer <ADMIN_TOKEN>
```

Do not allow API keys to call admin endpoints.

Do not allow admin token in query string.

## Admin endpoints

Required endpoints:

```txt
POST  /v1/admin/api-keys
GET   /v1/admin/api-keys
GET   /v1/admin/usage
PATCH /v1/admin/api-keys/:id
```

Create key request:

```json
{
  "name": "Personal key",
  "status": "active",
  "dailyRequestLimit": 1000,
  "monthlyRequestLimit": 25000,
  "allowBrowser": false,
  "autoBrowserFallback": false,
  "dailyBrowserMsLimit": 0,
  "monthlyBrowserMsLimit": 0,
  "allowImages": false,
  "dailyImageLimit": 0,
  "monthlyImageLimit": 0
}
```

Create key response:

```json
{
  "id": "key_...",
  "name": "Personal key",
  "prefix": "cmd_live_abcd",
  "apiKey": "cmd_live_abcd...",
  "createdAt": "2026-05-19T12:00:00.000Z"
}
```

Raw `apiKey` must only appear in this creation response.

## Admin endpoint acceptance criteria

```txt
POST /v1/admin/api-keys creates a key and returns raw key once.
GET /v1/admin/api-keys lists key metadata but never raw keys.
PATCH /v1/admin/api-keys/:id can revoke/reactivate keys and edit quotas/capabilities.
GET /v1/admin/usage returns key/global usage summaries.
All admin endpoints require ADMIN_TOKEN.
```
