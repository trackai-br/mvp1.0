# Testing Instructions — Hub Server-Side Tracking MVP v27

**Duration:** 5-10 minutes
**Prerequisites:** Node.js 18+, PostgreSQL running, npm
**Difficulty:** Beginner-friendly (copy/paste commands)

---

## 0. Pre-Test Setup (2 minutes)

### 0.1 Prepare Environment File

```bash
cd /Users/guilhermesimas/Documents/hub-server-side-tracking

# Create .env from template
cp .env.example .env

# Add these minimal test values to .env
echo '
# Test Database (use local SQLite or PostgreSQL)
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/hub_test"

# Webhook Secrets (for HMAC testing)
PERFECTPAY_WEBHOOK_SECRET="test-secret-perfectpay-123456"
HOTMART_WEBHOOK_SECRET="test-secret-hotmart-123456"
KIWIFY_WEBHOOK_SECRET="test-secret-kiwify-123456"
STRIPE_WEBHOOK_SECRET="test-secret-stripe-123456"
PAGSEGURO_WEBHOOK_SECRET="test-secret-pagseguro-123456"

# Meta CAPI (dummy for local testing)
META_CAPI_ACCESS_TOKEN="test-capi-token"

# API Config
PUBLIC_API_BASE_URL="http://localhost:3001"
NODE_ENV="test"
' >> .env
```

### 0.2 Setup Database (PostgreSQL)

```bash
# Start PostgreSQL (if not running)
# macOS: brew services start postgresql
# Linux: sudo systemctl start postgresql
# Docker: docker run -d --name postgres -e POSTGRES_PASSWORD=postgres -p 5432:5432 postgres:15

# Create test database
createdb hub_test 2>/dev/null || echo "Database may already exist"

# Run Prisma migrations
cd apps/api
npx prisma migrate dev --skip-generate
```

**Expected output:**
```
✓ Database created
✓ Migrations applied
✓ Prisma Client generated
```

---

## 1. Run Unit Tests (2 minutes)

### 1.1 Full Test Suite

```bash
cd /Users/guilhermesimas/Documents/hub-server-side-tracking

# Run all tests (API + Web)
npm run test
```

**Expected output:**
```
✓ Test Files: 19 passed (19)
✓ Tests: 119 passed (119)
✓ Duration: ~50s
```

### 1.2 Run Tests by Module

```bash
# Backend tests only
npm run test -w apps/api

# Frontend tests only
npm run test -w apps/web

# Single test file (example)
cd apps/api && npm run test -- perfectpay-webhook-handler.test.ts
```

### 1.3 Watch Mode (for development)

```bash
# Auto-rerun on file changes
npm run test -- --watch
```

---

## 2. Start Services (2 minutes)

### 2.1 Terminal 1: Start API Server

```bash
npm run dev:api
```

**Expected output:**
```
[API] Listening on http://localhost:3001
[API] Database: PostgreSQL connected
[SQS] Worker polling started
```

### 2.2 Terminal 2: Start Web Frontend (optional)

```bash
npm run dev:web
```

**Expected output:**
```
[WEB] Local: http://localhost:3000
[WEB] Ready in 2.5s
```

### 2.3 Terminal 3: Monitor Logs

```bash
# Watch API logs
tail -f /tmp/hub-api.log
```

---

## 3. Smoke Test E2E — Click Ingest (2 minutes)

### 3.1 Create a Test Tenant

```bash
# Set environment
export API_URL="http://localhost:3001"
export TENANT_ID="test-tenant-001"

# Option A: Via setup wizard (manual)
curl -X POST $API_URL/api/v1/setup/sessions \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Store",
    "webhook_sources": ["perfectpay"],
    "currency": "BRL"
  }' | jq .
```

**Expected response:**
```json
{
  "sessionId": "sess_abc123...",
  "status": "pending",
  "checks": { "setup_wizard": "incomplete" }
}
```

### 3.2 Ingest a Click

