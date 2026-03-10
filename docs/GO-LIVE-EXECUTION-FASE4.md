# 🚀 FASE 4 — GO-LIVE EXECUTION (Real Customer: MINUTOS PAGOS)

**Data:** 2026-03-10
**Cliente:** MINUTOS PAGOS
**Email:** guilhermesimas542@gmail.com
**Gateway:** PerfectPay
**URL:** institutonexxa.com
**Status:** INICIADO ✅

---

## 📊 3-STEP EXECUTION PLAN

### ETAPA 1: Infrastructure Verification ✅ COMPLETA
```
✅ SQS queues (capi-dispatch + DLQ) — CONFIGURED
✅ Meta CAPI credentials (Secrets Manager) — CONFIGURED
✅ CloudWatch alarms (8 total) — CONFIGURED
✅ ECS cluster — READY FOR VERIFICATION
```

---

### ETAPA 2: Smoke Test (Click → Conversion → Meta CAPI)

#### Step 1: Criar Test Tenant
```bash
# Usar dados do cliente para criar tenant de teste
TENANT_SLUG="minutos-pagos-test"
TENANT_NAME="MINUTOS PAGOS - Test"
ADMIN_EMAIL="guilhermesimas542@gmail.com"

# SQL para executar em production DB:
INSERT INTO tenant (id, slug, name, status, created_at, updated_at)
VALUES (
  gen_random_uuid(),
  'minutos-pagos-test',
  'MINUTOS PAGOS - Test',
  'active',
  NOW(),
  NOW()
);
```

#### Step 2: Generate Test Click
```bash
curl -X POST http://localhost:3001/api/v1/track/click \
  -H "x-tenant-id: <TENANT_ID>" \
  -H "Content-Type: application/json" \
  -d '{
    "fbclid": "test-minutos-001",
    "fbc": "fb.1.123456789.minutos",
    "fbp": "fb.1.123456789.minutos",
    "utm_source": "instagram",
    "utm_medium": "cpc",
    "utm_campaign": "minutos-pagos-test",
    "ip": "186.192.1.1",
    "userAgent": "Mozilla/5.0 (test)"
  }'

# Expected: 201 { "id": "...", "tenantId": "..." }
```

#### Step 3: Send Test Conversion (PerfectPay)
```bash
# Gerar HMAC signature:
# Secret: ${PERFECTPAY_WEBHOOK_SECRET}
# Payload: {"order_id": "minutos-001", "customer": {...}}

curl -X POST http://localhost:3001/api/v1/webhooks/perfectpay/<TENANT_ID> \
  -H "x-perfectpay-signature: {HMAC_SIGNATURE}" \
  -H "Content-Type: application/json" \
  -d '{
    "order_id": "minutos-001",
    "customer": {
      "email": "guilhermesimas542@gmail.com",
      "phone": "+55-11-99999-9999"
    },
    "amount": 199.90,
    "currency": "BRL",
    "status": "approved"
  }'

# Expected: 202 { "ok": true, "isDuplicate": false }
```

#### Step 4: Verify Data Flow
```bash
# Check clicks
SELECT COUNT(*) as clicks FROM click WHERE tenant_id = '<TENANT_ID>';
# Expected: 1

# Check conversions
SELECT COUNT(*) as conversions FROM conversion WHERE tenant_id = '<TENANT_ID>';
# Expected: 1

# Check matches
SELECT COUNT(*) as matches FROM match_log WHERE conversion_id IN
  (SELECT id FROM conversion WHERE tenant_id = '<TENANT_ID>');
# Expected: 1 (FBC match)
```

#### Step 5: Verify SQS Dispatch
```bash
aws sqs get-queue-attributes \
  --queue-url https://sqs.us-east-1.amazonaws.com/751702759697/capi-dispatch \
  --attribute-names ApproximateNumberOfMessages

# Expected: 1 message (test conversion enqueued for Meta)
```

#### Step 6: Verify Meta CAPI Dispatch
```bash
# Wait 30 seconds for worker to process

SELECT * FROM dispatch_attempt
WHERE created_at > NOW() - INTERVAL '1 minute'
ORDER BY created_at DESC LIMIT 1;

# Expected: status='sent', http_status=200, response contains event_id
```

---

### ETAPA 3: Real Customer Onboarding

