CREATE TABLE api_keys (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  prefix TEXT NOT NULL,
  key_hash TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'active',

  daily_request_limit INTEGER NOT NULL DEFAULT 1000,
  monthly_request_limit INTEGER NOT NULL DEFAULT 25000,

  allow_browser INTEGER NOT NULL DEFAULT 0,
  auto_browser_fallback INTEGER NOT NULL DEFAULT 0,
  daily_browser_ms_limit INTEGER NOT NULL DEFAULT 0,
  monthly_browser_ms_limit INTEGER NOT NULL DEFAULT 0,

  allow_images INTEGER NOT NULL DEFAULT 0,
  daily_image_limit INTEGER NOT NULL DEFAULT 0,
  monthly_image_limit INTEGER NOT NULL DEFAULT 0,

  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  last_used_at TEXT
);

CREATE INDEX idx_api_keys_hash ON api_keys(key_hash);
CREATE INDEX idx_api_keys_prefix ON api_keys(prefix);

CREATE TABLE usage_counters (
  scope TEXT NOT NULL,
  scope_id TEXT NOT NULL,
  period TEXT NOT NULL,
  period_key TEXT NOT NULL,

  requests INTEGER NOT NULL DEFAULT 0,
  native_requests INTEGER NOT NULL DEFAULT 0,
  ai_requests INTEGER NOT NULL DEFAULT 0,
  browser_requests INTEGER NOT NULL DEFAULT 0,
  image_requests INTEGER NOT NULL DEFAULT 0,

  browser_ms_used INTEGER NOT NULL DEFAULT 0,
  browser_ms_reserved INTEGER NOT NULL DEFAULT 0,

  bytes_in INTEGER NOT NULL DEFAULT 0,
  bytes_out INTEGER NOT NULL DEFAULT 0,

  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,

  PRIMARY KEY (scope, scope_id, period, period_key)
);

CREATE TABLE conversion_events (
  id TEXT PRIMARY KEY,
  api_key_id TEXT,
  request_id TEXT NOT NULL,
  url_hash TEXT NOT NULL,
  host TEXT NOT NULL,
  method TEXT,
  status TEXT NOT NULL,
  status_code INTEGER NOT NULL,
  cache_status TEXT NOT NULL,
  source_content_type TEXT,
  input_bytes INTEGER NOT NULL DEFAULT 0,
  output_bytes INTEGER NOT NULL DEFAULT 0,
  browser_ms_used INTEGER NOT NULL DEFAULT 0,
  error_code TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX idx_conversion_events_key_time
  ON conversion_events(api_key_id, created_at);

CREATE INDEX idx_conversion_events_host_time
  ON conversion_events(host, created_at);
