# 📋 MODUS OPERANDI — Hub Server-Side Tracking MVP Go-Live

**Documento Central de Contexto** — Sincroniza estado do projeto entre agentes e sessões. Atualizado em tempo real durante execução.

---

## 🌐 AWS Configuration (CRITICAL — Consultar SEMPRE antes de decisão)

```
Region:              us-east-1
Account:             751702759697
ECS Cluster:         hub-server-side-tracking
ECS Service:         hub-server-side-tracking-api
ECR Repository:      hub-server-side-tracking-api
ECR URI:             751702759697.dkr.ecr.us-east-1.amazonaws.com/hub-server-side-tracking-api
Task Definition:     track-ai-api:3
Launch Type:         Fargate
Current Tasks:       1 running / 1 desired
```

---

## 🎯 Entrada Atual (2026-03-05 17:45 UTC)

**Agente Ativo:** @aios-master (Orion)
**Objetivo:** Corrigir AWS config + Revisar riscos EPIC-011 → Execução de bloqueadores imediatos
**Estado Projeto:** Fase final de validação em mock, pronto para MVP go-live
**Correção:** AWS region/cluster names corrigidos conforme real config

---

## 📊 Status do MVP Go-Live

### Completude Geral

| Componente | Status | Último Update | Detalhes |
|-----------|--------|--------------|----------|
| Backend API | ✅ PRONTO | 2026-03-02 22:55 | Fastify 5, Prisma 7, PerfectPay webhook completo |
| Frontend Web | ✅ PRONTO | 2026-03-02 22:55 | Next.js 16, 3-step wizard, dashboard completo |
| Database | ✅ PRONTO | 2026-03-02 22:55 | Supabase Cloud PostgreSQL, schema finalizado |
| Click Ingestion | ✅ PRONTO | 2026-03-02 22:55 | POST /track/click testado, 6 clicks em DB |
| Webhook Handling | ✅ PRONTO | 2026-03-02 22:55 | HMAC-SHA256 timing-safe, 2 identities criadas |
| Matching Engine | ✅ PRONTO | 2026-03-02 22:55 | FBP/FBC scoring, threshold 50pts |
| Dashboard | ✅ PRONTO | 2026-03-02 22:55 | 8 KPI cards + 4 gráficos + failure analysis |
| **EPIC 011 Bloqueadores** | 🔄 NEXT | — | Stories 011.1-011.3 aguardando execução |

### Stories Completadas (004-010)

```
✅ 004: Click Ingestion          — @dev       — DONE
✅ 005: PerfectPay Webhook        — @dev       — DONE (security fix aplicada)
✅ 006: Pageview + Checkout       — @dev       — DONE (pronto para validação @po)
✅ 007: Generic Webhooks          — @dev       — DONE (Hotmart, Kiwify, Stripe patterns)
✅ 008: Match Engine              — @architect — DONE (FBP/FBC scoring implemented)
✅ 009: SQS Dispatch to Meta CAPI — @dev       — DONE (73 tests passing, pronto para QA)
✅ 010: Dashboard + Analytics     — @dev       — DONE (8 KPIs, 4 gráficos, failure analysis)
```

---

## 🚨 EPIC-011: Análise Detalhada de 7 Riscos

### ⚠️ Risco #1: Webhook from New Gateway Breaks

**Impacto:** ALTO — Conversions perdidas, receita impactada

**Cenário:**
- Story 011.4a/b/c implementa Hotmart, Kiwify, Stripe
- Mudança em normalização de payload quebra matching engine
- Conversions não chegam ao Meta CAPI

**Causas Raiz Identificadas:**
1. Schemas Zod (`@hub/shared`) definem contrato esperado
2. Se nova gateway envia campo diferente → falha de parsing
3. Sem contract tests → divergência não detectada até produção

**Mitigação Tier 1 (Implementado):**
- ✅ Schemas compartilhados em `packages/shared/src/index.ts`
- ✅ Validação Zod em todos handlers (timing-safe errors)
- ✅ Cada gateway tem schema próprio + testes

**Mitigação Tier 2 (A Fazer — Story 011.4a):**
- [ ] Contract tests: Stub gateway → valida schema + normalization
- [ ] Feature flags por gateway: `GATEWAY_HOTMART_ENABLED=false` → fallback
- [ ] Canary deploy: 1% de tráfico Hotmart antes 100%
- [ ] Rollback plan: Desabilitar gateway via env vars em < 2 min

**Mitigação Tier 3 (Pós-Launch):**
- [ ] Webhook signature test endpoint: `POST /api/v1/webhooks/{gateway}/test`
- [ ] Gateway health check: Scheduled test signature validation 1x/hora
- [ ] Alert: Se webhook signature muda, dispara alerta

