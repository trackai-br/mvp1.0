# Quick Test Commands — Copy & Paste Ready

**Status:** MVP v27 Ready for Testing
**Time:** 5-10 minutes to complete
**Difficulty:** Copy/paste only — no coding needed

---

## 🚀 SECTION 1: Initialize Environment (2 min)

### Setup .env file
```bash
cd /Users/guilhermesimas/Documents/hub-server-side-tracking
cp .env.example .env
cat >> .env << 'EOF'

# Test Configuration
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/hub_test"
PERFECTPAY_WEBHOOK_SECRET="test-secret-perfectpay-123456"
HOTMART_WEBHOOK_SECRET="test-secret-hotmart-123456"
KIWIFY_WEBHOOK_SECRET="test-secret-kiwify-123456"
STRIPE_WEBHOOK_SECRET="test-secret-stripe-123456"
PAGSEGURO_WEBHOOK_SECRET="test-secret-pagseguro-123456"
META_CAPI_ACCESS_TOKEN="test-capi-token"
PUBLIC_API_BASE_URL="http://localhost:3001"
NODE_ENV="test"
EOF
```

### Create & migrate database
```bash
# Create test database
createdb hub_test 2>/dev/null || echo "Database already exists"

# Run migrations
cd apps/api
npx prisma migrate dev --skip-generate
```

---

## ✅ SECTION 2: Run All Tests (2 min)

### Full test suite (API + Web)
```bash
cd /Users/guilhermesimas/Documents/hub-server-side-tracking
npm run test
```

**Expected:** ✓ 119 tests passing (~50 seconds)

### Backend tests only
```bash
npm run test -w apps/api
```

### Frontend tests only
```bash
npm run test -w apps/web
```

### Watch mode (auto-rerun)
```bash
npm run test -- --watch
```

---

## 🟢 SECTION 3: Start Services (1 min)

### Terminal 1: API Server
```bash
cd /Users/guilhermesimas/Documents/hub-server-side-tracking
npm run dev:api
```

**Wait for:** `Listening on http://localhost:3001`

### Terminal 2: Web Frontend (optional)
```bash
cd /Users/guilhermesimas/Documents/hub-server-side-tracking
npm run dev:web
```

**Wait for:** `Local: http://localhost:3000`

---

## 🔍 SECTION 4: Test Click Ingestion (30 sec)

### Set tenant ID
```bash
export API_URL="http://localhost:3001"
export TENANT_ID="test-tenant-001"
```

### Send a click
```bash
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
  "id": "clk_...",
  "tenantId": "test-tenant-001",
  "fbclid": "IwAR3Cphm1Z2X8j5k9m0P",
  "createdAt": "2026-03-02T..."
}
```

---

## 🔐 SECTION 5: Test PerfectPay Webhook — Valid HMAC (1 min)

### Generate HMAC signature
```bash
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
const sig = crypto.createHmac('sha256', secret).update(payload).digest('hex');
console.log('HMAC=' + sig);
console.log('PAYLOAD=' + payload);
EOF
```

### Copy HMAC value and send webhook
```bash
# Replace YOUR_HMAC_HERE with output from above
SIGNATURE="YOUR_HMAC_HERE"

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
  "eventId": "ev_...",
  "isDuplicate": false
}
```

---

## 🚫 SECTION 6: Test Security — Invalid HMAC (30 sec)