#### Step 1: Create Production Tenant
```sql
INSERT INTO tenant (id, slug, name, status, created_at, updated_at)
VALUES (
  gen_random_uuid(),
  'minutos-pagos',
  'MINUTOS PAGOS',
  'active',
  NOW(),
  NOW()
) RETURNING id, slug;
```

**Resultado esperado:** Tenant ID para usar nos próximos passos

#### Step 2: Configure Funnel
```sql
INSERT INTO funnel (
  id,
  tenant_id,
  name,
  description,
  gateway,
  status,
  created_at,
  updated_at
)
VALUES (
  gen_random_uuid(),
  '<TENANT_ID>',
  'Minutos Pagos - Instituton Nexxa',
  'Primary funnel for minutos-pagos campaign',
  'perfectpay',
  'active',
  NOW(),
  NOW()
) RETURNING id;
```

#### Step 3: Generate Customer Tracking Pixel Code
```javascript
// Código para implantar em institutonexxa.com
<script>
  (function() {
    const tenantId = '<TENANT_ID>';
    const pixelScript = document.createElement('script');
    pixelScript.src = 'https://api.track-ai.com/pixel.js';
    pixelScript.async = true;
    pixelScript.onload = function() {
      window.trackAI = window.trackAI || {};
      window.trackAI.init({
        tenantId: tenantId,
        fbc: getFbcFromUrl() || getCookieValue('fbc'),
        fbp: getFbpFromUrl() || getCookieValue('fbp'),
        fbclid: getFbclidFromUrl()
      });
    };
    document.head.appendChild(pixelScript);
  })();
</script>
```

#### Step 4: Test First Click on Customer Site
1. Acesse: https://institutonexxa.com (com tracking pixel instalado)
2. Clique em um anúncio da campanha
3. Verifique em dashboard se click foi capturado

#### Step 5: Monitor Real Conversion Flow
```sql
-- Query para monitorar conversões em tempo real
SELECT
  c.id,
  c.gateway,
  c.amount,
  ml.match_strategy,
  da.status,
  da.http_status,
  da.created_at
FROM conversion c
LEFT JOIN match_log ml ON ml.conversion_id = c.id
LEFT JOIN dispatch_attempt da ON da.conversion_id = c.id
WHERE c.tenant_id = '<TENANT_ID>'
ORDER BY c.created_at DESC
LIMIT 10;
```

---

## ✅ Success Criteria

- [ ] Smoke test: Click → Conversion → Meta CAPI ✅
- [ ] Real customer tenant created
- [ ] Funnel configured in dashboard
- [ ] Tracking pixel deployed on customer site
- [ ] First real click captured and matched
- [ ] Conversion flowing to Meta CAPI
- [ ] Dashboard showing live metrics
- [ ] Zero errors in CloudWatch logs

---

## 🚨 Troubleshooting

### If Click Not Captured
```bash
# Check API logs
aws logs tail /ecs/track-ai-api --follow

# Verify tenant exists
SELECT * FROM tenant WHERE slug = 'minutos-pagos';
```

### If Conversion Not Matched
```bash
# Check match logs
SELECT * FROM match_log WHERE conversion_id = '...' LIMIT 1;

# Verify click and conversion PII match
SELECT c.id, c.email_hash FROM click c WHERE tenant_id = '<TENANT_ID>';
SELECT c.id, c.email_hash FROM conversion c WHERE tenant_id = '<TENANT_ID>';
```

### If Meta CAPI Dispatch Fails
```bash
# Check dispatch attempts
SELECT * FROM dispatch_attempt WHERE conversion_id = '...' LIMIT 5;

# Check circuit breaker status
SELECT * FROM circuit_breaker_state ORDER BY updated_at DESC LIMIT 1;

# Check DLQ messages
aws sqs receive-message \
  --queue-url https://sqs.us-east-1.amazonaws.com/751702759697/capi-dispatch-dlq \
  --max-number-of-messages 1
```

---

**Status:** 🟡 AWAITING MANUAL EXECUTION

Uma vez que há issue de conectividade com Supabase pooler, os passos SQL precisam ser executados manualmente através de:
1. AWS RDS Console (Query Editor)
2. Local psql com porta 5432 (direct connection)
3. Ou through existing application API