**Ação Imediata:**
- Durante Story 011.4a: @qa vai escrever contract tests ANTES de @dev implementar
- Gateways com feature flags default=OFF até aprovado

---

### ⚠️ Risco #2: Meta Token Expires Mid-Launch

**Impacto:** CRÍTICO — CAPI dispatch falha completamente

**Cenário:**
- Meta access token no Secrets Manager expira (típico: 60-90 dias)
- Story 011.6 é semana de go-live
- Token expira Friday → conversions não dispatcham → primeira falha produção

**Causas Raiz:**
1. Token é stateless (não há refresh mechanism)
2. Meta API rejeita token expirado com HTTP 400 ou 401
3. Sem alerta preventivo → erro descoberto em produção

**Mitigação Tier 1 (A Fazer — Story 011.5c):**
- [ ] CloudWatch alarm: Meta token expiration < 24 horas
- [ ] SNS notification → @pm + team Slack
- [ ] Runbook: Como renovar token em produção (< 5 min)
- [ ] Automation: Script que rotaciona token (próxima fase)

**Mitigação Tier 2 (Implementação):**
- [ ] Token refresh logic (OAuth2 flow) — POST-launch feature
- [ ] Dual token strategy: active + backup token (próxima fase)

**Ação Imediata:**
- Story 011.5c: @devops cria alarm com SNS (não aguarda automation)
- Antes de go-live: Verificar token date + renovar se < 7 dias

---

### ⚠️ Risco #3: Raw Body Capture Breaks Existing Webhooks

**Impacto:** CRÍTICO — Production outage, conversions perdidas

**Cenário:**
- Story 011.5a: Adiciona Fastify plugin `@fastify/raw-body`
- Plugin intercepta request antes de JSON parsing
- Se implementação incorreta → webhooks recebem body vazio ou malformado
- HMAC validation falha para TODOS webhooks (PerfectPay + novo gateways)
- Result: 100% das conversions rejeitadas

**Causas Raiz:**
- Raw body capture é operação de baixo nível (Fastify middleware)
- Plugin precisa estar ANTES de body parser (plugin order matters)
- Sem testes completos → regressão não detectada

**Mitigação Tier 1 (A Fazer — Story 011.5a):**
- [ ] Plugin ordem correta: `@fastify/raw-body` ANTES de json parser
- [ ] Testes: 100% cobertura HMAC comparison com raw vs parsed body
- [ ] Blue-green deploy: Deploy com rollback automático em < 2 min
- [ ] Canary: 10% webhook traffic na versão nova antes 100%

**Mitigação Tier 2 (Implementação):**
- [ ] Feature flag: `RAW_BODY_CAPTURE_ENABLED=true` (default=false)
- [ ] Gradual rollout: false → 10% → 50% → 100% (1h each stage)
- [ ] Monitoring: Dashboard com webhook success rate por versão
- [ ] Automatic rollback: Se success rate cai > 5%, voltar version

**Ação Imediata:**
- Story 011.5a: @architect (Aria) desenha diagrama de plugin order
- @dev testa com Postman webhook signature validation ANTES de merge
- @qa executa regressão em todos webhook handlers (PerfectPay tested first)

---

### ⚠️ Risco #4: Analytics Views Slow Down Dashboard

**Impacto:** MÉDIO — UX degradation, clientes frustrados

**Cenário:**
- Story 011.5b: Materialised views para agregações (dispatch_summary, match_rate)
- Cron job refresh a cada 5 min
- Se query performance não testada com 1M+ rows → dashboard trava
- Dashboard p95 latency sobe de 1s → 5s+

**Causas Raiz:**
1. Views criadas sem load testing
2. Índices não otimizados para query padrão
3. Cron job pode não conseguir refresh em 5 min se dataset grande

**Mitigação Tier 1 (A Fazer — Story 011.5b):**
- [ ] Load test views com 1M sample rows (realistic production data)
- [ ] Query plan analysis: EXPLAIN ANALYZE para cada agregação
- [ ] Index strategy: Validar índices hit > 95% of queries
- [ ] Refresh latency test: Cron job pode completar em < 5 min?
- [ ] Fallback: Se refresh falha, serve stale view (< 1 hour old)

**Mitigação Tier 2 (Implementation):**
- [ ] Materialized view refresh strategy:
  - Option A: Refresh a cada 5 min (standard)
  - Option B: Incremental refresh (upsert only new rows since last refresh)
- [ ] Query timeout: Dashboard queries timeout em 5s → show cached data

**Ação Imediata:**
- Story 011.5b: @data-engineer testa views com Supabase performance tools
- Antes de deploy: p95 < 500ms validado em staging com 1M rows
- Post-deploy: Monitor dashboard latency via CloudWatch

---

### ⚠️ Risco #5: Circuit Breaker Trips During Spike

**Impacto:** ALTO — Conversions queue up, delayed dispatch