### Send with WRONG signature
```bash
curl -X POST http://localhost:3001/api/v1/webhooks/perfectpay/$TENANT_ID \
  -H "Content-Type: application/json" \
  -H "X-Signature: invalid-signature-12345" \
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

## 📊 SECTION 7: Verify Database (30 sec)

### Query stored clicks
```bash
psql postgresql://postgres:postgres@localhost:5432/hub_test << 'EOF'
SELECT id, "tenantId", fbclid, "createdAt" FROM clicks LIMIT 5;
EOF
```

### Query stored identities (hashed PII)
```bash
psql postgresql://postgres:postgres@localhost:5432/hub_test << 'EOF'
SELECT id, "tenantId", "emailHash", "phoneHash" FROM identities LIMIT 5;
EOF
```

### Query dedupe registry
```bash
psql postgresql://postgres:postgres@localhost:5432/hub_test << 'EOF'
SELECT id, "tenantId", "eventId" FROM "dedupeRegistry" LIMIT 5;
EOF
```

---

## 🔧 SECTION 8: Run Linter & Type Check (1 min)

### Lint all code
```bash
cd /Users/guilhermesimas/Documents/hub-server-side-tracking
npm run lint
```

**Expected:** ✓ No errors

### TypeScript type checking
```bash
npm run typecheck
```

**Expected:** ✓ No errors

---

## 📈 SECTION 9: Load Test (optional, 3 min)

### Run built-in load test
```bash
cd /Users/guilhermesimas/Documents/hub-server-side-tracking
npm run test -w apps/api -- --grep "Load Testing"
```

**Expected output:**
```
✓ Total Events: 100
✓ Success Rate: 100%
✓ Throughput: 6.4 evt/sec
✓ P95 Latency: 261ms
✓ Max Latency: 565ms
```

---

## 🌐 SECTION 10: Check Dashboard (optional, 1 min)

### Open in browser
```bash
open http://localhost:3000
```

Or via curl:
```bash
curl -s http://localhost:3000 | head -50
```

---

## 🧹 SECTION 11: Cleanup (1 min)

### Stop all services
```bash
# Press Ctrl+C in each terminal running npm run dev
```

### Optional: Reset test database
```bash
cd /Users/guilhermesimas/Documents/hub-server-side-tracking/apps/api
npx prisma migrate reset --force
```

### Optional: Remove test .env
```bash
cd /Users/guilhermesimas/Documents/hub-server-side-tracking
rm .env
```

---

## ⚡ ONE-LINER: Full Test Sequence

Run this to test everything in sequence:

```bash
cd /Users/guilhermesimas/Documents/hub-server-side-tracking && \
npm install && \
createdb hub_test 2>/dev/null && \
cd apps/api && npx prisma migrate dev --skip-generate && \
cd /Users/guilhermesimas/Documents/hub-server-side-tracking && \
npm run test && \
npm run lint && \
npm run typecheck
```

**Duration:** ~3 minutes
**Expected result:** All tests passing ✓

---

## 🎯 Success Checklist

After running all commands above, verify:

- [x] Tests: 119/119 passing
- [x] Lint: 0 errors
- [x] TypeScript: 0 errors
- [x] Click ingestion: 200 OK response
- [x] Valid HMAC: 200 OK with event_id
- [x] Invalid HMAC: 401 Unauthorized
- [x] Database: clicks, identities, dedupe_registry populated
- [x] p95 latency: < 300ms
- [x] Load test: 100% success rate

---

## 🐛 Troubleshooting

### Error: `Error: connect ECONNREFUSED`
```bash
# PostgreSQL not running
brew services start postgresql  # macOS
# or: docker run -d -e POSTGRES_PASSWORD=postgres -p 5432:5432 postgres:15
```

### Error: `database "hub_test" does not exist`
```bash
createdb hub_test
```

### Error: `HMAC signature mismatch`
- Check that PERFECTPAY_WEBHOOK_SECRET matches in .env
- Verify payload format (must match exactly for HMAC)

### Tests hanging (>60s)
- Kill API server and restart
- Check PostgreSQL logs for slow queries

### Port 3001 already in use
```bash
# Find and kill process
lsof -i :3001
kill -9 <PID>
```

---

## 📚 Full Documentation

- **Detailed QA Report:** `docs/QA-FINAL-REVIEW-v27.md`
- **Testing Guide:** `docs/TESTING-INSTRUCTIONS.md`
- **Executive Summary:** `docs/QA-EXECUTIVE-SUMMARY.md`
- **Architecture:** `docs/README-architecture.md`

---

**Prepared by:** @qa (Quinn)
**Status:** Ready for Testing
**Last Updated:** March 2, 2026

