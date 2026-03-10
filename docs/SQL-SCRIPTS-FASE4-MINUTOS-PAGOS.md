# 📋 SQL Scripts — FASE 4 GO-LIVE (MINUTOS PAGOS)

**Customer:** MINUTOS PAGOS
**Email:** guilhermesimas542@gmail.com
**Gateway:** PerfectPay
**URL:** institutonexxa.com

---

## 🚀 Como Usar

1. Acesse: **https://console.aws.amazon.com/rds/**
2. Clique em **Query Editor** (ou RDS → Databases → seu banco)
3. Conecte com suas credenciais AWS
4. Copy/paste cada script abaixo **na ordem**
5. Clique em **Execute**
6. Anote os IDs gerados (você precisará depois)

---

## ✅ SCRIPT 1: Create Test Tenant

```sql
-- ETAPA 1: Criar tenant de teste para smoke test
INSERT INTO public.tenant (
  id,
  slug,
  name,
  status,
  created_at,
  updated_at
)
VALUES (
  gen_random_uuid(),
  'minutos-pagos-test',
  'MINUTOS PAGOS - Test',
  'active',
  NOW(),
  NOW()
)
RETURNING id, slug, name;
```

**⚠️ COPIE O ID RETORNADO** — você vai precisar como `<TEST_TENANT_ID>` nos próximos passos.

Exemplo de resultado:
```
id                                  | slug                | name
------------------------------------+---------------------+------------------------
550e8400-e29b-41d4-a716-446655440000 | minutos-pagos-test  | MINUTOS PAGOS - Test
```

---

## ✅ SCRIPT 2: Create Test WebhookRaw (for smoke test)

```sql
-- ETAPA 2: Criar webhook raw para smoke test
-- SUBSTITUA: <TEST_TENANT_ID> com o ID do script anterior
INSERT INTO public.webhook_raw (
  id,
  tenant_id,
  gateway,
  gateway_event_id,
  raw_payload,
  created_at,
  updated_at
)
VALUES (
  gen_random_uuid(),
  '<TEST_TENANT_ID>',
  'perfectpay',
  'test-webhook-001',
  '{"test": true, "order_id": "test-order-001"}'::jsonb,
  NOW(),
  NOW()
)
RETURNING id;
```

**⚠️ COPIE O ID RETORNADO** — você vai precisar como `<TEST_WEBHOOK_ID>`.

---

## ✅ SCRIPT 3: Create Test Click

```sql
-- ETAPA 3: Criar test click para smoke test
-- SUBSTITUA: <TEST_TENANT_ID> com o ID do Script 1
INSERT INTO public.click (
  id,
  tenant_id,
  fbc,
  fbp,
  fbclid,
  ip,
  user_agent,
  utm_source,
  utm_medium,
  utm_campaign,
  created_at,
  updated_at
)
VALUES (
  gen_random_uuid(),
  '<TEST_TENANT_ID>',
  'fb.1.123456789.minutos-test',
  'fb.1.123456789.minutos-test',
  'test-fbclid-001',
  '186.192.1.1',
  'Mozilla/5.0 (test)',
  'instagram',
  'cpc',
  'minutos-pagos-test',
  NOW(),
  NOW()
)
RETURNING id, tenant_id, fbc;
```

**⚠️ COPIE O ID RETORNADO** — você vai precisar como `<TEST_CLICK_ID>`.

---

## ✅ SCRIPT 4: Create Test Conversion

```sql
-- ETAPA 4: Criar test conversion para smoke test
-- SUBSTITUA:
--   <TEST_TENANT_ID> = ID do Script 1
--   <TEST_WEBHOOK_ID> = ID do Script 2
INSERT INTO public.conversion (
  id,
  tenant_id,
  webhook_raw_id,
  gateway,
  fbc,
  fbp,
  email_hash,
  phone_hash,
  amount,
  currency,
  created_at,
  updated_at
)
VALUES (
  gen_random_uuid(),
  '<TEST_TENANT_ID>',
  '<TEST_WEBHOOK_ID>',
  'perfectpay',
  'fb.1.123456789.minutos-test',
  'fb.1.123456789.minutos-test',
  sha256('guilhermesimas542@gmail.com'),
  sha256('11999999999'),
  199.90,
  'BRL',
  NOW(),
  NOW()
)
RETURNING id, fbc, amount;
```

---

## ✅ SCRIPT 5: Verify Smoke Test Data

```sql
-- ETAPA 5: Verificar que tudo foi criado corretamente
SELECT
  'Tenants' as entity,
  COUNT(*) as total,
  MAX(created_at) as latest
FROM public.tenant
WHERE slug = 'minutos-pagos-test'
UNION ALL
SELECT
  'Clicks',
  COUNT(*),
  MAX(created_at)
FROM public.click
WHERE tenant_id IN (SELECT id FROM public.tenant WHERE slug = 'minutos-pagos-test')
UNION ALL
SELECT
  'Conversions',
  COUNT(*),
  MAX(created_at)
FROM public.conversion
WHERE tenant_id IN (SELECT id FROM public.tenant WHERE slug = 'minutos-pagos-test')
UNION ALL
SELECT
  'WebhookRaw',
  COUNT(*),
  MAX(created_at)
FROM public.webhook_raw
WHERE tenant_id IN (SELECT id FROM public.tenant WHERE slug = 'minutos-pagos-test');
```

