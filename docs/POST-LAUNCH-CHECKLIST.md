# 📋 Post-Launch Checklist — Hub Server-Side Tracking MVP

**Date:** 2026-03-05 21:35 UTC (Prepared — Executes after Smoke Test PASS)
**Owner:** @pm (Morgan)
**Duration:** 2-3 hours after smoke test
**Status:** Ready for execution

---

## ✅ Upon Smoke Test PASS

### Immediate Actions (Next 30 min)

- [ ] **Step 1: Confirm Team Readiness (5 min)**
  - [ ] @pm (Morgan) — Go-live coordinator present
  - [ ] @devops (Gage) — Infrastructure on-call
  - [ ] @dev (Dex) — Code support on-call
  - [ ] @qa (Quinn) — Quality assurance ready
  - [ ] All have access to Slack #track-ai-ops channel

- [ ] **Step 2: Scale ECS to 2 Replicas (10 min)**
  ```bash
  aws ecs update-service \
    --cluster hub-server-side-tracking \
    --service hub-server-side-tracking-api \
    --desired-count 2 \
    --region us-east-1
  ```
  - Verify both replicas running: `aws ecs list-tasks --cluster hub-server-side-tracking`
  - Check ALB target health: Both targets HEALTHY
  - Confirm no service errors in CloudWatch logs

- [ ] **Step 3: Verify Production Secrets (5 min)**
  ```bash
  aws secretsmanager get-secret-value --secret-id meta_capi_token
  aws secretsmanager get-secret-value --secret-id perfectpay_webhook_secret
  # ... verify all 5 secrets present
  ```
  - Confirm all 5 webhook secrets loaded in ECS task
  - No hardcoded secrets in code

- [ ] **Step 4: Test Health Endpoints (5 min)**
  ```bash
  # Via ALB
  curl https://api.track-ai.com/api/v1/health

  # Expected: { "status": "ok", "db": "connected", "project": "Track AI" }
  ```
  - Verify HTTP 200 response from both replicas
  - Database connection confirmed

---

### Customer Onboarding Phase (Next 60 min)

- [ ] **Step 5: Create First Real Customer (10 min)**
  ```sql
  INSERT INTO tenant (
    id,
    slug,
    name,
    company_name,
    admin_email,
    status
  ) VALUES (
    'customer-001',
    'customer-company-name',
    'Customer Company',
    'Real Company Inc.',
    'customer@example.com',
    'active'
  );
  ```
  - Note: Use actual customer details
  - Confirm tenant created: `SELECT * FROM tenant WHERE id='customer-001';`

- [ ] **Step 6: Generate Tracking Pixel Code (10 min)**
  - Generate unique tracking pixel URL
  - Format: `https://api.track-ai.com/api/v1/track/pixel?tenant=customer-001&utm_source=...`
  - Create GTM container tag template
  - Document integration steps for customer

- [ ] **Step 7: Create First Customer Funnel (10 min)**
  ```sql
  INSERT INTO funnel (
    id,
    tenant_id,
    name,
    gateway_config,
    status
  ) VALUES (
    'customer-funnel-001',
    'customer-001',
    'Customer Store Funnel',
    '{"gateway":"perfectpay","store_id":"customer-store-id"}',
    'active'
  );
  ```
  - Configure customer's gateway integration
  - Test gateway credentials (if available)

- [ ] **Step 8: Send First Test Click (10 min)**
  ```bash
  curl -X POST https://api.track-ai.com/api/v1/track/click \
    -H "x-tenant-id: customer-001" \
    -H "Content-Type: application/json" \
    -d '{
      "fbclid": "customer-test-click-'$(date +%s)'",
      "fbc": "fb.1.12345.test",
      "fbp": "fb.1.12345.test",
      "utm_source": "facebook",
      "utm_medium": "cpc",
      "utm_campaign": "customer-test"
    }'
  ```
  - Verify HTTP 201 Created
  - Confirm click in database

- [ ] **Step 9: Test Customer's Conversion Flow (10 min)**
  - Send test conversion via customer's gateway (PerfectPay/Hotmart/Kiwify/Stripe)
  - Verify conversion captured
  - Confirm match created with click
  - Check Meta CAPI queue (message present)

- [ ] **Step 10: Verify Customer Dashboard Access (10 min)**
  - Login as customer@example.com
  - Verify dashboard loads
  - Confirm metrics visible:
    - Test click showing
    - Test conversion showing
    - Match rate visible
    - Dispatch status visible

---

### Production Monitoring Phase (Next 60-120 min)

- [ ] **Step 11: Start Production Baseline Monitoring (120 min)**
  - Monitor CloudWatch metrics for first 2 hours
  - Collect baseline data:
    - **Latency p50/p95/p99** (target: < 50ms / < 200ms / < 500ms)
    - **Throughput** (events/sec) — baseline for future optimization
    - **Success rate** (target: > 95%)
    - **Error rate** (target: < 1%)
    - **Match rate** (target: > 80%)
    - **Queue depth** (target: 0 after processing)

  **Verification commands:**
  ```bash
  # Check metrics every 15 minutes
  aws cloudwatch get-metric-statistics \
    --metric-name Duration \
    --namespace AWS/ApiGateway \
    --start-time $(date -u -d '15 minutes ago' +%Y-%m-%dT%H:%M:%S) \
    --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
    --period 300 \
    --statistics Average,Maximum

  # Check for alarms
  aws cloudwatch describe-alarms --state-value ALARM
  ```

- [ ] **Step 12: Verify All Alarms Normal (every 15 min)**
  - No CRITICAL alarms should be firing
  - Expected alarms: All in OK state
  - Check PagerDuty: No incidents created

