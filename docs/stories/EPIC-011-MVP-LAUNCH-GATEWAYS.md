# EPIC 011 — MVP Launch & Multi-Gateway Integration

**Epic ID:** EPIC-011
**Status:** Draft → Ready (após aprovação)
**Priority:** CRITICAL (Blocker for Go-Live)
**Estimativa Total:** 21 story points
**Timeline:** 5-7 dias úteis
**Owner:** @pm (Morgan)

---

## 🎯 Visão Geral

Consolidação de todas as pendências críticas identificadas na **QA Audit 2026-02-24** para atingir estado pronto para MVP launch. Este épico agrupa:

1. **Bloqueadores de Deploy** (Story 005: timing-safe fix + ECS deploy)
2. **Validações Formais Pendentes** (Story 006: @po gate, Story 009: @qa gate)
3. **Integrações Multi-Gateway** (Story 007: Hotmart + Kiwify + Stripe)
4. **Infra Observabilidade** (Production monitoring + alarms)
5. **Tech Debt Crítico** (Raw body capture, Dedup safety)

**Dependência Master:** Épico 010 (Dashboard) ✅ COMPLETE

---

## 📊 Roadmap Visual

```
┌─ BLOQUEADORES IMEDIATO (24h)
│  ├─ Story 005: Deploy PerfectPay (@devops)
│  ├─ Story 006: Validação @po
│  └─ Story 009: QA Gate @qa
│
├─ GATEWAYS MULTI-VENDOR (48-72h)
│  ├─ Story 007a: Hotmart Webhook
│  ├─ Story 007b: Kiwify Webhook
│  └─ Story 007c: Stripe Webhook
│
└─ PRODUCTION-READY (72-120h)
   ├─ Story 008a: Raw Body Capture (Tech Debt)
   ├─ Story 008b: Analytics Views (@data-engineer)
   ├─ Story 008c: Production Monitoring (@devops)
   └─ Acceptance: Go-Live Checklist
```

---

## 📋 Stories do Épico

### **PHASE 1: Bloqueadores Imediato (CRITICAL)**

#### **Story 011.1 — Deploy PerfectPay Webhook + WAF Config**
**Status:** Ready for Deploy
**Assignee:** @devops (Gage)
**Points:** 2
**Dependency:** Story 005 (implementation complete, security fix merged)

**Objetivos:**
- [ ] `git push origin main`
- [ ] Build Docker image com timing-safe HMAC
- [ ] Push to AWS ECR
- [ ] Update ECS service + auto-scaling
- [ ] Verify endpoint alive in production
- [ ] Test WAF rules (IP allowlist working)
- [ ] Create CloudWatch dashboard: webhook latency + success rate

**Critérios de Aceite:**
- Endpoint `/api/v1/webhooks/perfectpay/{tenantId}` respondendo 202
- Assinatura HMAC validada com timing-safe comparison
- Métricas em CloudWatch mostrando throughput
- No errors em produção (primeiro 1h)
- WAF bloqueando requisições malformadas

**Success Criteria:** ✅ First real PerfectPay event arrives at Supabase

---

#### **Story 011.2 — Formal Validation: Story 006 (Pageview + Checkout)**
**Status:** Draft
**Assignee:** @po (Pax)
**Points:** 1
**Dependency:** Story 006 (implementation complete)

**Objetivos:**
- [ ] Executar `*validate-story-draft story-track-ai-006-pageview-checkout`
- [ ] Validar 10-point checklist
- [ ] Registrar findings no QA Results
- [ ] Update story status: Draft → Ready
- [ ] Document any conditional fixes required

**10-Point Checklist:**
- [ ] Clear and objective title ✓
- [ ] Complete description (problem/need) ✓
- [ ] Testable acceptance criteria (Given/When/Then) ✓
- [ ] Well-defined scope (IN/OUT) ✓
- [ ] Dependencies mapped ✓
- [ ] Complexity estimate ✓
- [ ] Business value clear ✓
- [ ] Risks documented ✓
- [ ] Criteria of Done ✓
- [ ] Alignment with PRD/Epic ✓

**Success Criteria:** Story 006 status = Ready

---

#### **Story 011.3 — QA Gate: Story 009 (SQS Dispatch to Meta CAPI)**
**Status:** Ready for QA
**Assignee:** @qa (Quinn)
**Points:** 3
**Dependency:** Story 009 (3 phases complete, 73 tests passing)

**Objetivos:**
- [ ] Executar `*review story-track-ai-009-sqs-dispatch-capi`
- [ ] Rodar CodeRabbit scan (security + patterns)
- [ ] Validar 7 quality checks
- [ ] Aprovação com verdict: PASS / CONCERNS / FAIL / WAIVED

