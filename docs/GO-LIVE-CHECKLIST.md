# GO-LIVE CHECKLIST — EPIC 011 MVP Launch

**Date:** Friday, 2026-02-24
**Owner:** @pm (Morgan)
**Duration:** 4-8 hours
**Status:** Ready to Execute

---

## ✅ 20-Item Production Readiness Checklist

### INFRASTRUCTURE (5 items)

- [ ] **SQS Queues Active**
  - Verify: `capi-dispatch` queue exists and is empty
  - Verify: `capi-dispatch-dlq` exists with 0 messages
  - Verify: RedrivePolicy configured (maxReceiveCount=5)
  - Command: `aws sqs list-queues --queue-name-prefix capi-dispatch`

- [ ] **Secrets Manager Populated**
  - [ ] `meta-capi-credentials` (app_id, app_secret, access_token)
  - [ ] `perfectpay-webhook-secret` (HMAC key)
  - [ ] `hotmart-webhook-secret`
  - [ ] `kiwify-webhook-secret`
  - [ ] `stripe-webhook-secret`
  - Command: `aws secretsmanager list-secrets --filter Key=tag:environment,Values=prod`

- [ ] **ECS Services Running**
  - Verify: `api` service running with 2+ replicas
  - Verify: All replicas are RUNNING (not PENDING)
  - Verify: No failed task deployments in last 1h
  - Command: `aws ecs describe-services --cluster prod --services api`

- [ ] **RDS PostgreSQL Healthy**
  - Verify: Database accessible from ECS tasks
  - Verify: Migrations applied (3 migrations)
  - Verify: Backups enabled (daily snapshots)
  - Command: `psql -h {RDS_ENDPOINT} -U admin -c "SELECT version();"`

- [ ] **CloudWatch Setup Complete**
  - Verify: 8 alarms created and in OK state
  - Verify: Dashboard visible and showing metrics
  - Verify: PagerDuty integration active
  - Command: `aws cloudwatch describe-alarms --query 'MetricAlarms[*].[AlarmName, StateValue]'`

---

### CODE & BUILD (4 items)

- [ ] **All Deployments Verified**
  - [ ] Phase 1: PerfectPay deploy + validations ✓
  - [ ] Phase 2: Hotmart + Kiwify + Stripe ✓
  - [ ] Phase 3: Tech debt + Analytics + Monitoring ✓
  - [ ] TypeCheck: PASS
  - [ ] Lint: PASS
  - [ ] Tests: PASS (101 tests)

- [ ] **Docker Images Current**
  - Verify: Latest ECR image matches current commit
  - Verify: Image build date is today
  - Command: `aws ecr describe-images --repository-name api --query 'sort_by(imageDetails, &imagePushedAt)[-1]'`

- [ ] **Feature Flags Ready**
  - [ ] `gateway_hotmart` = enabled
  - [ ] `gateway_kiwify` = enabled
  - [ ] `gateway_stripe` = enabled
  - [ ] `analytics_views` = enabled
  - [ ] `circuit_breaker` = enabled

- [ ] **Database Migrations Current**
  - [ ] Migration 1_init: Applied
  - [ ] Migration 2_add_analytics_views: Applied
  - [ ] Migration 3_add_analytics_optimization: Applied
  - Command: `psql -h {RDS_ENDPOINT} -U admin -c "SELECT * FROM _prisma_migrations;"`

---

### DATA & CONFIGURATION (4 items)

- [ ] **First Test Tenant Created**
  - Tenant ID: `test-tenant-001`
  - Name: `MVP Test Account`
  - Status: `active`
  - Command: `psql ... -c "SELECT * FROM tenant WHERE slug = 'test-tenant-001';"`

- [ ] **First Test Funnel Deployed**
  - Funnel ID: `test-funnel-001`
  - Tenant: `test-tenant-001`
  - Gateway mapping: Hotmart → testhotmart
  - Status: `active`
  - Command: `psql ... -c "SELECT * FROM funnel WHERE tenant_id = '...' AND id = 'test-funnel-001';"`