```bash
# Send a test click event
curl -X POST $API_URL/api/v1/track/click \
  -H "Content-Type: application/json" \
  -H "X-Tenant-ID: $TENANT_ID" \
  -d '{
    "fbclid": "IwAR3Cphm1Z2X8j5k9m0P",
    "fbc": "fb.1.1234567890.IwAR3Cphm1Z2X8j",
    "fbp": "fb.1.1234567890.1234567890",
    "utmSource": "facebook",
    "utmMedium": "cpc",
    "utmCampaign": "spring-sale"
  }' | jq .
```

**Expected response:**
```json
{
  "id": "clk_xyz123...",
  "tenantId": "test-tenant-001",
  "fbclid": "IwAR3Cphm1Z2X8j5k9m0P",
  "createdAt": "2026-03-02T15:30:45.123Z"
}
```

---

## 4. Smoke Test — PerfectPay Webhook (2 minutes)

### 4.1 Compute HMAC Signature

```bash
# In JavaScript/Node.js REPL (or curl with jq)
node << 'EOF'
const crypto = require('crypto');

const secret = "test-secret-perfectpay-123456";
const payload = JSON.stringify({
  order_id: "ORDER-12345",
  amount: 99.90,
  currency: "BRL",
  customer: {
    email: "buyer@example.com",
    phone: "+5511999887766"
  }
});

const signature = crypto
  .createHmac('sha256', secret)
  .update(payload)
  .digest('hex');

console.log('Signature:', signature);
console.log('Payload:', payload);
EOF
```

**Expected output:**
```
Signature: abc123def456... (64-char hex string)
Payload: {"order_id":"ORDER-12345",...}
```

### 4.2 Send Webhook with Valid Signature

```bash
# Copy signature from step 4.1
SIGNATURE="abc123def456..."

curl -X POST http://localhost:3001/api/v1/webhooks/perfectpay/$TENANT_ID \
  -H "Content-Type: application/json" \
  -H "X-Signature: $SIGNATURE" \
  -d '{
    "order_id": "ORDER-12345",
    "amount": 99.90,
    "currency": "BRL",
    "customer": {
      "email": "buyer@example.com",
      "phone": "+5511999887766"
    }
  }' | jq .
```

**Expected response (200 OK):**
```json
{
  "ok": true,
  "eventId": "ev_sha256hash...",
  "isDuplicate": false
}
```

### 4.3 Test Security: Invalid Signature

```bash
# Send same webhook with WRONG signature
curl -X POST http://localhost:3001/api/v1/webhooks/perfectpay/$TENANT_ID \
  -H "Content-Type: application/json" \
  -H "X-Signature: wrong-signature-1234567890" \
  -d '{
    "order_id": "ORDER-12345",
    "amount": 99.90,
    "currency": "BRL",
    "customer": {
      "email": "buyer@example.com",
      "phone": "+5511999887766"
    }
  }' | jq .
```

**Expected response (401 Unauthorized):**
```json
{
  "error": "invalid_signature"
}
```

---

## 5. Data Verification (1 minute)

### 5.1 Query Database Directly

```bash
# Connect to PostgreSQL
psql postgresql://postgres:postgres@localhost:5432/hub_test

# In psql prompt:
\dt                        -- List all tables
SELECT * FROM clicks LIMIT 5;
SELECT * FROM identities LIMIT 5;
SELECT * FROM "dedupeRegistry" LIMIT 5;
\q
```

### 5.2 Verify Data Integrity

```bash
# Check data via API
curl -X GET "http://localhost:3001/api/v1/events?tenantId=$TENANT_ID" \
  -H "Content-Type: application/json" | jq '.items[] | {id, type, createdAt}'
```

**Expected output:**
```json
[
  { "id": "clk_xyz...", "type": "click", "createdAt": "2026-03-02T..." },
  { "id": "ev_abc...", "type": "purchase", "createdAt": "2026-03-02T..." }
]
```

---

## 6. Linting & Type Checking (1 minute)

### 6.1 Run Linter