**7 Quality Checks:**
1. **Code Review** — DI pattern, retry logic, circuit breaker
2. **Unit Tests** — 73 tests, coverage > 85%
3. **Acceptance Criteria** — 9/9 ACs verificadas
4. **No Regressions** — Dashboard queries não impactadas
5. **Performance** — p95 < 2s per event verified
6. **Security** — Dedup logic sound, no timing issues
7. **Documentation** — Phase 1-3 documented, runbooks included

**Success Criteria:** Verdict = PASS ou CONCERNS (sem FAIL blocker)

---

### **PHASE 2: Multi-Gateway Integration (HIGH)**

#### **Story 011.4a — Hotmart Webhook Handler**
**Status:** Ready to Draft
**Assignee:** @sm (River) → @dev (Dex)
**Points:** 3
**Dependency:** Story 005 (PerfectPay webhook pattern established)

**Contexto:**
Hotmart é gateway nº2 em volume de tráfego. Webhook com HMAC-SHA256 + JSON payload normalization.

**Objetivos:**
- [ ] Create `hotmartWebhookSchema` em `@hub/shared`
- [ ] Implementar `apps/api/src/hotmart-webhook-handler.ts`
- [ ] Reutilizar pattern PerfectPay (timing-safe HMAC, PII hashing)
- [ ] POST `/api/v1/webhooks/hotmart/:tenantId`
- [ ] Testes: 8+ cenários, assinatura válida/inválida, dedupe, hash

**Campos Hotmart:**
```json
{
  "order_id": "HT12345",
  "customer": { "email": "...", "phone": "..." },
  "amount": 99.90,
  "currency": "BRL",
  "status": "approved|rejected",
  "event_time": "2026-02-24T10:00:00Z",
  "product_id": "prod-123"
}
```

**Critérios de Aceite:**
- [ ] Assinatura HMAC-SHA256 validada (timing-safe)
- [ ] Email + phone hasheados com SHA-256
- [ ] Event_id determinístico gerado
- [ ] Idempotência via `dedupe_registry`
- [ ] Resposta 202 em < 200ms
- [ ] 8 testes passando

**Success Criteria:** Hotmart events chegando em Supabase

---

#### **Story 011.4b — Kiwify Webhook Handler**
**Status:** Ready to Draft
**Assignee:** @sm (River) → @dev (Dex)
**Points:** 3
**Dependency:** Story 011.4a (Hotmart pattern)

**Contexto:**
Kiwify tem payload structure diferente mas mesmo padrão de autenticação. Reutilizar DI pattern.

**Objetivos:**
- [ ] Create `kiwifyWebhookSchema`
- [ ] Implementar `apps/api/src/kiwify-webhook-handler.ts`
- [ ] Normalizar payload Kiwify → schema universal
- [ ] POST `/api/v1/webhooks/kiwify/:tenantId`
- [ ] 8+ testes

**Campos Kiwify:**
```json
{
  "purchase_id": "KW98765",
  "buyer": { "email": "...", "phone": "..." },
  "value": 49.90,
  "currency": "BRL",
  "status": "completed|pending",
  "created_at": "2026-02-24T10:00:00Z"
}
```

**Success Criteria:** Kiwify events chegando em Supabase

---

#### **Story 011.4c — Stripe Webhook Handler**
**Status:** Ready to Draft
**Assignee:** @sm (River) → @dev (Dex)
**Points:** 2
**Dependency:** Story 011.4a (Pattern established)

**Contexto:**
Stripe é padrão para integração internacional. Usa signature header `Stripe-Signature`.

**Objetivos:**
- [ ] Create `stripeWebhookSchema`
- [ ] Implementar `apps/api/src/stripe-webhook-handler.ts`
- [ ] Validar Stripe signature (vs raw body)
- [ ] POST `/api/v1/webhooks/stripe/:tenantId`
- [ ] Handle `payment_intent.succeeded`
- [ ] 6+ testes

**Success Criteria:** Stripe charges chegando em Supabase

---

### **PHASE 3: Production-Ready & Tech Debt (MEDIUM)**

#### **Story 011.5a — Tech Debt: Raw Body Capture**
**Status:** Ready to Draft
**Assignee:** @architect (Aria) → @dev (Dex)
**Points:** 2
**Dependency:** Story 005 (identified as blocker)

**Contexto:**
Story 005 QA encontrou issue MEDIUM: `JSON.stringify(body)` diverge do body original, causando falha de HMAC. Fastify plugin `rawBody: true` resolve.

**Objetivos:**
- [ ] Adicionar Fastify plugin `@fastify/raw-body`
- [ ] Implementar hook para capture raw body antes de parsing
- [ ] Atualizar todos webhook handlers para usar raw body
- [ ] Testes: Verify HMAC comparison com body original
- [ ] Performance impact test (< 10ms overhead)

