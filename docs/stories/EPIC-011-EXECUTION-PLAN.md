# EPIC 011 — Execution Plan Consolidado

**Data:** 2026-02-24
**Coordenador:** @sm (River)
**Status:** Ready for Launch

---

## 📊 Stories Criadas (7 Total)

### PHASE 1: Bloqueadores Imediato (TODAY - 24h)

| Story | Title | Assignee | Points | Status | Dependency |
|-------|-------|----------|--------|--------|-----------|
| **011a** | Deploy PerfectPay Webhook + WAF Config | @devops (Gage) | 2 | Ready | None |
| **011b** | Validação: Pageview + Checkout | @po (Pax) | 1 | Ready | 011a |
| **011c** | QA Gate: SQS Dispatch to Meta CAPI | @qa (Quinn) | 3 | Ready | 011a |

**🎯 Objetivo Phase 1:** Desbloqueadores críticos deployados + validados

**⏱️ Timeline:**
```
09:00 — @devops inicia 011a (build + ECR push + ECS update)
10:30 — @po executa 011b (validação 10-point checklist)
11:00 — @qa executa 011c (QA gate review)
16:00 — Todos 3 completos, métricas baseline coletadas
```

**Bloqueador:** Se qualquer um falhar → escalate @aios-master

---

### PHASE 2: Multi-Gateway Integration (48-72h)

| Story | Title | Assignee | Points | Status | Dependency |
|-------|-------|----------|--------|--------|-----------|
| **011d** | Hotmart Webhook Handler | @dev (Dex) | 3 | Ready | 011a/b/c |
| **011e** | Kiwify Webhook Handler | @dev (Dex) | 3 | Ready | 011a/b/c |
| **011f** | Stripe Webhook Handler | @dev (Dex) | 2 | Ready | 011a/b/c |

**🎯 Objetivo Phase 2:** 3 gateways implementados + testados em paralelo

**⏱️ Timeline:**
```
09:00 (Tue) — @dev inicia 011d/e/f em paralelo
           — @qa pronto para review assim que 011d/e/f prontas
16:00 (Wed) — Todos 3 gateways vivos em staging
17:00 (Wed) — @qa gates começam
```

**Paralelo:** @dev pode trabalhar 011d, 011e, 011f simultaneamente
**Review:** @qa faz gate review após cada handler pronto

---

### PHASE 3: Production-Ready (72-120h)

| Story | Title | Assignee | Points | Status | Dependency |
|-------|-------|----------|--------|--------|-----------|
| **011g-a** | Tech Debt: Raw Body Capture | @dev (Dex) | 2 | Ready | 011d/e/f |
| **011g-b** | Analytics Optimization | @data-engineer (Dara) | 3 | Ready | 011d/e/f |
| **011g-c** | Production Monitoring | @devops (Gage) | 3 | Ready | 011d/e/f |

**🎯 Objetivo Phase 3:** Produção pronta para lançamento real

**⏱️ Timeline:**
```
09:00 (Thu) — @dev inicia 011g-a (raw body plugin)
            — @data-engineer inicia 011g-b (views + indexes)
            — @devops inicia 011g-c (alarms + dashboard)
16:00 (Thu) — Todos 3 completos, produção fully monitored
```

**Paralelo:** 011g-a/b/c executam 100% em paralelo (zero bloqueadores entre eles)

---

### PHASE 4: Go-Live (120-168h)

| Task | Owner | Duration |
|------|-------|----------|
| Go-Live Checklist (20 items) | @pm (Morgan) | 2h |
| First Customer Onboarding | @pm (Morgan) | 2h |
| Smoke Test End-to-End | @qa (Quinn) | 1h |
| Performance Baseline | @devops (Gage) | 1h |

**🎯 Objetivo:** MVP launched, first customer live, real events flowing

**⏱️ Timeline:**
```
09:00 (Fri) — @pm inicia go-live checklist
12:00 (Fri) — First customer onboarded
14:00 (Fri) — Real funnel deployed
15:00 (Fri) — Real events flowing through pipeline
16:00 (Fri) — Celebração! 🎉
```

---

## 🏃 Execution Checklist

### Day 1 (Monday) — Phase 1

**Morning (09:00-12:00):**
```bash
[ ] @devops starts 011a
    ├─ git pull origin main
    ├─ docker build -t api:latest
    ├─ docker push to ECR
    ├─ aws ecs update-service
    └─ Verify endpoint 202 response

[ ] @po starts 011b
    ├─ Read story-track-ai-006
    ├─ Execute 10-point checklist
    ├─ Update story status Draft → Ready
    └─ Log findings in QA Results

[ ] @qa starts 011c
    ├─ Read story-track-ai-009
    ├─ Run CodeRabbit scan
    ├─ Validate 7 quality checks
    └─ Generate verdict (PASS/CONCERNS/FAIL)
```

