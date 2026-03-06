# 🧪 Smoke Test Execution Plan — Phase 4

**Date:** 2026-03-05 21:35 UTC
**Objective:** Validate complete end-to-end flow: Click → Conversion → Meta CAPI Dispatch
**Duration:** 30 minutes
**Executor:** @pm (Morgan)
**Prerequisites:** All of PHASE 0-3 complete (verified in GO-LIVE-STATUS.md)

---

## 7-Step Smoke Test Flow

### Step 1: Health Check (✅ Baseline)

**Objective:** Verify API is responding and database is connected

```bash
curl -X GET http://localhost:3001/api/v1/health \
  -H "Content-Type: application/json"
```

**Expected Response:**
```json
{
  "status": "ok",
  "db": "connected",
  "project": "Track AI"
}
```

**Verification:** HTTP 200 + `status: "ok"`
**Success Criteria:** ✅ PASS if status=ok

**Action on Failure:**
- Check if API running: `npm run dev:api`
- Check database connection: `psql -h localhost -U postgres -d hub_tracking -c "SELECT 1;"`

---

### Step 2: Generate Test Click

**Objective:** Create a test click event via tracking API

```bash
curl -X POST http://localhost:3001/api/v1/track/click \
  -H "x-tenant-id: test-tenant-001" \
  -H "Content-Type: application/json" \
  -d '{
    "fbclid": "test-fbclid-001-'$(date +%s)'",
    "fbc": "fb.1.123456789.test",
    "fbp": "fb.1.123456789.test",
    "utm_source": "google",
    "utm_medium": "cpc",
    "utm_campaign": "smoke-test",
    "url": "https://example.com"
  }'
```

**Expected Response:**
```json
{
  "id": "click_...",
  "tenantId": "test-tenant-001",
  "fbclid": "test-fbclid-001-...",
  "createdAt": "2026-03-05T21:35:00Z"
}
```

**Verification:** HTTP 201 Created, response contains `id`
**Success Criteria:** ✅ PASS if HTTP 201 + id returned

**Save for later:** Copy the `fbclid` value for Step 3

---

### Step 3: Verify Click in Database

**Objective:** Confirm click was persisted to PostgreSQL

```bash
psql -h localhost -U postgres -d hub_tracking -c \
  "SELECT id, tenant_id, fbclid, created_at FROM click \
   WHERE tenant_id = 'test-tenant-001' \
   ORDER BY created_at DESC LIMIT 1;"
```

**Expected Output:**
```
                  id                  | tenant_id | fbclid | created_at
─────────────────────────────────────┼──────────────────┼────────────────────
click_abc123def | test-tenant-001 | test-fbclid-001... | 2026-03-05 21:35...
```

**Verification:** 1 row returned, tenant_id matches, fbclid matches
**Success Criteria:** ✅ PASS if count > 0

---

### Step 4: Send Test Conversion (PerfectPay Webhook)

**Objective:** Simulate a PerfectPay conversion webhook

```bash
# First, generate HMAC signature
BODY='{"order_id":"test-order-001-'$(date +%s)'","customer":{"email":"test@example.com","phone":"+5511999999999"},"amount":99.90,"currency":"BRL","status":"approved"}'

SIGNATURE=$(echo -n "$BODY" | openssl dgst -sha256 -hmac "${PERFECTPAY_WEBHOOK_SECRET:-test-secret}" | awk '{print $2}')

# Send webhook
curl -X POST http://localhost:3001/api/v1/webhooks/perfectpay/test-tenant-001 \
  -H "x-signature: $SIGNATURE" \
  -H "Content-Type: application/json" \
  -d "$BODY"
```

**Expected Response:**
```json
{
  "ok": true
}
```

**Verification:** HTTP 202 Accepted, `ok: true`
**Success Criteria:** ✅ PASS if HTTP 202 + ok=true

