# Story Track AI 011g – Production-Ready: Tech Debt + Analytics + Monitoring + Go-Live

**Story ID:** 011g
**Epic:** EPIC-011 — MVP Launch & Multi-Gateway Integration
**Status:** Ready to Draft

## Contexto

Após completar Phase 1 (deploy) e Phase 2 (gateways), falta preparar produção para o lançamento real: resolver tech debt crítico (raw body capture), otimizar analytics (materialized views), implementar observabilidade (CloudWatch alarms + PagerDuty) e executar go-live checklist.

**Esta mega-story consolida 3 sub-tasks em paralelo:**
- `011g-a`: Tech Debt (raw body)
- `011g-b`: Analytics Optimization
- `011g-c`: Production Monitoring

Depois de todas completas: **Go-Live Checklist** + First Customer Onboarding.

## Agentes Envolvidos
- `@architect` (Aria): Design raw body capture
- `@dev` (Dex): Implementação raw body
- `@data-engineer` (Dara): Analytics views + optimization
- `@devops` (Gage): CloudWatch alarms + PagerDuty integration
- `@pm` (Morgan): Go-Live Checklist orchestration

## Dependências

- Stories 011a/b/c (Phase 1) ✅ DONE
- Stories 011d/e/f (Phase 2 gateways) ✅ READY
- Todos 3 sub-tasks devem estar DONE antes de Go-Live Checklist

## SUBTASK 011g-a: Tech Debt — Raw Body Capture

**Assignee:** @dev (Dex)
**Points:** 2

### Contexto
Story 005 QA identificou issue MEDIUM: `JSON.stringify(body)` pode divergir do body original. Solução: Fastify plugin `@fastify/raw-body`.

### Tasks

- [ ] `npm install @fastify/raw-body` em apps/api
- [ ] Registrar plugin em `apps/api/src/server.ts` antes de routes
- [ ] Update todos webhook handlers para usar `request.rawBody` em HMAC validation
- [ ] Testes: Verify HMAC com body original
- [ ] Performance test: overhead < 10ms

### Critérios de Aceite

- [x] Plugin registrado
- [x] Todos webhooks (PerfectPay, Hotmart, Kiwify, Stripe) usando raw body
- [x] HMAC validation funciona 100%
- [x] Zero performance degradation
- [x] Testes atualizado + passando

### Deadline: 72-96h

---

## SUBTASK 011g-b: Analytics Optimization

**Assignee:** @data-engineer (Dara)
**Points:** 3

### Contexto
Dashboard (Story 010) usa agregações em-time. Com 1M+ events/dia, queries ficarão lentas. Materialized views + cron job refresh resolve.

### Tasks

- [ ] Criar view `v_dispatch_summary` (status, gateway, count aggregations)
- [ ] Criar view `v_match_rate_by_tenant` (tenant, date, match_rate %)
- [ ] Criar índices:
  - `dispatch_attempts(tenant_id, status, created_at DESC)`
  - `matches(tenant_id, created_at DESC)`
- [ ] Criar cron job refresh (5 min interval via `pg_cron` ou Node.js scheduler)
- [ ] Load test com 1M rows: verify < 500ms latency
- [ ] Update dashboard queries para usar views

### Queries Otimizadas

```sql
-- Before: 2s (full table scan)
SELECT COUNT(*) as total_events,
       COUNT(CASE WHEN status='sent' THEN 1 END) as success_count
FROM dispatch_attempts
WHERE tenant_id = $1 AND created_at > NOW() - INTERVAL '24h';

-- After: 200ms (materialized view)
SELECT total_events, dispatch_success
FROM analytics_metrics_daily
WHERE tenant_id = $1 AND date = CURRENT_DATE;
```

### Critérios de Aceite

- [x] Views criadas + indexed
- [x] Cron job executando a cada 5 min
- [x] Query latency p95 < 500ms (agregação)
- [x] Dashboard queries updated
- [x] Zero timeouts
- [x] Data freshness < 5 min verificado

### Deadline: 72-96h

---

## SUBTASK 011g-c: Production Monitoring & Alerting

**Assignee:** @devops (Gage)
**Points:** 3

### Contexto
Produção sem alarms é risco operacional. CloudWatch alarms + PagerDuty integration + runbooks.

### Tasks

- [ ] CloudWatch alarm: DLQ depth > 100 (30 min sustained) → CRITICAL
- [ ] CloudWatch alarm: Circuit breaker OPEN > 3 min → HIGH
- [ ] CloudWatch alarm: Meta token expires < 24h → HIGH
- [ ] CloudWatch alarm: Webhook success rate < 95% (1h window) → CRITICAL
- [ ] CloudWatch alarm: Database connections > 80% pool → HIGH
- [ ] CloudWatch alarm: ECS service CPU > 80% (1 min) → MEDIUM
- [ ] CloudWatch alarm: SQS queue depth > 1000 → HIGH
- [ ] CloudWatch alarm: API latency p95 > 5s → MEDIUM
- [ ] Create CloudWatch dashboard (real-time):
  - Throughput (events/sec)
  - Latency p50/p95/p99
  - Success rate %
  - DLQ depth
  - Circuit breaker state
  - DB connections
  - SQS queue depth
