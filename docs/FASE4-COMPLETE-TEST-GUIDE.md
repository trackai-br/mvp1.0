# 🧪 FASE 4 — COMPLETE END-TO-END TEST GUIDE

**Customer:** MINUTOS PAGOS
**Email:** guilhermesimas542@gmail.com
**Gateway:** PerfectPay
**URL:** institutonexxa.com

**Total Time:** ~20 minutes
**Status:** Ready to Execute

---

## ✅ PASSO 1: Onboard Customer via Admin API (2 min)

### 1.1 — Abra seu terminal

```bash
cd /Users/guilhermesimas/Documents/hub-server-side-tracking
```

### 1.2 — Execute o curl para criar customer

```bash
curl -X POST http://localhost:3001/api/v1/admin/onboard-customer \
  -H "Content-Type: application/json" \
  -d '{
    "companyName": "MINUTOS PAGOS",
    "email": "guilhermesimas542@gmail.com",
    "gateway": "perfectpay",
    "funnelName": "Minutos Pagos - Instituton Nexxa",
    "funnelUrl": "https://institutonexxa.com"
  }'
```

### 1.3 — Resultado esperado

```json
{
  "success": true,
  "tenantId": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
  "funnelId": "xxxxxxxx",
  "tenantSlug": "minutos-pagos",
  "webhookUrl": "https://api.track-ai.com/api/v1/webhooks/perfectpay/xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
  "trackingPixelCode": "<!-- Track AI Pixel - 2026-03-10T... -->\n<script async>...",
  "message": "✅ Customer onboarded successfully. Deploy tracking pixel on https://institutonexxa.com."
}
```

### ⚠️ **COPIE ESTES VALORES:**

```
TENANT_ID = xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
FUNNEL_ID = xxxxxxxx
WEBHOOK_URL = https://api.track-ai.com/api/v1/webhooks/perfectpay/xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
```

✅ **Step 1 Complete!**

---

## ✅ PASSO 2: Verify Database (2 min)

### 2.1 — Verificar que tenant foi criado

Como não conseguimos acessar o database diretamente (Supabase pooler issue), vamos usar a API para verificar.

```bash
curl http://localhost:3001/api/v1/health
```

**Esperado:**
```json
{
  "status": "ok",
  "db": "connected",
  "project": "Track AI"
}
```

### 2.2 — Verificar que customer existe

Para confirmar que o tenant foi criado com sucesso, vamos fazer um curl para um endpoint futuro ou confiar no status OK.

✅ **Step 2 Complete!**

---

## ✅ PASSO 3: Generate Test Click (3 min)

### 3.1 — Crie arquivo de teste

```bash
cat > /tmp/test-click.sh << 'EOF'
#!/bin/bash

TENANT_ID="PASTE_YOUR_TENANT_ID_HERE"

curl -X POST http://localhost:3001/api/v1/track/click \
  -H "x-tenant-id: $TENANT_ID" \
  -H "Content-Type: application/json" \
  -d '{
    "fbclid": "test-fbclid-001",
    "fbc": "fb.1.123456789.minutos",
    "fbp": "fb.1.123456789.minutos",
    "utm_source": "instagram",
    "utm_medium": "cpc",
    "utm_campaign": "minutos-pagos-test",
    "ip": "186.192.1.1",
    "userAgent": "Mozilla/5.0 (Test Browser)"
  }'

EOF
chmod +x /tmp/test-click.sh
```

### 3.2 — Substitua TENANT_ID

```bash
sed -i "s/PASTE_YOUR_TENANT_ID_HERE/YOUR_ACTUAL_TENANT_ID/g" /tmp/test-click.sh
```

### 3.3 — Execute

```bash
/tmp/test-click.sh
```

**Esperado (201 Created):**
```json
{
  "id": "click-uuid-here",
  "tenantId": "your-tenant-id",
  "fbc": "fb.1.123456789.minutos",
  "fbp": "fb.1.123456789.minutos"
}
```

### ⚠️ **COPIE:**
```
CLICK_ID = click-uuid-aqui
```

✅ **Step 3 Complete!**

---

## ✅ PASSO 4: Generate HMAC Signature (2 min)

### 4.1 — Criar script para gerar HMAC