**Note on Signature:**
- If you don't have PERFECTPAY_WEBHOOK_SECRET, the handler will reject with 401
- For smoke test: The handler validates signature before processing
- If signature fails: Try with a dummy signature, handler should return 401 (expected)

---

### Step 5: Verify Conversion & Match in Database

**Objective:** Confirm conversion was stored and matched with the click

```bash
# Check conversion
psql -h localhost -U postgres -d hub_tracking -c \
  "SELECT id, tenant_id, order_id, amount, status, created_at \
   FROM conversion \
   WHERE tenant_id = 'test-tenant-001' \
   ORDER BY created_at DESC LIMIT 1;"

# Check match
psql -h localhost -U postgres -d hub_tracking -c \
  "SELECT id, tenant_id, click_id, conversion_id, match_score, status \
   FROM match_log \
   WHERE tenant_id = 'test-tenant-001' \
   ORDER BY created_at DESC LIMIT 1;"
```

**Expected Output:**
```
Conversion: 1 row with tenant_id='test-tenant-001', amount=99.90, status='pending'
Match:     1 row with click_id populated, conversion_id populated, match_score > 0, status='matched'
```

**Verification:** Both tables have entries, match links click to conversion
**Success Criteria:** ✅ PASS if both conversions and matches > 0

---

### Step 6: Check SQS Dispatch Queue

**Objective:** Verify event was queued for Meta CAPI dispatch

```bash
# If running with SQS mock (localstack)
curl -X GET http://localhost:4566/000000000000/capi-dispatch \
  -H "Content-Type: text/xml"

# Or if using real AWS
aws sqs get-queue-attributes \
  --queue-url https://sqs.us-east-1.amazonaws.com/751702759697/capi-dispatch \
  --attribute-names ApproximateNumberOfMessages
```

**Expected Output:**
```json
{
  "Attributes": {
    "ApproximateNumberOfMessages": "1"
  }
}
```

**Verification:** Queue has >= 1 message
**Success Criteria:** ✅ PASS if ApproximateNumberOfMessages >= 1

---

### Step 7: Verify Meta CAPI Dispatch

**Objective:** Confirm event was sent to Meta Conversions API (or mocked)

```bash
# Check dispatch_attempt table
psql -h localhost -U postgres -d hub_tracking -c \
  "SELECT id, conversion_id, status, http_status_code, response_body, created_at \
   FROM dispatch_attempt \
   WHERE tenant_id = 'test-tenant-001' \
   ORDER BY created_at DESC LIMIT 1;"
```

**Expected Output:**
```
Dispatch Attempt:
- status: 'sent' (if Meta API succeeded) OR 'failed' (if Meta API down)
- http_status_code: 200 (if sent) OR null (if pending)
- response_body: Meta API response (truncated)
```

**Verification:** 1 row with status='sent', http_status_code=200
**Success Criteria:** ✅ PASS if status='sent' or status='pending_retry'

**Note:** In development/staging, Meta CAPI responses may fail. That's OK — the event was queued successfully. Check if dispatch_attempt was created.

---

### Step 8: Check Dashboard Metrics

**Objective:** Verify analytics aggregations are visible

```bash
# Check materialized views
psql -h localhost -U postgres -d hub_tracking -c \
  "SELECT tenant_id, total_events, total_conversions, total_matches \
   FROM v_dispatch_summary \
   WHERE tenant_id = 'test-tenant-001';"

psql -h localhost -U postgres -d hub_tracking -c \
  "SELECT tenant_id, event_date, match_rate_percent \
   FROM v_match_rate_by_tenant \
   WHERE tenant_id = 'test-tenant-001';"
```

**Expected Output:**
```
v_dispatch_summary:
- tenant_id: test-tenant-001
- total_events: >= 1
- total_conversions: >= 1
- total_matches: >= 1

v_match_rate_by_tenant:
- match_rate_percent: >= 50 (at least half of clicks matched)
```

