-- Migration: Analytics Indexes and Views for Story 010
-- Dashboard Operacional requires optimized queries for historical data

-- Table: analytics_metrics_daily (pre-computed aggregations)
CREATE TABLE IF NOT EXISTS analytics_metrics_daily (
  id BIGSERIAL PRIMARY KEY,
  tenant_id UUID NOT NULL,
  date DATE NOT NULL,
  total_events INT DEFAULT 0,
  dispatch_success INT DEFAULT 0,
  dispatch_failed INT DEFAULT 0,
  dlq_count INT DEFAULT 0,
  match_rate NUMERIC(5,2),
  latency_p50 INT,
  latency_p95 INT,
  latency_p99 INT,
  throughput_max INT,
  created_at TIMESTAMP DEFAULT NOW(),
  CONSTRAINT uq_analytics_metrics_daily UNIQUE(tenant_id, date)
);

-- Table: audit_logs (compliance + debugging)
CREATE TABLE IF NOT EXISTS audit_logs (
  id BIGSERIAL PRIMARY KEY,
  tenant_id UUID NOT NULL,
  user_id UUID,
  action VARCHAR(50) NOT NULL,
  resource VARCHAR(100),
  query_params TEXT,
  timestamp TIMESTAMP DEFAULT NOW()
);

-- Index: Fast lookup for dispatch_attempts queries
CREATE INDEX IF NOT EXISTS idx_dispatch_attempts_tenant_status_ts
  ON dispatch_attempts(tenant_id, status, created_at DESC);

-- Index: Fast lookup for matches queries
CREATE INDEX IF NOT EXISTS idx_matches_tenant_ts
  ON matches(tenant_id, created_at DESC);

-- Index: Analytics daily aggregations
CREATE INDEX IF NOT EXISTS idx_analytics_metrics_daily_tenant
  ON analytics_metrics_daily(tenant_id, date DESC);

-- Index: Audit logs lookup
CREATE INDEX IF NOT EXISTS idx_audit_logs_tenant_ts
  ON audit_logs(tenant_id, timestamp DESC);

-- View: Dispatch summary aggregations
CREATE OR REPLACE VIEW v_dispatch_summary AS
SELECT
  tenant_id,
  DATE(created_at) as date,
  COUNT(*) as total_attempts,
  SUM(CASE WHEN status = 'sent' THEN 1 ELSE 0 END) as success_count,
  SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed_count,
  SUM(CASE WHEN status = 'dlq' THEN 1 ELSE 0 END) as dlq_count,
  PERCENTILE_CONT(0.50) WITHIN GROUP (ORDER BY latency_ms) as latency_p50,
  PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY latency_ms) as latency_p95,
  PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY latency_ms) as latency_p99,
  MAX(latency_ms) as latency_max
FROM dispatch_attempts
WHERE tenant_id IS NOT NULL
GROUP BY tenant_id, DATE(created_at);

-- View: Match rate by tenant
CREATE OR REPLACE VIEW v_match_rate_by_tenant AS
SELECT
  t.id as tenant_id,
  DATE(c.created_at) as date,
  COUNT(c.id) as total_conversions,
  COUNT(m.id) as matched_conversions,
  ROUND(
    CASE
      WHEN COUNT(c.id) = 0 THEN 0
      ELSE (COUNT(m.id)::NUMERIC / COUNT(c.id) * 100)
    END,
    2
  ) as match_rate_pct
FROM tenants t
LEFT JOIN conversions c ON c.tenant_id = t.id
LEFT JOIN matches m ON m.conversion_id = c.id AND m.deleted_at IS NULL
WHERE t.status = 'active'
GROUP BY t.id, DATE(c.created_at)
ORDER BY t.id, DATE(c.created_at) DESC;