```bash
cat > /tmp/generate-hmac.js << 'EOF'
const crypto = require('crypto');

// Pega secret do .env
const secret = process.env.PERFECTPAY_WEBHOOK_SECRET || 'test-secret-key';

// Payload que vamos enviar
const payload = {
  order_id: "minutos-001",
  customer: {
    email: "guilhermesimas542@gmail.com",
    phone: "+5511999999999"
  },
  amount: 199.90,
  currency: "BRL",
  status: "approved"
};

// Converte para JSON string
const jsonString = JSON.stringify(payload);

// Gera HMAC-SHA256
const signature = crypto
  .createHmac('sha256', secret)
  .update(jsonString, 'utf8')
  .digest('hex');

console.log('Secret:', secret);
console.log('Payload:', jsonString);
console.log('HMAC Signature:', signature);
EOF
```

### 4.2 — Execute para gerar HMAC

```bash
node /tmp/generate-hmac.js
```

**Output:**
```
Secret: test-secret-key
Payload: {"order_id":"minutos-001",...}
HMAC Signature: abc123def456...
```

### ⚠️ **COPIE:**
```
HMAC_SIGNATURE = abc123def456...
```

✅ **Step 4 Complete!**

---

## ✅ PASSO 5: Send Test Conversion via Webhook (3 min)

### 5.1 — Crie script de conversion

```bash
cat > /tmp/test-conversion.sh << 'EOF'
#!/bin/bash

TENANT_ID="PASTE_TENANT_ID"
HMAC_SIGNATURE="PASTE_HMAC_SIGNATURE"

curl -X POST "http://localhost:3001/api/v1/webhooks/perfectpay/$TENANT_ID" \
  -H "x-perfectpay-signature: $HMAC_SIGNATURE" \
  -H "Content-Type: application/json" \
  -d '{
    "order_id": "minutos-001",
    "customer": {
      "email": "guilhermesimas542@gmail.com",
      "phone": "+5511999999999"
    },
    "amount": 199.90,
    "currency": "BRL",
    "status": "approved"
  }'

EOF
chmod +x /tmp/test-conversion.sh
```

### 5.2 — Substitua valores

```bash
sed -i "s/PASTE_TENANT_ID/YOUR_TENANT_ID/g" /tmp/test-conversion.sh
sed -i "s/PASTE_HMAC_SIGNATURE/YOUR_HMAC_SIGNATURE/g" /tmp/test-conversion.sh
```

### 5.3 — Execute

```bash
/tmp/test-conversion.sh
```

**Esperado (202 Accepted):**
```json
{
  "ok": true
}
```

✅ **Step 5 Complete!**

---

## ✅ PASSO 6: Verify Conversion in Database (2 min)

### 6.1 — Use psql para verificar (se disponível)

```bash
# Se tiver psql instalado localmente
psql postgresql://user:password@host:5432/db << 'EOF'
SELECT COUNT(*) as conversions FROM conversion
WHERE tenant_id = 'YOUR_TENANT_ID';

SELECT COUNT(*) as matches FROM match_log
WHERE conversion_id IN
  (SELECT id FROM conversion WHERE tenant_id = 'YOUR_TENANT_ID');
EOF
```

**Esperado:**
```
conversions = 1
matches = 1
```

### 6.2 — Alternative: Check logs

```bash
tail -100 /tmp/track-ai-api.log | grep -i "conversion\|match"
```

✅ **Step 6 Complete!**

---

## ✅ PASSO 7: Verify SQS Dispatch Queue (2 min)

### 7.1 — Verifique que conversion está em fila para Meta CAPI

```bash
aws sqs get-queue-attributes \
  --queue-url https://sqs.us-east-1.amazonaws.com/751702759697/capi-dispatch \
  --attribute-names ApproximateNumberOfMessages \
  --region us-east-1
```

**Esperado:**
```json
{
  "Attributes": {
    "ApproximateNumberOfMessages": "1"
  }
}
```

⚠️ Se der erro de credenciais, skip este passo (não afeta o teste local).

✅ **Step 7 Complete!**

---

## ✅ PASSO 8: Monitor CloudWatch Dispatch (3 min)

### 8.1 — Aguarde 30 segundos

O worker SQS processa eventos a cada 5 segundos. Aguarde para garantir processamento.

```bash
sleep 30
echo "Checking dispatch status..."
```

### 8.2 — Verifique em CloudWatch (se tiver acesso)

```bash
aws logs tail /ecs/track-ai-api --follow --region us-east-1
```

**Procure por:**
```
[capi-dispatch] Sending event to Meta CAPI
[capi-dispatch] Success: event_id=...
```

### 8.3 — Alternative: Check local logs

```bash
grep -i "dispatch\|capi" /var/log/track-ai/*.log 2>/dev/null || echo "Logs not available locally"
```

✅ **Step 8 Complete!**

---

## ✅ PASSO 9: End-to-End Verification (2 min)

### 9.1 — Crie relatório de teste

