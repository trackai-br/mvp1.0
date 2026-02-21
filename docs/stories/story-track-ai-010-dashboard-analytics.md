# Story Track AI 010 - Dashboard Operacional + Analytics

## Status
**Ready**

## Contexto

Após completar o pipeline end-to-end (Story 009: SQS Dispatch), o sistema está processando conversões em produção mas falta **visibilidade operacional**. Sem dashboard, é impossível:
- Monitorar taxa de sucesso de dispatch (CAPI)
- Debugar falhas em tempo real (DLQ, circuit breaker)
- Rastrear match rate por tenant/gateway
- Analisar performance (latências, throughput)
- Detectar anomalias (drop de eventos, rejeições Meta)

Esta story entrega **Dashboard Operacional** — interface web para visualizar métricas críticas, filtrar por tenant/período/gateway e exportar dados para análise externa.

**Dependência:** Story 009 (SQS Dispatch) MUST be complete ✅

## Agentes AIOS Aplicados

| Agente | Função | Output |
|--------|--------|--------|
| `@architect` | Design do dashboard (layout, componentes, API endpoints, data flow) | Dashboard Architecture Doc |
| `@data-engineer` | Queries de analytics (índices, agregações, materialized views) | Analytics SQL + Query Performance |
| `@dev` | Implementação frontend (Next.js + TanStack Query) + API | Dashboard UI + Endpoints |
| `@qa` | Testes de performance (queries), E2E (navegação), regressions | QA Gate + Performance Report |

## Escopo

### IN (Incluído nesta story)
1. **Frontend Dashboard** (Next.js)
   - Home: Cards com KPIs principais (último 24h, 7d, 30d)
   - Eventos: Tabela filtrável (status, gateway, tenant, período)
   - Falhas: DLQ + Circuit Breaker monitor (com drill-down)
   - Match Rate: Gráfico por tenant/gateway com trending
   - Performance: Latência percentis (p50, p95, p99) + throughput
   - Exports: CSV/JSON para período selecionado

2. **Backend APIs** (Fastify)
   - `GET /api/v1/analytics/metrics` — KPIs agregados
   - `GET /api/v1/analytics/events` — Eventos paginados + filtros
   - `GET /api/v1/analytics/dispatch-attempts` — Tentativas CAPI com erros
   - `GET /api/v1/analytics/match-rate` — Taxa de matching por tenant
   - `GET /api/v1/analytics/performance` — Latência percentis + throughput
   - `GET /api/v1/analytics/export/{format}` — CSV/JSON export

3. **Database Optimization**
   - Indexes: `dispatch_attempts(tenant_id, status, created_at DESC)`
   - Indexes: `matches(tenant_id, created_at DESC)`
   - Views: `v_dispatch_summary` (agregações por status/gateway)
   - Views: `v_match_rate_by_tenant` (taxa % por tenant)

4. **Security & Multi-Tenancy**
   - Query scoping: todas queries filtradas por `tenant_id` via JWT
   - PII masking: não retornar email/phone hashes nas respostas
   - Rate limiting: dashboard queries 10 req/min por tenant
   - Audit log: `GET /api/v1/analytics/*` registrado em `audit_logs`

### OUT (Não incluído)
- Real-time websockets (SSE na Story 011)
- Customização de dashboards por papel (admin/operator)
- Integração com Slack/Telegram alerts
- Relatórios agendados (email)

## Acceptance Criteria

1. **Dashboard Home**
   - [x] Exibe 6 KPIs: total eventos, sucesso %, match rate, latência p95, DLQ backlog, uptime
   - [x] Período selecionável (24h, 7d, 30d, custom)
   - [x] Cards mostram comparação com período anterior (↑/↓)
   - [x] Tenant dropdown para switch (se multi-tenant authorized)

2. **Eventos Tab**
   - [x] Tabela: ID, timestamp, tenant, gateway, status, latência, erro
   - [x] Filters: status (sent/rejected/failed/dlq), gateway, período, search por event_id
   - [x] Pagination: 50 rows/página
   - [x] Click para abrir detail modal (payload redacted, error trace, retry log)

3. **Falhas Tab**
   - [x] DLQ monitor: contagem, gateways com maiores falhas, top 5 erros
   - [x] Circuit breaker status: tripped/ok, última atuação, recovery countdown
   - [x] Retry log: tentativas falhadas com status code + timing

4. **Match Rate Tab**
   - [x] Line chart: taxa (%) por dia, últimos 30d
   - [x] By Gateway: Hotmart, PerfectPay, Kiwify (barras)
   - [x] By Tenant: dropdown para ver por cliente individual
   - [x] Threshold warning: flag se < 70% (user-configurable)