**Critérios de Aceite:**
- [ ] Todas webhooks usando raw body
- [ ] HMAC validation funciona 100%
- [ ] Zero performance degradation
- [ ] Tests updated + passing

**Success Criteria:** HMAC timing-safe + raw body secure

---

#### **Story 011.5b — Analytics Views & Query Optimization**
**Status:** Ready to Draft
**Assignee:** @data-engineer (Dara)
**Points:** 3
**Dependency:** Story 010 (dashboard complete)

**Contexto:**
Dashboard Story 010 usa agregações em-time. Com 1M+ events/dia, queries ficarão lentas. Materialized views + job de refresh resolve.

**Objetivos:**
- [ ] Criar view `v_dispatch_summary` (agregações por status/gateway)
- [ ] Criar view `v_match_rate_by_tenant` (taxa % diária)
- [ ] Criar índices: `dispatch_attempts(tenant_id, status, created_at DESC)`
- [ ] Criar índices: `matches(tenant_id, created_at DESC)`
- [ ] Implementar cron job refresh (5 min interval)
- [ ] Query performance test: agregações < 500ms (antes: 2s)

**Queries Otimizadas:**
```sql
-- Before: 2s
SELECT COUNT(*) as total_events,
       COUNT(CASE WHEN status='sent' THEN 1 END) as success
FROM dispatch_attempts
WHERE tenant_id = $1 AND created_at > NOW() - INTERVAL '24h';

-- After: 200ms (from materialized view)
SELECT total_events, dispatch_success
FROM analytics_metrics_daily
WHERE tenant_id = $1 AND date = CURRENT_DATE;
```

**Critérios de Aceite:**
- [ ] Views criadas + indexed
- [ ] Cron job executando a cada 5 min
- [ ] Query latency < 500ms (p95)
- [ ] No query timeouts no dashboard
- [ ] Data freshness < 5 min

**Success Criteria:** Dashboard queries p95 < 1s

---

#### **Story 011.5c — Production Monitoring & Alerting**
**Status:** Ready to Draft
**Assignee:** @devops (Gage)
**Points:** 3
**Dependency:** Story 009 (SQS dispatch deployed)

**Contexto:**
Production deployment sem alarms é risco operacional. Implementar CloudWatch alarms + PagerDuty integration.

**Objetivos:**
- [ ] CloudWatch alarm: DLQ depth > 100 (30 min sustained)
- [ ] CloudWatch alarm: Circuit breaker OPEN > 3 min
- [ ] CloudWatch alarm: Meta token expires in < 24h
- [ ] CloudWatch alarm: Webhook success rate < 95% (1h)
- [ ] CloudWatch dashboard: Real-time metrics (throughput, latency, errors)
- [ ] PagerDuty integration (critical alarms → oncall)
- [ ] Runbook criado: DLQ troubleshooting steps
- [ ] Create SNS topic para notificações

**Métricas Monitoradas:**
- Throughput (events/sec)
- Latency p50, p95, p99
- Success rate (dispatch to Meta)
- DLQ depth + age
- Circuit breaker state
- Database connections
- SQS queue depth

**Critérios de Aceite:**
- [ ] 8+ alarms configurados e testados
- [ ] Cada alarm dispara com falso positivo test
- [ ] PagerDuty receives notifications
- [ ] Runbook documentado e acessível
- [ ] Team trained on incident response

**Success Criteria:** Oncall alerted within 5 min of anomaly

---

### **PHASE 4: Acceptance & Launch**

#### **Story 011.6 — MVP Go-Live Checklist & First Customer**
**Status:** Ready to Draft
**Assignee:** @pm (Morgan)
**Points:** 2
**Dependency:** All stories above (011.1 through 011.5c)

**Objetivos:**
- [ ] Verify all deployments in production
- [ ] Smoke test: 1 click → CAPI end-to-end
- [ ] Data validation: Click persists, webhook normalizes, conversion matches, CAPI dispatches
- [ ] Performance baseline: Collect p50/p95/p99 latency
- [ ] Runbooks reviewed by team
- [ ] On-call schedule activated
- [ ] Customer onboarded + first funnel configured
- [ ] Real events flowing through pipeline

**Go-Live Checklist:**
```
Infrastructure:
- [ ] AWS SQS queues created and tested
- [ ] Secrets Manager populated (Meta token, gateway secrets)
- [ ] ECS services running with 2+ replicas
- [ ] RDS PostgreSQL healthy, backups enabled
- [ ] CloudWatch dashboards live
- [ ] Alarms firing and PagerDuty integrated

Code:
- [ ] All story deployments verified in prod
- [ ] TypeScript/lint checks passing
- [ ] Tests running in CI/CD
- [ ] Feature flags configured

Data:
- [ ] Database migrations applied
- [ ] First tenant created
- [ ] First funnel configuration tested
- [ ] Sample click generated

Monitoring:
- [ ] CloudWatch metrics flowing
- [ ] Dashboard displaying real data
- [ ] Alarms tested with false positive
- [ ] Logs aggregated in CloudWatch

Team:
- [ ] On-call rotation assigned
- [ ] Runbooks accessible
- [ ] Incident response plan reviewed
- [ ] 24h support contact configured
```

