-- Add analytics views for dashboard queries
-- Story 010: Dashboard Operacional

-- View: v_dispatch_summary — Dispatch attempts summary by tenant and date
CREATE OR REPLACE VIEW v_dispatch_summary AS
SELECT
  t.id as tenant_id,
  DATE(da.created_at) as date,
  COUNT(*) as total_attempts,
  SUM(CASE WHEN da.status = 'success' THEN 1 ELSE 0 END) as success_count,
  SUM(CASE WHEN da.status = 'failed' THEN 1 ELSE 0 END) as failed_count,
  SUM(CASE WHEN da.status = 'pending' THEN 1 ELSE 0 END) as dlq_count,
  -- Simulated latency percentile (will be calculated from dispatch_attempts table)
  PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY 0)::int as latency_p95
FROM "Tenant" t
LEFT JOIN "DispatchAttempt" da ON t.id = da."tenantId"
WHERE da.created_at IS NULL OR da.created_at >= NOW() - INTERVAL '90 days'
GROUP BY t.id, DATE(da.created_at);

-- View: v_match_rate_by_tenant — Match rate analytics by tenant and date
CREATE OR REPLACE VIEW v_match_rate_by_tenant AS
SELECT
  c.tenant_id,
  DATE(c.created_at) as date,
  c.gateway,
  COUNT(*) as total_conversions,
  SUM(CASE WHEN ml.final_click_id IS NOT NULL THEN 1 ELSE 0 END) as matched_conversions,
  ROUND(
    100.0 * SUM(CASE WHEN ml.final_click_id IS NOT NULL THEN 1 ELSE 0 END) / NULLIF(COUNT(*), 0),
    2
  ) as match_rate_pct
FROM "Conversion" c
LEFT JOIN "MatchLog" ml ON c.id = ml.conversion_id
WHERE c.created_at >= NOW() - INTERVAL '90 days'
GROUP BY c.tenant_id, DATE(c.created_at), c.gateway;

-- View: v_match_rate_by_tenant_aggregated — Aggregated match rate for all gateways
CREATE OR REPLACE VIEW v_match_rate_by_tenant_aggregated AS
SELECT
  tenant_id,
  date,
  'all' as gateway,
  SUM(total_conversions) as total_conversions,
  SUM(matched_conversions) as matched_conversions,
  ROUND(
    100.0 * SUM(matched_conversions) / NULLIF(SUM(total_conversions), 0),
    2
  ) as match_rate_pct
FROM v_match_rate_by_tenant
GROUP BY tenant_id, date;