5. **Performance Tab**
   - [x] Latência: p50, p95, p99 em ms (histórico 7d)
   - [x] Throughput: eventos/min (máx, mín, média últimos 24h)
   - [x] Queue depth: depth médio + máximo (SQS + DLQ)
   - [x] Processing time by stage: click → match → dispatch

6. **Backend APIs** (GET /api/v1/analytics/*)
   - [x] `/metrics` — retorna KPIs em JSON (cacheable 30s)
   - [x] `/events` — paginado, filtrado, redacted (sem PII)
   - [x] `/dispatch-attempts` — tentativas CAPI com status
   - [x] `/match-rate` — taxa % por tenant + gateway
   - [x] `/performance` — latência percentis + throughput
   - [x] `/export/{csv,json}` — export período selecionado (max 30d)

7. **Security & Performance**
   - [x] Todas queries escoped por `tenant_id` do JWT
   - [x] PII redaction: email/phone hashes não aparecem nas respostas
   - [x] Rate limit: 10 req/min por endpoint por tenant
   - [x] Query performance: p95 latência < 2s (cached quando possível)
   - [x] Audit log: registra acesso a `GET /api/v1/analytics/*` em `audit_logs`

8. **Responsiveness & Usability**
   - [x] Mobile-friendly (TailwindCSS responsive)
   - [x] Dark mode toggle (opcional, localStorage)
   - [x] Timezone picker (user local ou UTC)
   - [x] Download button para exportar seleção (CSV, JSON)

## Modelo de Dados (Novo)

### Tabelas Novas
```sql
-- Agregações pré-computadas (refresh a cada 5 min via cron job)
CREATE TABLE analytics_metrics_daily (
  id BIGSERIAL PRIMARY KEY,
  tenant_id UUID NOT NULL,
  date DATE NOT NULL,
  total_events INT,
  dispatch_success INT,
  dispatch_failed INT,
  dlq_count INT,
  match_rate NUMERIC(5,2),
  latency_p50 INT,
  latency_p95 INT,
  latency_p99 INT,
  throughput_max INT,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(tenant_id, date)
);

-- Audit log para compliance
CREATE TABLE audit_logs (
  id BIGSERIAL PRIMARY KEY,
  tenant_id UUID NOT NULL,
  user_id UUID,
  action VARCHAR(50) NOT NULL,
  resource VARCHAR(100),
  query_params TEXT,
  timestamp TIMESTAMP DEFAULT NOW(),
  INDEX (tenant_id, timestamp DESC)
);
```

### Indexes (Críticos)
```sql
-- Para queries de eventos rápidas
CREATE INDEX idx_dispatch_attempts_tenant_ts
ON dispatch_attempts(tenant_id, created_at DESC);

CREATE INDEX idx_matches_tenant_ts
ON matches(tenant_id, created_at DESC);

-- Para agregações
CREATE INDEX idx_analytics_daily_tenant
ON analytics_metrics_daily(tenant_id, date DESC);
```

### Views (Opcional, para simplificar queries)
```sql
CREATE VIEW v_dispatch_summary AS
SELECT
  tenant_id,
  DATE(created_at) as date,
  COUNT(*) as total,
  SUM(CASE WHEN status = 'sent' THEN 1 ELSE 0 END) as success,
  SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed,
  PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY latency_ms) as p95_latency
FROM dispatch_attempts
GROUP BY tenant_id, DATE(created_at);
```

## Testing

### Unit Tests
- Analytics queries: correctness for various filters/periods
- PII redaction logic: verify no sensitive data leaks
- Rate limiting: verify 429 after threshold
- Timezone conversions: UTC vs user local

### E2E Tests
- Dashboard loads, KPIs display correctly
- Filters apply (status, gateway, period)
- Export generates valid CSV/JSON
- Detail modal opens and shows event details
- Mobile responsiveness (tablet/phone viewports)

### Performance Tests
- 100k events in query response: < 2s p95
- Concurrent requests handling: 10 users simultaneous
- Memory usage: steady during 5min dashboard use
- Export 30 days of data: < 10s, < 100MB

### QA Gates
- CodeRabbit: No CRITICAL issues (SQL injection, PII exposure)
- Coverage: APIs 80%+, Frontend components 70%+
- Accessibility: WCAG 2.1 AA (color contrast, keyboard nav)
- Responsiveness: tested mobile, tablet, desktop

## Checklist de Qualidade

- [ ] `npm run lint` (no errors)
- [ ] `npm run typecheck` (no errors)
- [ ] `npm test` (100% pass rate)
- [ ] `npm run test:coverage` (80%+ for apis, 70%+ for UI)
- [ ] CodeRabbit review: PASS (no CRITICAL issues)
- [ ] Database migrations applied locally
- [ ] Indexes verified (EXPLAIN ANALYZE)
- [ ] E2E tests (Playwright): all pass
- [ ] Performance tests: latency < 2s
- [ ] Accessibility audit: WCAG 2.1 AA
- [ ] Mobile responsiveness verified

## Dev Notes

- **Query Optimization:** Will need EXPLAIN ANALYZE for large tenant datasets. Consider materialized views for daily aggregations.
- **PII Masking:** Use database-level views or application-layer filtering (recommend both).
- **Real-time Updates:** Story 011 will add SSE for live metric updates. For now, hard refresh only.
- **Caching Strategy:** KPI cards cached 30s (Redis/in-memory). Event table queries not cached (fresh data preferred).
- **Timezone Handling:** Store timestamps as UTC in DB, convert to user timezone at API/UI layer.

## File List (To Update During Development)

- `apps/web/src/app/dashboard/page.tsx` — Dashboard home route
- `apps/web/src/components/dashboard/kpi-cards.tsx` — KPI cards component
- `apps/web/src/components/dashboard/events-table.tsx` — Events table + filters
- `apps/web/src/components/dashboard/failures-monitor.tsx` — DLQ + circuit breaker
- `apps/web/src/components/dashboard/match-rate-chart.tsx` — Match rate visualization
- `apps/web/src/components/dashboard/performance-chart.tsx` — Latency + throughput
- `apps/api/src/routes/analytics.ts` — Analytics API endpoints
- `apps/api/src/services/analytics-service.ts` — Query logic + PII masking
- `apps/api/src/middleware/rate-limit.ts` — Rate limiting for analytics
- `apps/api/tests/e2e/dashboard.e2e.test.ts` — E2E tests
- `apps/api/tests/unit/analytics-service.test.ts` — Service unit tests
- `docs/stories/story-track-ai-010-dashboard-analytics.md` — This file

## Dependencies

| Story | Status | Notes |
|-------|--------|-------|
| Story 009 (SQS Dispatch) | ✅ Complete | MUST be done before starting this story |
| Story 004 (Click Ingestion) | ✅ Complete | Required for event data |
| Story 005 (PerfectPay Webhook) | ✅ Complete | Required for conversion data |
| Story 006 (Pageview/Checkout) | ✅ Complete | For additional event types |
| Story 008 (Match Engine) | ✅ Complete | For match rate metrics |

**No blocking dependencies. Ready to start immediately.**

## CodeRabbit Integration

### Focus Areas
- **SQL Injection:** All dashboard queries must use parameterized queries (no string concat)
- **PII Exposure:** Verify no email/phone hashes in API responses
- **N+1 Queries:** Ensure aggregations use GROUP BY, not loop fetches
- **Performance:** Check for missing indexes on WHERE/ORDER BY clauses
- **Rate Limiting:** Verify middleware enforces 10 req/min correctly
- **Timezone Logic:** Test UTC conversion and DST transitions

### Expected Severity Distribution
- **CRITICAL:** (Block merge) SQL injection, PII exposure
- **HIGH:** (Warn) Missing indexes, N+1 patterns, performance
- **MEDIUM:** (Document) Accessibility, test coverage
- **LOW:** (Note) Style, naming consistency

## Complexity Estimate

**Story Points:** 13 (Large)

| Component | Effort |
|-----------|--------|
| Frontend Dashboard (React/Tailwind) | 5 |
| Backend APIs (Fastify + SQL) | 5 |
| Database Optimization (Views/Indexes) | 2 |
| Testing (E2E + Performance) | 3 |
| **Total** | **15 (rounded to 13)** |

**Timeline Estimate:** 5-6 days (with @architect design + @dev implementation parallel)

## Change Log

- **2026-02-21 River (SM):** Initial draft created. Story 009 now complete, dashboard ready for development.
- **2026-02-21 Pax (PO):** Story validated — 9/10 checklist (90%). Decision: ✅ **GO**
  - All AC clear and testable
  - Dependencies complete (Story 009 ✅)
  - Complexity well-estimated (13 pts)
  - Risks identified in Dev Notes (query optimization, PII masking, timezone)
  - Marked READY for development

---

**Next Steps:**
1. @dev implements (activate with `*develop story-track-ai-010-dashboard-analytics`)
2. @qa gates before deployment
