# Story Track AI 011a — Deploy PerfectPay Webhook [DEBUG REPORT]

**Date:** 2026-02-24 13:32 UTC
**Status:** ⚠️ DEPLOYMENT FAILED (ECS Service Stabilization Timeout)

## Error Analysis

### GitHub Actions Workflow Result
- **Workflow ID:** 22352519088
- **Conclusion:** ❌ FAILURE
- **Jobs Status:**
  - ✅ Quality Gates (Lint, TypeCheck, Tests) — **PASSED**
  - ✅ Build Docker Image — **PASSED**
  - ❌ Deploy to ECS Fargate — **FAILED**
  - ✅ Send deployment notification — **PASSED**

### Deploy Error Details
```
Waiter ServicesStable failed: Max attempts exceeded
Error: Process completed with exit code 255
Duration: ~10 minutes (13:22:14 to 13:32:14 UTC)
```

**Root Cause:** ECS service failed to achieve stable state within 10-minute timeout. This indicates:
1. ECS task failed to reach `RUNNING` state
2. Container failed to start or crashed immediately
3. Health checks failing (if configured)
4. Resource constraints preventing task start

## Possible Causes (Priority Order)

1. **Environment Variable Missing** — Meta CAPI token or webhook secret not set in ECS task definition
2. **Container Image Issue** — ECR image build succeeded but runtime dependencies missing
3. **Database Connection** — RDS PostgreSQL unreachable or credentials invalid
4. **Port Binding** — Port 3001 (API) or 3000 (Web) already in use or not exposed
5. **Memory/CPU Constraints** — Task definition resources insufficient for workload

## Next Steps (Action Plan)

### [@devops — Gage] PRIORITY: Fix Deployment

1. **Check ECS Task Logs**
   ```bash
   aws logs tail /ecs/hub-server-side-tracking-task --follow
   # OR via CloudWatch console:
   # Log group: /ecs/hub-server-side-tracking-task
   ```

2. **Verify Environment Variables in Task Definition**
   ```bash
   aws ecs describe-task-definition --task-definition hub-server-side-tracking-task \
     --query 'taskDefinition.containerDefinitions[0].environment' --output table
   ```
   Expected variables:
   - `DATABASE_URL` — PostgreSQL connection string
   - `META_GRAPH_API_BASE` — https://graph.facebook.com
   - `PERFECTPAY_WEBHOOK_SECRET` — Obtained from Secrets Manager

3. **Check Secrets Manager Access**
   ```bash
   aws secretsmanager describe-secret --secret-id hub-tracking/production
   # Ensure task execution role has permission: secretsmanager:GetSecretValue
   ```

4. **Verify ECS Task Execution Role**
   ```bash
   aws iam get-role-policy --role-name ecsTaskExecutionRole \
     --policy-name allow-secrets-manager
   # Should contain: secretsmanager:GetSecretValue, logs:CreateLogGroup, logs:CreateLogStream
   ```

5. **Re-run Deployment**
   After verifying above:
   ```bash
   git push origin main
   # GitHub Actions will re-trigger automatically
   # Monitor: https://github.com/trackai-br/mvp1.0/actions/runs/22352519088
   ```

## Acceptance Criteria (Story 011a)

- [ ] ECS task reaches `RUNNING` state
- [ ] Service achieves stable health state
- [ ] API responds at `https://api.hub-server-side-tracking.com/health`
- [ ] PerfectPay webhook accessible at `POST /api/v1/webhooks/perfectpay/{tenantId}`
- [ ] CloudWatch logs show no errors
- [ ] Deployment completion time < 15 minutes

## Test Protocol (Post-Fix)

```bash
# 1. Verify service is up
curl -I https://api.hub-server-side-tracking.com/health

# 2. Test webhook acceptance
curl -X POST https://api.hub-server-side-tracking.com/api/v1/webhooks/perfectpay/tenant-123 \
  -H "X-Webhook-Signature: $(openssl dgst -sha256 -mac HMAC -macopt key='your-secret' '{"test": true}')" \
  -H "Content-Type: application/json" \
  -d '{"test": true}'

# 3. Check CloudWatch metrics
aws cloudwatch get-metric-statistics --namespace ECS/ContainerInsights \
  --metric-name TaskCount --statistics Average --start-time 2026-02-24T00:00:00Z --end-time 2026-02-24T23:59:59Z --period 3600
```

## Rollback Plan (if needed)

If task continues to fail after 2 retry attempts:
1. Rollback to previous task definition version
   ```bash
   aws ecs update-service --cluster hub-server-side-tracking-cluster \
     --service hub-server-side-tracking-service \
     --task-definition hub-server-side-tracking-task:PREVIOUS_REVISION
   ```
2. Investigate root cause in dev environment
3. Re-test locally before re-attempting production deployment

---

**Story Status:** InProgress → Awaiting DevOps Fix
**Assignee:** @devops (Gage)
**Deadline:** ASAP (blocks Phase 2 and Phase 3)
**Impact:** High — Foundation for all webhook handlers