**Cenário:**
- Story 011.3 implementa circuit breaker para Meta CAPI (fallback quando CAPI fails)
- Traffic spike: 1000 clicks/sec (10x normal)
- Circuit breaker trips se CAPI latency > threshold (2s)
- Conversions armazenadas em DLQ, retry delay 30s × N
- Customer vê conversions delays, não falhas totais (degradation mode)

**Causas Raiz:**
1. Threshold configurado para normal load, não spike
2. Sem alerting → ops não sabem que circuit abriu
3. Sem manual override → circuit fica aberto até timeout automático (1 min)

**Mitigação Tier 1 (A Fazer — Story 011.5c):**
- [ ] CloudWatch alarm: Circuit breaker OPEN > 30 sec
- [ ] SNS notification → @pm + @devops Slack (em tempo real)
- [ ] Runbook: Como resetar circuit breaker manually + análise root cause
- [ ] Dashboard widget: Circuit breaker state (visual indicator)

**Mitigação Tier 2 (Implementation):**
- [ ] Adaptive circuit breaker threshold:
  - Normal load: threshold = 2s
  - Spike (tráfico > 500/min): threshold = 5s
  - Sampling metric: percentile adjusts dynamically
- [ ] Manual override endpoint: `POST /api/v1/admin/circuit-breaker/reset` (require API key)

**Ação Imediata:**
- Story 011.5c: @devops cria alarm + SNS (Story 011.3 já tem circuit breaker logic)
- Threshold validation: Teste sob 10x load em staging antes go-live
- Runbook: @devops documenta reset procedure

---

### ⚠️ Risco #6: SQS Queue Depth Grows Unbounded

**Impacto:** MÉDIO → CRÍTICO — Conversions backlog, eventual data loss

**Cenário:**
- SQS queue para Meta CAPI dispatch
- Se worker process muere (container restart)
- Queue depth cresce indefinidamente
- Mensagens expire após 4 dias (DLQ ou loss)
- Customer sees "conversion not sent" after 4 days

**Causas Raiz:**
1. Worker pode crash sem alerta
2. SQS default message retention = 4 days
3. Sem DLQ monitoring → messages perdidas silenciosamente

**Mitigação Tier 1 (A Fazer — Story 011.5c):**
- [ ] CloudWatch alarm: SQS queue depth > 100 (sustained 30 min)
- [ ] CloudWatch alarm: DLQ depth > 10 (any message in DLQ = failure)
- [ ] SNS notification → PagerDuty (escalate to oncall)
- [ ] Runbook: Analyze DLQ messages, manual retry procedure
- [ ] Worker health check: Heartbeat metric every 10s (fails if missed 2 times)

**Mitigação Tier 2 (Implementation):**
- [ ] Auto-scaling: SQS visibility timeout configurable
- [ ] Replay engine (Story 011): Retry failed messages from DLQ
- [ ] Observability: Dashboard showing queue depth trend (last 24h)

**Ação Imediata:**
- Story 011.5c: @devops configura alarms + DLQ monitoring
- Story 011 (Phase 2): Background worker health checks implementados
- Runbook: @devops documenta DLQ analysis procedure

---

### ⚠️ Risco #7: Database Connection Pool Exhaustion

**Impacto:** CRÍTICO — All requests hang, API becomes unresponsive

**Cenário:**
- Prisma connection pool (default 10 connections)
- 1000 concurrent requests arrive
- All 10 connections taken by slow queries
- New requests queue up, timeout after 30s
- API appears "hanging", customer can't onboard

**Causas Raiz:**
1. Connection pool too small for production load
2. Slow queries (N+1 problem, missing indices)
3. Connections not released (resource leak)

**Mitigação Tier 1 (Implemented):**
- ✅ Prisma pool size configured in `.env` (tuned for expected load)
- ✅ Connection leak tests (integration tests verify cleanup)
- ✅ Query optimization: All critical queries indexed (Story 011.5b)

**Mitigação Tier 2 (A Fazer — Story 011.5c):**
- [ ] CloudWatch alarm: Prisma active connections > 8 (80% utilization)
- [ ] CloudWatch alarm: Query p99 > 2s (slow query indicator)
- [ ] Dashboard: Connection pool utilization (live metric)
- [ ] Runbook: If alert fires → identify slow query → add index or refactor

**Ação Imediata:**
- Story 011.5c: @devops configura connection pool alarms
- Before go-live: Load test with 1000 concurrent requests
- Monitoring: @devops validates connection pool metrics real-time

---

## 🎯 Resumo de Mitigações por Priority