**Afternoon (12:00-16:00):**
```bash
[ ] Verify all 3 stories DONE or blocked
[ ] If blocked: escalate @aios-master
[ ] If DONE: collect baseline metrics
    ├─ Latency p50/p95/p99
    ├─ Throughput (events/sec)
    ├─ Success rate
    └─ Error rates

[ ] Team sync-up (15 min)
    ├─ Celebrate completions
    ├─ Discuss any blockers
    └─ Plan Day 2
```

---

### Day 2-3 (Tuesday-Wednesday) — Phase 2

**Morning Day 2:**
```bash
[ ] @dev starts 011d (Hotmart)
[ ] @dev starts 011e (Kiwify) — parallel
[ ] @dev starts 011f (Stripe) — parallel
[ ] @data-engineer preps analytics queries
[ ] @devops preps monitoring configs
```

**Afternoon Day 2:**
```bash
[ ] 011d/e ready for @qa review (assuming 011d done first)
[ ] @qa starts gate review on 011d
[ ] @dev continues 011e/f
```

**Morning Day 3:**
```bash
[ ] 011e/f ready
[ ] @qa gates 011e/f
[ ] Staging deployment of all 3 gateways
[ ] Smoke test: fake webhook from each gateway
```

**Afternoon Day 3:**
```bash
[ ] All 3 handlers vivo in staging
[ ] Verify dedupe working
[ ] Verify PII hashing working
[ ] Prepare for production deployment
```

---

### Day 4 (Thursday) — Phase 3

**All Day (09:00-17:00) — Parallel Execution:**
```bash
[ ] @dev executes 011g-a (raw body plugin)
    ├─ Install @fastify/raw-body
    ├─ Update all webhook handlers
    ├─ Tests passing
    └─ Performance OK

[ ] @data-engineer executes 011g-b (analytics)
    ├─ Create views v_dispatch_summary, v_match_rate
    ├─ Create indexes
    ├─ Setup cron job (5 min refresh)
    ├─ Load test 1M rows
    └─ Query latency < 500ms verified

[ ] @devops executes 011g-c (monitoring)
    ├─ Create 8 CloudWatch alarms
    ├─ Setup PagerDuty integration
    ├─ Create dashboard (real-time KPIs)
    ├─ Write runbooks (DLQ troubleshooting, circuit breaker)
    └─ Test each alarm fires correctly
```

**End of Day 4:**
```bash
[ ] Production fully monitored
[ ] Tech debt resolved
[ ] Analytics optimized
[ ] Ready for go-live
```

---

### Day 5 (Friday) — Phase 4 & Go-Live

**Morning (09:00-12:00):**
```bash
[ ] @pm executes go-live checklist (20 items)
    ├─ Infrastructure verified
    ├─ Code deployed
    ├─ Monitoring active
    ├─ Team trained
    └─ Runbooks accessible

[ ] @qa runs end-to-end smoke test
    ├─ POST /api/v1/track/click (test tenant)
    ├─ POST /api/v1/webhooks/perfectpay (test conversion)
    ├─ Verify click → conversion → dispatch → Meta CAPI
    └─ Verify metrics in dashboard

[ ] @devops collects baseline metrics (first 1h production)
    ├─ Latency p50/p95/p99
    ├─ Throughput
    ├─ Success rate
    └─ Error rates
```

**Afternoon (12:00-16:00):**
```bash
[ ] @pm onboards first customer
    ├─ Create tenant in production
    ├─ Configure first funnel
    ├─ Deploy tracking pixel
    ├─ Generate test click + conversion
    └─ Verify in dashboard

[ ] Monitor production for 2h (team standby)
    ├─ Watch CloudWatch alarms
    ├─ Check DLQ depth
    ├─ Monitor circuit breaker
    ├─ Verify Meta CAPI events received

[ ] Team debrief + celebration 🎉
    ├─ What went well
    ├─ What to improve
    ├─ Next sprint planning
```

---

## 🚨 Escalation Triggers

| Trigger | Action | Owner |
|---------|--------|-------|
| Any Phase 1 story FAIL | Halt all Phase 2-3, escalate @aios-master | @sm (River) |
| 011a deploy fails | Rollback + debug, if > 2 attempts → escalate | @devops |
| 011b validation NO-GO | Fix story + resubmit @po, if > 1 cycle → escalate | @po |
| 011c verdict FAIL | Return to @dev for fixes + retest, max 2 cycles | @qa |
| 011d/e/f QA gate FAIL (any) | Fix + re-gate, max 2 cycles before escalation | @dev |
| 011g-a performance > 50ms | Investigate bottleneck, optimize | @dev |
| 011g-b query latency > 1s | Optimize indexes + views | @data-engineer |
| 011g-c alarms fire false positive | Tune thresholds | @devops |
| Production errors > 1% (go-live) | ROLLBACK + investigate | @devops, @pm |

