-- Geocode service schema (Phase 1)

CREATE TABLE IF NOT EXISTS geocode_logs (
  id BIGSERIAL PRIMARY KEY,
  ts TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  log_date DATE NOT NULL DEFAULT (CURRENT_DATE AT TIME ZONE 'Asia/Hong_Kong')::date,
  level VARCHAR(16) NOT NULL,
  event VARCHAR(64) NOT NULL,
  session_id VARCHAR(128) NOT NULL,
  address TEXT,
  provider_id VARCHAR(64),
  payload JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_geocode_logs_log_date ON geocode_logs (log_date);
CREATE INDEX IF NOT EXISTS idx_geocode_logs_session_id ON geocode_logs (session_id);
CREATE INDEX IF NOT EXISTS idx_geocode_logs_event ON geocode_logs (event);
CREATE INDEX IF NOT EXISTS idx_geocode_logs_ts ON geocode_logs (ts DESC);

CREATE TABLE IF NOT EXISTS lamp_posts (
  id SERIAL PRIMARY KEY,
  lamp_post_id VARCHAR(32) NOT NULL,
  road_zh VARCHAR(255),
  road_en VARCHAR(255),
  district VARCHAR(64),
  lat DOUBLE PRECISION NOT NULL,
  lng DOUBLE PRECISION NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (lamp_post_id)
);

CREATE INDEX IF NOT EXISTS idx_lamp_posts_road_zh ON lamp_posts (road_zh);

CREATE TABLE IF NOT EXISTS api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key_prefix VARCHAR(16) NOT NULL,
  key_hash CHAR(64) NOT NULL UNIQUE,
  name VARCHAR(128) NOT NULL,
  description TEXT,
  is_admin BOOLEAN NOT NULL DEFAULT FALSE,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_used_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  created_by VARCHAR(128),
  daily_quota INTEGER,
  rate_limit_per_minute INTEGER
);

CREATE INDEX IF NOT EXISTS idx_api_keys_key_hash ON api_keys (key_hash);
CREATE INDEX IF NOT EXISTS idx_api_keys_enabled ON api_keys (enabled);

ALTER TABLE api_keys ADD COLUMN IF NOT EXISTS daily_quota INTEGER;
ALTER TABLE api_keys ADD COLUMN IF NOT EXISTS rate_limit_per_minute INTEGER;

ALTER TABLE geocode_logs ADD COLUMN IF NOT EXISTS client_ip VARCHAR(45);
ALTER TABLE geocode_logs ADD COLUMN IF NOT EXISTS user_agent TEXT;
ALTER TABLE geocode_logs ADD COLUMN IF NOT EXISTS api_key_id VARCHAR(64);
ALTER TABLE geocode_logs ADD COLUMN IF NOT EXISTS api_key_name VARCHAR(128);
ALTER TABLE geocode_logs ADD COLUMN IF NOT EXISTS http_method VARCHAR(8);
ALTER TABLE geocode_logs ADD COLUMN IF NOT EXISTS http_path VARCHAR(256);
ALTER TABLE geocode_logs ADD COLUMN IF NOT EXISTS status_code SMALLINT;
ALTER TABLE geocode_logs ADD COLUMN IF NOT EXISTS duration_ms INTEGER;
ALTER TABLE geocode_logs ADD COLUMN IF NOT EXISTS request_id VARCHAR(64);
ALTER TABLE geocode_logs ADD COLUMN IF NOT EXISTS auth_mode VARCHAR(32);

CREATE INDEX IF NOT EXISTS idx_geocode_logs_api_key_id ON geocode_logs (api_key_id);
CREATE INDEX IF NOT EXISTS idx_geocode_logs_client_ip ON geocode_logs (client_ip);
CREATE INDEX IF NOT EXISTS idx_geocode_logs_request_id ON geocode_logs (request_id);

-- Geocode result cache (Plan B): semantic keys + TTL
CREATE TABLE IF NOT EXISTS geocode_cache (
  cache_key VARCHAR(128) PRIMARY KEY,
  kind VARCHAR(32) NOT NULL,
  query_text TEXT,
  provider_id VARCHAR(64),
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION,
  result_json JSONB NOT NULL,
  source_input_hash CHAR(64),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  last_hit_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_geocode_cache_expires_at ON geocode_cache (expires_at);
CREATE INDEX IF NOT EXISTS idx_geocode_cache_kind ON geocode_cache (kind);
CREATE INDEX IF NOT EXISTS idx_geocode_cache_last_hit ON geocode_cache (last_hit_at DESC NULLS LAST);