**✅ Esperado:** 1 tenant, 1 click, 1 conversion, 1 webhook_raw

---

## ✅ SCRIPT 6: Create Production Tenant

```sql
-- ETAPA 6: Criar tenant de PRODUÇÃO para MINUTOS PAGOS
INSERT INTO public.tenant (
  id,
  slug,
  name,
  status,
  created_at,
  updated_at
)
VALUES (
  gen_random_uuid(),
  'minutos-pagos',
  'MINUTOS PAGOS',
  'active',
  NOW(),
  NOW()
)
RETURNING id, slug, name;
```

**⚠️ COPIE O ID RETORNADO** — você vai precisar como `<PROD_TENANT_ID>` para próximos passos.

Exemplo:
```
id                                  | slug            | name
------------------------------------+-----------------+------------------
660f9511-f39d-52e5-b827-557766551111 | minutos-pagos   | MINUTOS PAGOS
```

---

## ✅ SCRIPT 7: Create Production Funnel

```sql
-- ETAPA 7: Criar funnel de PRODUÇÃO
-- SUBSTITUA: <PROD_TENANT_ID> com o ID do Script 6
INSERT INTO public.funnel (
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
  '<PROD_TENANT_ID>',
  'Minutos Pagos - Instituton Nexxa',
  'Primary funnel for minutos-pagos campaign via PerfectPay',
  'perfectpay',
  'active',
  NOW(),
  NOW()
)
RETURNING id, tenant_id, name, gateway;
```

**⚠️ COPIE O ID RETORNADO** — você vai precisar como `<PROD_FUNNEL_ID>`.

---

## ✅ SCRIPT 8: Verify Production Setup

```sql
-- ETAPA 8: Verificar setup de produção
SELECT
  t.id as tenant_id,
  t.slug,
  t.name,
  f.id as funnel_id,
  f.name as funnel_name,
  f.gateway,
  f.status
FROM public.tenant t
LEFT JOIN public.funnel f ON f.tenant_id = t.id
WHERE t.slug = 'minutos-pagos'
ORDER BY t.created_at DESC;
```

**✅ Esperado:** 1 tenant com 1 funnel (gateway=perfectpay, status=active)

---

## 📝 Summary - IDs Para Guardar

Depois de executar os scripts, você terá:

```
TEST ENVIRONMENT:
├── Test Tenant ID: <TEST_TENANT_ID>
├── Test Webhook ID: <TEST_WEBHOOK_ID>
├── Test Click ID: <TEST_CLICK_ID>
└── Test Conversion ID: <TEST_CONVERSION_ID>

PRODUCTION ENVIRONMENT:
├── Prod Tenant ID: <PROD_TENANT_ID>
└── Prod Funnel ID: <PROD_FUNNEL_ID>
```

**Copie e guarde esses IDs** — você vai precisar para:
1. Smoke test (verificar se conversion vai para Meta CAPI)
2. Dashboard (monitorar eventos em tempo real)
3. Troubleshooting (se algo não funcionar)

---

## 🚀 Próximos Passos Após Executar Scripts

### 1. Smoke Test (verificar flow)
```bash
# Step 1: Verificar data foi criada
curl http://localhost:3001/api/v1/health
# Expected: 200 OK

# Step 2: Simular webhook de conversão
curl -X POST http://localhost:3001/api/v1/webhooks/perfectpay/<TEST_TENANT_ID> \
  -H "x-perfectpay-signature: {HMAC_SIGNATURE}" \
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
# Expected: 202 OK
```

### 2. Verificar SQS Queue
```bash
aws sqs get-queue-attributes \
  --queue-url https://sqs.us-east-1.amazonaws.com/751702759697/capi-dispatch \
  --attribute-names ApproximateNumberOfMessages
# Expected: 1 message
```

### 3. Verificar Meta CAPI Dispatch (aguarde 30s)
```sql
SELECT * FROM public.dispatch_attempt
WHERE created_at > NOW() - INTERVAL '1 minute'
ORDER BY created_at DESC LIMIT 1;
-- Expected: status='sent', http_status=200
```

---

## ✅ CHECKLIST DE EXECUÇÃO

- [ ] Script 1: Test Tenant criado (copie ID)
- [ ] Script 2: Test WebhookRaw criado (copie ID)
- [ ] Script 3: Test Click criado (copie ID)
- [ ] Script 4: Test Conversion criado (copie ID)
- [ ] Script 5: Verificação — 1 de tudo
- [ ] Script 6: Prod Tenant criado (copie ID)
- [ ] Script 7: Prod Funnel criado (copie ID)
- [ ] Script 8: Verificação — 1 tenant + 1 funnel
- [ ] Smoke test executado (click → Meta)
- [ ] SQS queue tem 1 mensagem
- [ ] Dispatch log mostra sucesso

---

**🎯 Quando terminar os scripts, me avisa os IDs e a gente testa o flow completo!**