- [ ] PagerDuty integration (critical alarms → oncall)
- [ ] Runbook: DLQ Troubleshooting (5 steps)
- [ ] Runbook: Circuit Breaker Trip (3 steps)
- [ ] Test each alarm with false positive

### CloudWatch Dashboard Layout

```
[KPI Cards: Top 6]
├─ Throughput (events/sec)
├─ Success Rate (%)
├─ Latency p95 (ms)
├─ DLQ Depth
├─ Match Rate (%)
└─ Uptime (%)

[Graphs: 1h window]
├─ Throughput trend
├─ Latency percentiles (p50, p95, p99)
├─ Success rate trend
└─ DLQ depth over time

[Alarms Status: Active]
└─ List of 8 alarms + state
```

### Critérios de Aceite

- [x] 8+ alarms criados + testados
- [x] Cada alarm dispara em teste
- [x] PagerDuty recebe notifications
- [x] CloudWatch dashboard criado
- [x] Runbooks finalizados + acessíveis
- [x] Team trained

### Deadline: 96-120h

---

## PHASE 4: Go-Live Checklist

**Assignee:** @pm (Morgan)
**Points:** 2

### Após todos 3 sub-tasks 011g-a/b/c DONE:

### Tasks

- [ ] Verify all deployments in production
- [ ] Smoke test: 1 click → CAPI end-to-end
  - [ ] POST /api/v1/track/click (staging tenant)
  - [ ] POST /api/v1/webhooks/perfectpay (test conversion)
  - [ ] Verify conversion in Postgres
  - [ ] Verify SQS dispatch
  - [ ] Verify Meta CAPI received event
- [ ] Performance baseline:
  - [ ] Collect p50/p95/p99 latency (first 1h)
  - [ ] Measure throughput
  - [ ] Check error rates
- [ ] Runbooks reviewed by team (15 min)
- [ ] On-call schedule activated (PagerDuty)
- [ ] Customer onboarded + first funnel configured
- [ ] Real events flowing through pipeline
- [ ] Production logs healthy (no CRITICAL errors)
- [ ] Database backups running (7d retention)
- [ ] TLS certificates valid

### Go-Live Checklist (20 items)

#### Infrastructure
- [ ] AWS SQS queues created + tested (capi-dispatch, capi-dispatch-dlq)
- [ ] Secrets Manager populated (meta_capi_token, perfectpay_secret, hotmart_secret, kiwify_secret, stripe_secret)
- [ ] ECS services running with 2+ replicas
- [ ] RDS PostgreSQL healthy + backups enabled
- [ ] CloudWatch dashboards live
- [ ] Alarms firing + PagerDuty integrated

#### Code
- [ ] All story deployments verified in prod
- [ ] TypeScript/lint checks passing
- [ ] Tests running in CI/CD
- [ ] Feature flags configured (per-gateway rollout)

#### Data
- [ ] Database migrations applied
- [ ] First tenant created (test)
- [ ] First funnel configuration tested
- [ ] Sample click generated + converted
- [ ] Data visible in dashboard

#### Monitoring
- [ ] CloudWatch metrics flowing
- [ ] Dashboard displaying real data
- [ ] Alarms tested (false positive)
- [ ] Logs aggregated + searchable

#### Team
- [ ] On-call rotation assigned
- [ ] Runbooks accessible (wiki/docs)
- [ ] Incident response plan reviewed
- [ ] 24h support contact configured
- [ ] Team confident in production operations

### Critérios de Aceite

- [x] All 20 checklist items signed off
- [x] First customer can login + see metrics
- [x] First conversion arrived in Meta CAPI
- [x] Team confident in operations

### Deadline: 120-168h (Friday)

---

## File List

**011g-a (Tech Debt):**
- `apps/api/src/server.ts` (raw body plugin)
- `apps/api/src/perfectpay-webhook-handler.ts` (update to use raw body)
- `apps/api/src/hotmart-webhook-handler.ts` (update)
- `apps/api/src/kiwify-webhook-handler.ts` (update)
- `apps/api/src/stripe-webhook-handler.ts` (update)

**011g-b (Analytics):**
- `apps/api/prisma/migrations/` (views + indexes)
- `apps/api/src/analytics/refresh-views.ts` (cron job)

**011g-c (Monitoring):**
- `.github/workflows/monitoring-setup.yml` (CloudWatch + PagerDuty)
- `docs/runbooks/dlq-troubleshooting.md`
- `docs/runbooks/circuit-breaker-trip.md`

**011g (Go-Live):**
- `docs/GO-LIVE-CHECKLIST.md`

## Change Log

- Story 011g criada por @sm (River) — 2026-02-24. Source: EPIC-011 Phase 3 + 4.
- Pronta para execução paralela de 3 sub-tasks.

---

**Assignee:** @architect, @dev, @data-engineer, @devops, @pm (equipe)
**Points:** 10 total (2+3+3+2)
**Priority:** CRITICAL (Last before launch)
**Deadline:** 72-168h
**Paralelo:** 011g-a/b/c executam em paralelo
**Sequencial:** 011g (go-live) após todos 3 sub-tasks DONE