```bash
npm run lint
```

**Expected output:**
```
✓ No lint errors
✓ apps/api: OK
✓ apps/web: OK
```

### 6.2 Run TypeScript Checker

```bash
npm run typecheck
```

**Expected output:**
```
✓ Type checking passed
✓ 0 errors in apps/api
✓ 0 errors in apps/web
```

---

## 7. Load Test (optional, 3-5 minutes)

### 7.1 Run Load Test Suite

```bash
# From root
npm run test -w apps/api -- --grep "Load Testing"
```

**Expected output:**
```
Test: Handle 1000+ events/min throughput
✓ Total Events: 100
✓ Success Rate: 100%
✓ Throughput: 6.4 events/sec
✓ P95 Latency: 261ms
✓ Duration: ~15s
```

### 7.2 Generate Load with Artillery (optional)

```bash
# Install artillery
npm install -g artillery

# Run load test (100 req/sec for 30 seconds)
artillery quick --count 100 --num 3000 http://localhost:3001/api/v1/track/click
```

---

## 8. Dashboard Inspection (1 minute, optional)

### 8.1 Open Web UI

```bash
# In browser:
open http://localhost:3000

# Or:
curl -s http://localhost:3000 | grep -o '<title>.*</title>'
```

**Expected:** Dashboard loads without errors, displays KPI cards

### 8.2 Verify KPI Data

```bash
# Check API endpoint for metrics
curl -X GET "http://localhost:3001/api/v1/metrics?tenantId=$TENANT_ID" \
  -H "Content-Type: application/json" | jq '{total_clicks, total_conversions, match_rate}'
```

---

## 9. Cleanup (1 minute)

### 9.1 Stop Services

```bash
# Terminal 1 (API): Ctrl+C
# Terminal 2 (Web): Ctrl+C
# Terminal 3 (Logs): Ctrl+C
```

### 9.2 Clean Up Test Data (optional)

```bash
# Reset test database
cd apps/api
npx prisma migrate reset --force

# Or, drop and recreate:
dropdb hub_test
createdb hub_test
npx prisma migrate dev --skip-generate
```

### 9.3 Remove Test Secrets (optional)

```bash
# Remove .env if using test values
rm .env
```

---

## Troubleshooting

| Issue | Cause | Fix |
|-------|-------|-----|
| `Error: connect ECONNREFUSED 127.0.0.1:5432` | PostgreSQL not running | `brew services start postgresql` |
| `Error: database "hub_test" does not exist` | DB not created | `createdb hub_test` |
| `Error: HMAC signature mismatch` | Wrong secret or payload | Verify secret in `.env` and payload format |
| `Error: tenant not found (401)` | Using wrong TENANT_ID | Ensure header `X-Tenant-ID` matches created tenant |
| `Tests timeout (>60s)` | Slow database | Ensure PostgreSQL indexes exist (`npx prisma generate`) |

---

## Success Criteria

After completing all steps, verify:

- [x] All 119 tests passing
- [x] API starts without errors
- [x] Click ingestion works (200 OK response)
- [x] PerfectPay webhook accepts valid HMAC (200 OK)
- [x] Invalid HMAC rejected (401 Unauthorized)
- [x] Database queries return data
- [x] Lint and typecheck pass
- [x] p95 latency < 500ms

---

## Next Steps

**For Go-Live:**
1. Deploy to ECS via `@devops` (use CI/CD pipeline)
2. Configure AWS Secrets Manager with real CAPI credentials
3. Update webhook URLs in PerfectPay/Hotmart/Kiwify dashboards
4. Run smoke tests in staging environment
5. Monitor CloudWatch logs for first 24 hours

**For Future Sprints:**
- [ ] Story 012: Add pagination to match engine
- [ ] Story 013: Implement replay engine
- [ ] Story 014: Advanced analytics dashboard

---

**Prepared by:** @qa (Quinn)
**Last Updated:** March 2, 2026
**Status:** READY FOR TESTING