- [ ] **Webhook Secrets in Env**
  - All 5 gateway secrets loaded in ECS task definition
  - No hardcoded secrets in code
  - Command: `aws ecs describe-task-definition --task-definition track-ai-api | grep WEBHOOK_SECRET`

- [ ] **Analytics Views Initialized**
  - Materialized views v_dispatch_summary and v_match_rate_by_tenant exist
  - First refresh job executed successfully
  - Command: `psql ... -c "\dm v_dispatch_summary, v_match_rate_by_tenant"`

---

### MONITORING & OPERATIONS (4 items)

- [ ] **Monitoring Active**
  - CloudWatch dashboard visible and updating
  - All 8 alarms in OK state (not firing)
  - PagerDuty receiving test notifications
  - On-call rotation active

- [ ] **Logs Aggregated**
  - ECS logs flowing to CloudWatch /ecs/track-ai-api
  - Recent deployments visible in log streams
  - X-Ray tracing enabled for end-to-end visibility
  - Command: `aws logs describe-log-streams --log-group-name /ecs/track-ai-api`

- [ ] **Runbooks Accessible**
  - [ ] docs/runbooks/dlq-troubleshooting.md
  - [ ] docs/runbooks/circuit-breaker-trip.md
  - [ ] All team members can access (shared in Slack #track-ai-ops)

- [ ] **On-Call Team Ready**
  - [ ] Primary on-call assigned in PagerDuty
  - [ ] Secondary on-call assigned
  - [ ] Escalation policy configured
  - [ ] 24/7 coverage confirmed for next 2 weeks

---

### SMOKE TEST: End-to-End Flow (1 item)

- [ ] **Complete Flow: Click → Conversion → Meta CAPI**

  **Step 1: Generate Test Click**
  ```bash
  curl -X POST http://api.internal:3001/api/v1/track/click \
    -H "x-tenant-id: test-tenant-001" \
    -H "Content-Type: application/json" \
    -d '{
      "fbclid": "test-fbclid-001",
      "fbc": "fb.1.123456789.test",
      "fbp": "fb.1.123456789.test",
      "utm_source": "google",
      "utm_medium": "cpc",
      "utm_campaign": "test"
    }'
  # Expected: 201 { "id": "..." }
  ```

  **Step 2: Verify Click Persisted**
  ```bash
  psql ... -c "SELECT COUNT(*) FROM click WHERE tenant_id = 'test-tenant-001';"
  # Expected: 1
  ```

  **Step 3: Send Test Conversion (PerfectPay)**
  ```bash
  curl -X POST http://api.internal:3001/api/v1/webhooks/perfectpay/test-tenant-001 \
    -H "x-perfectpay-signature: {HMAC_SIGNATURE}" \
    -H "Content-Type: application/json" \
    -d '{
      "order_id": "test-order-001",
      "customer": { "email": "test@example.com", "phone": "+5511999999999" },
      "amount": 99.90,
      "currency": "BRL",
      "status": "approved"
    }'
  # Expected: 202 { "ok": true }
  ```

  **Step 4: Verify Conversion & Match**
  ```bash
  psql ... -c "SELECT COUNT(*) FROM conversion WHERE tenant_id = 'test-tenant-001';"
  psql ... -c "SELECT COUNT(*) FROM match_log WHERE tenant_id = 'test-tenant-001';"
  # Expected: 1 conversion, 1 match
  ```

  **Step 5: Check SQS Dispatch Queue**
  ```bash
  aws sqs get-queue-attributes \
    --queue-url https://sqs.{REGION}.amazonaws.com/{ACCOUNT}/capi-dispatch \
    --attribute-names ApproximateNumberOfMessages
  # Expected: 1 message (test event enqueued for Meta dispatch)
  ```

  **Step 6: Verify Meta CAPI Dispatch**
  ```bash
  # Wait 30 seconds for dispatch worker to process
  psql ... -c "SELECT * FROM dispatch_attempt WHERE conversion_id = '...';"
  # Expected: 1 row with status='sent', http_status=200
  ```

  **Step 7: Check Dashboard**
  ```
  Open: https://dashboard.track-ai.com/analytics
  Expected:
  - KPI cards showing: 1 event, 100% success, 1 match
  - Events tab: test event visible
  - No errors in DLQ
  ```

  **✅ SUCCESS:** Complete flow from click → Meta CAPI verified end-to-end

---

### CUSTOMER ONBOARDING (2 items)

- [ ] **First Real Customer Account Created**
  - Tenant slug: `customer-001` (actual customer name)
  - Company name: [Customer name]
  - Admin email: [Customer email]
  - Status: `active` & `verified`
  - Assigned dedicated success contact

- [ ] **First Real Funnel Configured**
  - Funnel name: [Customer's store/funnel name]
  - Primary gateway: [Hotmart/Kiwify/Stripe]
  - Tracking pixel deployed on customer's site
  - First test click generated and tracked
  - Match confirmed in dashboard

---

## 🚀 Launch Sequence (Friday 09:00-16:00 UTC)

```
09:00 — @pm Kickoff
├─ Review checklist (all boxes checked? ✓)
├─ Confirm team ready (dev, ops, qa, sm, po present)
└─ Start smoke test (Step 1-7 above)

10:00 — Smoke Test Complete
├─ End-to-end flow verified ✓
├─ Dashboard showing metrics ✓
└─ No errors, team confident ✓

11:00 — Create First Test Tenant
├─ Tenant `test-tenant-001` created
├─ Test conversion sent
└─ Dashboard verified

12:00 — Team Standup
├─ All systems operational ✓
├─ 24h monitoring plan confirmed
└─ Escalation contacts validated

13:00 — Onboard Real Customer
├─ Create tenant with real customer info
├─ Configure funnel
├─ Deploy tracking pixel
├─ Generate first real click

14:00 — Monitor Production (2h standby)
├─ Watch CloudWatch dashboard
├─ Check SQS queues
├─ Verify no alarms firing
├─ Monitor error rates

16:00 — Team Celebration 🎉
├─ MVP launched ✓
├─ Customer live ✓
├─ Events flowing to Meta CAPI ✓
└─ 24/7 monitoring active ✓
```

---

## 🎯 Success Criteria

All of the following must be TRUE to declare GO-LIVE successful:

1. ✅ All 20 checklist items signed off
2. ✅ Smoke test completed end-to-end (click → Meta CAPI)
3. ✅ First customer account live with real data flowing
4. ✅ Dashboard showing live metrics (no zeros)
5. ✅ Zero critical errors in production logs (first 2h)
6. ✅ All 8 CloudWatch alarms stable (OK state)
7. ✅ On-call team confident in runbooks
8. ✅ No unexpected alerts triggered

---

## 📞 Escalation

If ANY issue found:
- **Minor (e.g., typo in dashboard):** Note it, proceed with launch, fix in follow-up
- **Moderate (e.g., slow query):** Pause, fix in staging, verify, then proceed
- **Critical (e.g., dispatch failing):** HALT launch, escalate @aios-master, investigate fully

---

## 📋 Post-Launch (Saturday)

- [ ] Team debrief: What went well, what to improve
- [ ] Customer follow-up: "How's it going?"
- [ ] Metrics review: Baseline established for future optimization
- [ ] Documentation update: Add any learnings to runbooks

---

**Status:** 🟢 Ready to Execute

**Signed Off:**
- [ ] @pm (Morgan) — Delivery Lead
- [ ] @devops (Gage) — Operations
- [ ] @dev (Dex) — Engineering
- [ ] @qa (Quinn) — Quality
- [ ] @sm (River) — Process

**GO-LIVE AUTHORIZED:** _____________________   Date: __________