**Success Criteria:**
- First customer can login and see metrics
- First conversion arrives in Meta CAPI
- Team confident in production operations

---

## 📊 Dependencies Graph

```
Story 011.1 (Deploy Story 005)
  ↓
Story 011.2 (Validate Story 006) ─→ Story 011.4a/b/c (Gateways)
  ↓
Story 011.3 (QA Story 009)
  ↓
Story 011.4a (Hotmart)
  ├→ Story 011.4b (Kiwify)
  └→ Story 011.4c (Stripe)
  ↓
Story 011.5a (Raw Body Tech Debt)
Story 011.5b (Analytics Views) ─→ Story 011.5c (Prod Monitoring)
  ↓
Story 011.6 (Go-Live Checklist)
```

**Critical Path:** 011.1 → 011.2 → 011.3 → 011.4a → 011.5c → 011.6
**Duration:** ~5-7 dias úteis

---

## 📈 Success Metrics

| Métrica | Target | Baseline |
|---------|--------|----------|
| Webhook latency p95 | < 200ms | 152ms ✓ |
| CAPI dispatch p95 | < 2s | 1.2s ✓ |
| Match rate | > 70% | TBD (first customer) |
| Success rate | > 99% | TBD |
| DLQ depth | < 50 events | 0 (new) |
| Uptime | 99.9% | TBD |

---

## 🚨 Risks & Mitigations

| Risco | Impacto | Mitigação |
|-------|---------|----------|
| Webhook from new gateway breaks | Conversions lost | Contract tests, feature flags per gateway |
| Meta token expires mid-launch | CAPI dispatch fails | 24h refresh, token expiration alert |
| Raw body capture breaks existing webhooks | Production outage | Blue/green deploy, rollback ready |
| Analytics views slow down dashboard | UX degradation | Test views with 1M rows data |
| Circuit breaker trips during spike | Conversions queue up | Monitor threshold, alert on open |

---

## 📅 Timeline (Best Case)

```
Day 1 (Monday)
├─ Morning: @devops deploys Story 005
├─ Afternoon: @po validates Story 006, @qa gates Story 009
└─ Evening: 3 stories in production, baseline metrics collected

Day 2-3 (Tue-Wed)
├─ @sm drafts & @dev implements Story 007a/b/c (Gateways)
├─ @devops monitors prod metrics
└─ @data-engineer preps analytics views

Day 4 (Thursday)
├─ @dev delivers Story 011.5a (Raw Body)
├─ @data-engineer delivers Story 011.5b (Views)
└─ @devops finishes Story 011.5c (Monitoring)

Day 5 (Friday)
├─ Final smoke testing
├─ Go-Live Checklist review
└─ First customer + real funnel deployed
```

---

## 🎓 Assumptions & Constraints

**Assumptions:**
- AWS infrastructure already deployed (Story 003 ✅)
- Team bandwidth: 2x @dev, 1x @qa, 1x @po, 1x @devops, 1x @data-engineer
- Feature flags for gradual rollout available
- Customer ready to onboard by Friday

**Constraints:**
- No breaking changes to existing APIs
- All deployments must include rollback procedure
- Zero downtime requirement (blue/green or canary)
- PII always hashed before persistence
- GDPR/LGPD compliance non-negotiable

---

## 📝 Definition of Done

**Per Story:**
- [ ] Implementation complete (code + tests)
- [ ] Code review passed
- [ ] QA gate passed (PASS or CONCERNS, no FAIL)
- [ ] Deployed to staging + tested
- [ ] Deployed to production with monitoring
- [ ] Change log updated
- [ ] Documentation updated

**For Epic:**
- [ ] All 6 stories complete
- [ ] Go-Live Checklist signed off
- [ ] First customer onboarded + real events flowing
- [ ] On-call team confident
- [ ] Metrics baseline established
- [ ] Runbooks finalized

---

## 📞 Communication Plan

**Daily Standup:** 09:00 UTC
**Escalation:** @pm (Morgan) for blockers
**Status Updates:** End-of-day Slack updates
**Post-Mortem:** Friday 16:00 UTC (if any incidents)

---

**Epic Created:** 2026-02-24
**Epic Owner:** @pm (Morgan)
**Last Updated:** 2026-02-24

**Status:** ⏳ Ready for Review & Approval
