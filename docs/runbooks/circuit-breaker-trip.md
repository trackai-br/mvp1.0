# Runbook: Circuit Breaker Trip

**Issue:** Meta CAPI dispatch circuit breaker is OPEN

**Severity:** HIGH

**Detection:** CloudWatch alarm fires when state = OPEN > 3 minutes

---

## Resolution Steps (3 steps)

### Step 1: Check Circuit Breaker Metrics
```bash
curl -s http://localhost:3001/api/v1/admin/dispatch/metrics | jq '.circuitBreaker'
```

Expected: state = OPEN, failures >= 5, timeout = 60000ms

### Step 2: Investigate Root Cause
```bash
aws logs tail /ecs/hub-server-side-tracking-task --follow --since 10m | grep -i "circuit\|failed"
```

**Common causes:** Meta CAPI timeout, network issues, rate limiting, invalid token

### Step 3: Reset Circuit Breaker

**Wait for auto-reset:** Circuit breaker enters HALF_OPEN after 60s timeout

**Or manually trigger retry:**
```bash
curl -X POST http://localhost:3001/api/v1/admin/dispatch/retry-trigger \
  --header "Authorization: Bearer $ADMIN_TOKEN" \
  --json '{"limit": 100}'
```

Monitor state: Target = CLOSED

---

**Document Version:** 1.0 (2026-03-06)