**Verification:** Both views have data for test-tenant-001
**Success Criteria:** ✅ PASS if both views have rows with test-tenant-001

---

## 📊 Success Criteria Summary

All 7 steps must result in ✅ PASS:

| Step | Criteria | Status |
|------|----------|--------|
| 1. Health Check | HTTP 200, status='ok' | [ ] |
| 2. Create Click | HTTP 201, id returned | [ ] |
| 3. Verify Click | ≥1 row in database | [ ] |
| 4. Send Conversion | HTTP 202, ok=true | [ ] |
| 5. Verify Match | Conversion + Match rows present | [ ] |
| 6. Check SQS | ≥1 message in queue | [ ] |
| 7. Verify Dispatch | dispatch_attempt row exists | [ ] |
| 8. Check Dashboard | Views have metrics | [ ] |

**Overall Result:**
- If ALL 8 steps pass: ✅ **SMOKE TEST PASSED** → Proceed to production launch
- If ANY step fails: ❌ **SMOKE TEST FAILED** → Investigate root cause, fix, re-run

---

## 🔧 Troubleshooting

### Issue: HTTP 400 on Step 2 (Create Click)
**Possible Causes:**
1. Missing header: x-tenant-id
2. Invalid JSON payload
3. Tenant doesn't exist

**Fix:**
```bash
# Verify tenant exists
psql -h localhost -U postgres -d hub_tracking -c \
  "SELECT * FROM tenant WHERE id='test-tenant-001';"

# If not found, create it:
psql -h localhost -U postgres -d hub_tracking -c \
  "INSERT INTO tenant (id, slug, name, status) \
   VALUES ('test-tenant-001', 'test-tenant', 'Test Account', 'active');"
```

### Issue: HTTP 401 on Step 4 (Send Conversion)
**Possible Causes:**
1. Invalid HMAC signature
2. Webhook secret mismatch

**Fix:**
```bash
# Verify webhook secret in env
echo $PERFECTPAY_WEBHOOK_SECRET

# If not set, use a test value:
export PERFECTPAY_WEBHOOK_SECRET="test-secret"

# Re-run Step 4
```

### Issue: No rows in Step 3 or 5
**Possible Causes:**
1. Database transaction not committed
2. Wrong tenant_id in query

**Fix:**
```bash
# Check if database connection works
psql -h localhost -U postgres -d hub_tracking -c "SELECT version();"

# Check all clicks for all tenants
psql -h localhost -U postgres -d hub_tracking -c "SELECT COUNT(*) FROM click;"

# If count is 0, the API call failed silently
```

### Issue: SQS Queue Empty in Step 6
**Possible Causes:**
1. Dispatch worker already consumed messages
2. SQS not configured
3. Error occurred before queue

**Fix:**
```bash
# Check dispatch_attempt table instead
psql -h localhost -U postgres -d hub_tracking -c \
  "SELECT COUNT(*) FROM dispatch_attempt;"

# If > 0, dispatch worker is running (expected behavior)
```

---

## ✅ Post-Smoke Test Actions

### If PASS (Proceed to Production)
1. ✅ Update GO-LIVE-CHECKLIST.md: Mark all items DONE
2. ✅ Scale ECS to 2 replicas
3. ✅ Onboard first real customer
4. ✅ Monitor production baseline (1-2 hours)
5. ✅ Declare MVP LIVE 🚀

### If FAIL (Root Cause Analysis)
1. ❌ Identify which step failed
2. ❌ Check logs: `npm run dev:api` (look for errors)
3. ❌ Check database: `psql ... -c "\dt"` (verify tables exist)
4. ❌ Verify secrets loaded: `env | grep WEBHOOK`
5. ❌ Re-run just that step after fix
6. ❌ If still failing: Escalate to @architect for investigation

---

**Smoke Test Status:** ⏳ READY FOR EXECUTION
**Expected Duration:** 30 minutes
**Target Completion:** 2026-03-05 22:05 UTC