```bash
cat > /tmp/test-report.md << 'EOF'
# FASE 4 Test Report

## Customer Onboarding
- [ ] Endpoint responded with 201
- [ ] tenantId was generated
- [ ] funnelId was generated
- [ ] webhookUrl is correct format
- [ ] trackingPixelCode was returned

## Click Tracking
- [ ] Click API responded with 201
- [ ] Click was persisted in database
- [ ] clickId was returned

## Conversion Webhook
- [ ] Webhook accepted (202)
- [ ] HMAC signature was valid
- [ ] Conversion was created in database

## Matching
- [ ] FBC match found (click → conversion)
- [ ] MatchLog was created
- [ ] Match strategy = "fbc"

## SQS Dispatch
- [ ] Conversion was enqueued
- [ ] SQS queue has 1 message
- [ ] Worker processed message

## Meta CAPI
- [ ] Dispatch attempt logged
- [ ] Status = "success"
- [ ] HTTP status = 200

## Overall Result
- [ ] ALL TESTS PASSED ✅
EOF

cat /tmp/test-report.md
```

### 9.2 — Marque conforme avança

À medida que completa cada passo, marque com um `x` no relatório.

✅ **Step 9 Complete!**

---

## 🎯 RESUMO DOS PASSOS

| # | Ação | Comando | Resultado | Tempo |
|---|------|---------|-----------|-------|
| 1 | Onboard Customer | POST /admin/onboard-customer | 201 + tenantId | 30s |
| 2 | Verify DB | GET /health | 200 OK | 5s |
| 3 | Send Click | POST /track/click | 201 + clickId | 30s |
| 4 | Generate HMAC | node generate-hmac.js | HMAC signature | 10s |
| 5 | Send Conversion | POST /webhooks/perfectpay | 202 OK | 30s |
| 6 | Check Conversion | psql query | count = 1 | 10s |
| 7 | Check SQS | aws sqs describe | 1 message | 10s |
| 8 | Monitor Dispatch | aws logs tail | "Success" | 30s |
| 9 | Final Report | Create checklist | All ✅ | 5s |

**TOTAL TIME: ~20 minutes**

---

## 🚨 TROUBLESHOOTING

### Problema: Endpoint retorna 404

**Solução:**
```bash
# Verifique que o server está rodando
curl http://localhost:3001/api/v1/health

# Se retornar erro, inicie o server
npm run dev:api
```

### Problema: HMAC signature inválida

**Solução:**
```bash
# Verifique o secret no .env
cat infra/secrets/.env.local | grep PERFECTPAY_WEBHOOK_SECRET

# Regenere HMAC com o secret correto
node /tmp/generate-hmac.js
```

### Problema: Click não foi criado

**Solução:**
```bash
# Verifique que tenantId está correto
echo $TENANT_ID

# Verifique logs
tail -50 /var/log/track-ai/api.log | grep -i "click"
```

### Problema: Conversion não foi matched

**Solução:**
```bash
# Verifique que FBC está igual em click e conversion
# Click: fb.1.123456789.minutos
# Conversion: fb.1.123456789.minutos (deve ser idêntico)

# Verifique email hash se usando email matching
# SHA256(guilhermesimas542@gmail.com) = ...
```

### Problema: SQS message não foi processado

**Solução:**
```bash
# Aguarde mais tempo (worker tem latência)
sleep 60

# Verifique que worker está rodando
ps aux | grep "capi-dispatch-worker"

# Verifique logs de dispatch
aws logs tail /ecs/track-ai-api --region us-east-1
```

---

## ✅ SUCCESS CRITERIA

All of the following must be TRUE:

- ✅ Customer created (tenantId returned)
- ✅ Click tracked (clickId returned)
- ✅ Conversion received (202 Accepted)
- ✅ Conversion in DB (count = 1)
- ✅ Match found (MatchLog created, strategy = "fbc")
- ✅ SQS has message (count = 1)
- ✅ Dispatch logged (DispatchAttempt status = "success")
- ✅ No errors in CloudWatch

**IF ALL ABOVE PASS: FASE 4 ✅ COMPLETE**

---

## 🚀 NEXT STEPS (After Test Passes)

1. **Document Results** — Save screenshots of CloudWatch dashboard
2. **Customer Communication** — Send tenantId + webhook URL to customer
3. **Deployment** — Customer deploys tracking pixel on institutonexxa.com
4. **Monitor** — Watch for real conversions in production
5. **Celebrate** 🎉 — MINUTOS PAGOS is LIVE!

---

**Ready? Start with PASSO 1! 🚀**