- [ ] **Step 13: Monitor Logs for Issues (continuous)**
  ```bash
  # Watch CloudWatch logs in real-time
  aws logs tail /ecs/track-ai-api --follow

  # Or filter for errors
  aws logs filter-log-events \
    --log-group-name /ecs/track-ai-api \
    --filter-pattern "ERROR"
  ```
  - Acceptable: 0-1 errors in 2 hours
  - If more errors: Investigate and escalate

---

### Final Validation (Last 30 min)

- [ ] **Step 14: Team Standup (15 min)**
  - All systems nominal? (Everyone confirms)
  - Any concerns or observations?
  - Document any learnings in post-launch debrief

- [ ] **Step 15: Update Documentation (10 min)**
  ```bash
  # Update PROGRESS.md
  - Mark PHASE 4 COMPLETE
  - Note production launch timestamp
  - Record baseline metrics

  # Archive this checklist
  - Rename POST-LAUNCH-CHECKLIST.md to POST-LAUNCH-EXECUTION-2026-03-05.md
  - Add completion timestamp
  ```

- [ ] **Step 16: Declare MVP LIVE 🚀 (5 min)**
  - Send team notification: "Hub Server-Side Tracking MVP is LIVE"
  - Update status page (if applicable)
  - Celebrate! 🎉

---

## 🎯 Success Criteria: Phase 4 Complete

**All of the following must be TRUE:**

1. ✅ Smoke test executed: All 7 steps PASSED
2. ✅ ECS scaled to 2 replicas: Both healthy
3. ✅ First real customer account created and verified
4. ✅ Customer tracking pixel deployed and tested
5. ✅ First customer test click → conversion → Meta CAPI verified end-to-end
6. ✅ Dashboard accessible and showing real metrics
7. ✅ No CRITICAL errors in logs (first 2 hours)
8. ✅ All CloudWatch alarms in OK state
9. ✅ Production baseline metrics collected
10. ✅ Team confident in operations and runbooks

**If all 10 criteria met:** ✅ **MVP LAUNCH AUTHORIZED**

---

## ⚠️ Contingency: If Issues Found

### Issue: Conversion not matching with click
**Impact:** Medium — feature not working
**Action:**
1. Check match engine logs for errors
2. Verify webhook signature validation passing
3. Check gateway-specific field mapping
4. Contact @dev (Dex) for urgent debugging

### Issue: High error rate (> 5%)
**Impact:** High — system degraded
**Action:**
1. Check error types: API 5xx vs 4xx vs gateway issues
2. Verify database connection pool not exhausted
3. Check if circuit breaker has opened
4. Escalate to @architect for investigation

### Issue: CloudWatch alarm firing
**Impact:** Medium-High depending on alarm
**Action:**
1. Check which alarm fired (email/PagerDuty)
2. Consult relevant runbook:
   - DLQ depth? → `docs/runbooks/dlq-troubleshooting.md`
   - Circuit breaker? → `docs/runbooks/circuit-breaker-trip.md`
3. Follow runbook resolution steps
4. If unresolved: Escalate to @devops (Gage)

### Issue: Customer can't login to dashboard
**Impact:** Medium — feature discovery blocked
**Action:**
1. Verify customer email/password correct
2. Check if tenant created successfully
3. Verify dashboard service running
4. Contact @dev (Dex) if persistent

---

## 📊 Metrics to Track (First 24 Hours)

### Performance Metrics
- API latency p95 (should be < 200ms)
- Webhook processing latency (should be < 100ms)
- Database query latency (should be < 50ms)
- Throughput (events/sec) — baseline for comparison

### Reliability Metrics
- Success rate (should be > 95%)
- Error rate (should be < 1%)
- Match rate (should be > 80%)
- DLQ depth (should be 0)

### Business Metrics
- Total clicks tracked
- Total conversions received
- Total matches created
- Successful Meta CAPI dispatches
- Customer funnel status

---

## 📞 Escalation Plan

If ANY critical issue found:

**Level 1: Developer On-Call**
- Contact: @dev (Dex)
- Time to respond: < 5 min
- Capable of: Code debugging, feature investigation

**Level 2: Operations Lead**
- Contact: @devops (Gage)
- Time to respond: < 10 min
- Capable of: Infrastructure, AWS operations, scaling

**Level 3: Project Manager**
- Contact: @pm (Morgan)
- Time to respond: < 15 min
- Capable of: Customer communication, decision-making, coordination

**Level 4: Architecture Review**
- Contact: @architect (Aria) or @aios-master (Orion)
- Time to respond: < 30 min
- Capable of: System-wide investigation, major decisions

---

## 📋 Post-Launch Debrief (Next Day)

Schedule within 24 hours of launch:

- [ ] **What went well?**
  - Document successes and learnings
  - Recognize team contributions

- [ ] **What could be improved?**
  - Identify any bottlenecks or friction
  - Prioritize improvements for Phase 2

- [ ] **Customer feedback?**
  - Any issues reported by customer
  - Feature requests noted
  - Satisfaction level

- [ ] **Technical observations?**
  - Actual latency vs projected
  - Error patterns observed
  - Resource utilization insights

- [ ] **Next priorities?**
  - Phase 2 feature backlog
  - Performance optimizations
  - New customer onboarding

---

## 🎉 Launch Completion

**MVP LAUNCHED:** ✅
**Date:** 2026-03-05 (approximate — update after execution)
**Time to Launch:** ~19 hours from project start
**Team:** @pm, @dev, @data-engineer, @devops, @qa, @sm, @po, @architect

**Celebration:** Well done! The Hub Server-Side Tracking MVP is live and serving real customers. 🚀

---

**Status:** Ready for post-launch execution
**Next review:** After smoke test completion
**Owner:** @pm (Morgan) → entire team on-call