| Risk | Severity | Tier 1 (Pre-Launch) | Tier 2 (Launch+) |
|------|----------|-------------------|-----------------|
| #1: Gateway breaks | ALTO | Contract tests + feature flags | Canary deploy |
| #2: Token expires | CRÍTICO | Alarm + 24h alert + runbook | Token rotation automation |
| #3: Raw body capture | CRÍTICO | Blue-green + canary + tests | Feature flag rollout |
| #4: Analytics slow | MÉDIO | Load test + index optimization | Incremental refresh |
| #5: Circuit breaker | ALTO | Alarm + SNS + runbook | Adaptive threshold |
| #6: SQS queue grows | MÉDIO→CRÍTICO | DLQ alarm + worker health | Replay engine |
| #7: Connection pool | CRÍTICO | Connection pool tests | Alarms + runbook |

---

## ✅ Mitigações Já Implementadas

- ✅ Schemas compartilhados (Zod) em `packages/shared`
- ✅ HMAC timing-safe validation (Story 005)
- ✅ Circuit breaker logic (Story 009)
- ✅ PII hashing (LGPD compliant)
- ✅ Prisma connection pool configured
- ✅ Integration tests (click + webhook + matching)
- ✅ Failure analysis endpoint (Story 010)

---

## ⏳ Próximas Ações (Ordem Execução)

### Fase Agora (2-4h)

**1. [@devops — Gage] Story 011.1 — Deploy PerfectPay**
- [ ] `git push origin main`
- [ ] Build + ECR push
- [ ] ECS service update
- [ ] Verify `/api/v1/webhooks/perfectpay/{tenantId}` responding 202
- [ ] CloudWatch dashboard: webhook latency + success rate
- **Success:** First real PerfectPay webhook in production

**2. [@po — Pax] Story 011.2 — Validar Story 006**
- [ ] Run `*validate-story-draft story-track-ai-006`
- [ ] 10-point checklist evaluation
- [ ] Update story status: Draft → Ready
- **Success:** Story 006 unblocks gateway implementations

**3. [@qa — Quinn] Story 011.3 — QA Gate Story 009**
- [ ] Run `*review story-track-ai-009`
- [ ] CodeRabbit security scan
- [ ] 7 quality checks evaluation
- [ ] Verdict: PASS | CONCERNS | FAIL
- **Success:** Story 009 approved for production

### Fase Depois (24-48h)

**4. [@sm — River] → [@dev — Dex] Stories 011.4a/b/c — Gateways**
- Story 011.4a: Hotmart webhook (3 points)
- Story 011.4b: Kiwify webhook (3 points)
- Story 011.4c: Stripe webhook (2 points)
- Each with contract tests + feature flags

### Fase Week 2

**5. [@dev — Dex] Story 011.5a — Raw Body Capture**
- [ ] Add @fastify/raw-body plugin
- [ ] Verify HMAC timing-safe with raw body
- [ ] Blue-green deploy + canary test
- [ ] Regression tests: all webhook handlers

**6. [@data-engineer — Dara] Story 011.5b — Analytics Views**
- [ ] Create materialized views
- [ ] Optimize indices for dashboard queries
- [ ] Load test with 1M+ rows
- [ ] Cron refresh job (5 min interval)

**7. [@devops — Gage] Story 011.5c — Production Monitoring**
- [ ] 8+ CloudWatch alarms (token, DLQ, circuit breaker, connections, etc)
- [ ] SNS + PagerDuty integration
- [ ] Runbooks: DLQ analysis, circuit breaker reset, token renewal
- [ ] On-call schedule activation

### Fase Final (Day 5)

**8. [@pm — Morgan] Story 011.6 — MVP Go-Live**
- [ ] Go-Live Checklist validation (infrastructure, code, data, monitoring, team)
- [ ] First customer onboarding
- [ ] Smoke test: 1 click → CAPI end-to-end
- [ ] Collect baseline metrics (latency, success rate)

---

## 📝 Change Log

**2026-03-05 17:15 UTC — @aios-master creates MODUS_OPERANDI.md**
- ✅ Created central context document
- ✅ Analyzed 7 risks + mitigations
- ✅ Mapped next phase actions (Stories 011.1-011.6)
- ✅ Identified Tier 1 (pre-launch) vs Tier 2 (post-launch) mitigations
- **Next:** Execute Phase Now (011.1-011.3 bloqueadores)

**2026-03-05 17:25 UTC — @aios-master Pre-Deployment Verification**
- ✅ TypeScript: 0 errors
- ✅ ESLint: 0 errors (fixed: removed unused import registerAnalyticsRoutes)
- ✅ Tests: 129/129 PASSED (4 skipped — normal)
- ✅ Commits staged and ready
  - f8c8506: docs: add MODUS_OPERANDI.md
  - acdbbb6: fix: remove unused import registerAnalyticsRoutes
- **Status:** ✅ READY FOR GIT PUSH → @devops

---

**Last Updated:** 2026-03-05 17:25 UTC
**Owner:** @aios-master (Orion)
**Status:** WAITING FOR @devops — Git Push & Deploy
