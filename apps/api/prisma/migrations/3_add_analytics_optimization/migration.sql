-- Story 011g-b: Analytics Optimization
-- Creates materialized views and indexes for dashboard performance

-- View 1: Dispatch Summary (agregações por status/gateway)
CREATE MATERIALIZED VIEW v_dispatch_summary AS
SELECT
  d.tenant_id,
  d.status,
  w.gateway,
  COUNT(*) as event_count,
  AVG(EXTRACT(EPOCH FROM (d.updated_at - d.created_at))) as avg_latency_seconds,
  MIN(d.created_at) as earliest_event,
  MAX(d.created_at) as latest_event
FROM dispatch_attempts d
JOIN webhook_raw w ON d.webhook_raw_id = w.id
GROUP BY d.tenant_id, d.status, w.gateway;

-- Index for fast queries
CREATE UNIQUE INDEX idx_v_dispatch_summary ON v_dispatch_summary (tenant_id, status, gateway);

-- View 2: Match Rate by Tenant (taxa % diária)
CREATE MATERIALIZED VIEW v_match_rate_by_tenant AS
SELECT
  c.tenant_id,
  DATE(c.created_at) as match_date,
  w.gateway,
  COUNT(*) as total_conversions,
  COUNT(m.id) as matched_conversions,
  ROUND(100.0 * COUNT(m.id) / COUNT(*), 2) as match_rate_percent
FROM conversion c
LEFT JOIN webhook_raw w ON c.webhook_raw_id = w.id
LEFT JOIN match_log m ON c.id = m.conversion_id
GROUP BY c.tenant_id, DATE(c.created_at), w.gateway;

-- Index for fast queries
CREATE UNIQUE INDEX idx_v_match_rate_by_tenant ON v_match_rate_by_tenant (tenant_id, match_date, gateway);

-- Performance Indexes
CREATE INDEX idx_dispatch_attempts_tenant_status_created
ON dispatch_attempts (tenant_id, status, created_at DESC)
WHERE status IN ('sent', 'failed', 'retrying');

CREATE INDEX idx_matches_tenant_created
ON match_log (tenant_id, created_at DESC)
WHERE matched_at IS NOT NULL;

CREATE INDEX idx_conversion_tenant_gateway_created
ON conversion (tenant_id, gateway, created_at DESC);

-- Table to track last refresh time for views
CREATE TABLE IF NOT EXISTS materialized_view_refresh (
  view_name VARCHAR(100) PRIMARY KEY,
  last_refreshed_at TIMESTAMP DEFAULT NOW(),
  refresh_interval_minutes INT DEFAULT 5
);

INSERT INTO materialized_view_refresh (view_name, last_refreshed_at, refresh_interval_minutes)
VALUES
  ('v_dispatch_summary', NOW(), 5),
  ('v_match_rate_by_tenant', NOW(), 5)
ON CONFLICT (view_name) DO UPDATE SET last_refreshed_at = NOW();