---

## 📞 Communication Schedule

| Time | Channel | What |
|------|---------|------|
| 09:00 | Slack | Daily standup (5 min) |
| 12:00 | Slack | Midday status check |
| 16:00 | Slack | End-of-day wrap-up |
| 18:00 | Post-mortem (if needed) | Incident debrief |

**Escalation Contact:** @sm (River) via Slack #dev-urgent

---

## ✅ Success Criteria

**By End of Friday (16:00 UTC):**

- [x] All 7 stories (011a-011g) DONE
- [x] First customer onboarded
- [x] First real event: click → conversion → Meta CAPI dispatched
- [x] Metrics visible in production dashboard
- [x] Team confident in operations
- [x] Monitoring active + alarms tested
- [x] Go-Live Checklist 20/20 items signed off

---

## 📊 Capacity & Parallelization

### Team Capacity (Per Day)

| Agent | Day 1 | Day 2-3 | Day 4 | Day 5 |
|-------|-------|---------|-------|-------|
| @devops | 011a (3h) | staging deploy (2h) | 011g-c (full day) | monitoring + baselines |
| @po | 011b (2h) | — | — | go-live checklist |
| @qa | 011c (3h) | gate 011d/e/f (full day) | — | smoke test + baseline |
| @dev | — | 011d/e/f (full day) | 011g-a (4h) | support |
| @data-engineer | — | — | 011g-b (full day) | support |
| @pm | coordination | coordination | coordination | go-live execution |

### Parallelization Matrix

```
Day 1:   011a | 011b | 011c      (3 parallel)
Day 2-3: 011d | 011e | 011f      (3 parallel)
Day 4:   011g-a | 011g-b | 011g-c (3 parallel)
Day 5:   Go-Live (coordinated)
```

**Zero Sequential Blocking:** Each phase independent after blocker dependencies resolved.

---

## 🎓 Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|-----------|
| @devops deploy fails (011a) | All downstream blocked | Rollback ready, test in staging first |
| @po NO-GO verdict (011b) | Gateways delayed | Fix story + revalidate same day |
| Raw body plugin breaks webhooks (011g-a) | Production outage | Blue/green deploy + 10min rollback ready |
| Analytics views slow down (011g-b) | Dashboard unusable | Pre-load test with 1M rows |
| Alarms misconfigured (011g-c) | False alerts | Test each alarm before production |
| Customer onboarding delayed (go-live) | Slips timeline | Pre-stage customer + configs |

---

## 📝 Documentation

**Created:**
- ✅ `/docs/stories/story-track-ai-011a-deploy-perfectpay.md`
- ✅ `/docs/stories/story-track-ai-011b-validate-pageview-checkout.md`
- ✅ `/docs/stories/story-track-ai-011c-qa-gate-sqs-dispatch.md`
- ✅ `/docs/stories/story-track-ai-011d-hotmart-webhook.md`
- ✅ `/docs/stories/story-track-ai-011e-kiwify-webhook.md`
- ✅ `/docs/stories/story-track-ai-011f-stripe-webhook.md`
- ✅ `/docs/stories/story-track-ai-011g-production-ready.md`
- ✅ `/docs/stories/EPIC-011-EXECUTION-PLAN.md` (this file)

**To Create:**
- [ ] `/docs/GO-LIVE-CHECKLIST.md` (template from 011g)
- [ ] `/docs/runbooks/dlq-troubleshooting.md` (from 011g-c)
- [ ] `/docs/runbooks/circuit-breaker-trip.md` (from 011g-c)

---

## 🎯 Next Action

**IMMEDIATO (agora):**
1. ✅ Stories 011a-011g criadas e prontas
2. 👉 **Próximo:** Iniciar Phase 1 com @devops, @po, @qa simultâneamente

**Command para iniciar:**
```bash
# Phase 1 parallel execution
@devops *develop story-track-ai-011a-deploy-perfectpay &
@po *validate story-track-ai-011b-validate-pageview-checkout &
@qa *review story-track-ai-011c-qa-gate-sqs-dispatch &
```

---

**Status:** 🟢 Ready for Launch
**Created:** 2026-02-24 by @sm (River)
**Last Updated:** 2026-02-24
