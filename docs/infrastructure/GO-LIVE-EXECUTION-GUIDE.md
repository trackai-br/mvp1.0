# GO-LIVE EXECUTION GUIDE

**Date:** 2026-02-25
**Owner:** @devops (Gage)
**Audience:** DevOps Team / Customer Success

---

## 📋 STEP-BY-STEP INSTRUCTIONS

### STEP 1: Monitor Workflow Completion (⏳ 1-2 min)

Workflow #39 é o gatekeeper. Ele vai:
1. Build Docker image com novo entrypoint.sh
2. Push image para ECR
3. Atualizar ECS service com força para nova deployment

**Check status:**
```bash
gh run list --repo trackai-br/mvp1.0 --limit 1 --json status,name,conclusion
```

**Esperado quando completado:**
```
status: completed
conclusion: success
```

---

### STEP 2: Verificar Container Iniciou (⏳ 2-3 min)

Uma vez workflow completado, o novo container vai iniciar. Precisamos verificar que iniciou corretamente.

**Check se há logs:**
```bash
# Listar log streams (containers) do ECS
aws logs describe-log-streams \
  --log-group-name /ecs/hub-server-side-tracking \
  --order-by LastEventTime \
  --descending \
  --query 'logStreams[0].logStreamName' \
  --output text
```

**Ver últimos logs (deve conter "✅ Tudo pronto"):**
```bash
# Substitua STREAM_NAME com output do comando acima
aws logs get-log-events \
  --log-group-name /ecs/hub-server-side-tracking \
  --log-stream-name {STREAM_NAME} \
  --query 'events[].message' \
  --output text | tail -20
```

**Esperado:**
```
⏳ Aguardando injeção de secrets (5s)...
🔍 Validando DATABASE_URL...
✅ DATABASE_URL encontrada (length: 98)
🔗 Testando conectividade ao banco de dados...
🔄 Executando Prisma migrations...
✅ Migrations executadas com sucesso
✅ Tudo pronto. Iniciando servidor na porta 3001...
```

**Verificar health endpoint:**
```bash
# Obter ALB DNS
ALB_DNS=$(aws elbv2 describe-load-balancers \
  --names hub-server-side-tracking-alb \
  --query 'LoadBalancers[0].DNSName' \
  --output text)

# Test health endpoint
curl -v http://$ALB_DNS/api/v1/health
```

**Esperado:**
```
< HTTP/1.1 200 OK
{"status":"ok","db":"connected"}
```

---

### STEP 3: Create Missing Webhook Secrets (⏳ 10 min)

**AÇÃO NECESSÁRIA: Você precisa fornecer os 4 webhook secrets:**

```bash
# Comando interativo para criar os 4 secrets
bash /tmp/create-secrets.sh

# OU manualmente, um por um:

# 1. PerfectPay
aws secretsmanager create-secret \
  --name perfectpay-webhook-secret \
  --secret-string "YOUR_PERFECTPAY_SECRET_HERE" \
  --region us-east-1

# 2. Hotmart
aws secretsmanager create-secret \
  --name hotmart-webhook-secret \
  --secret-string "YOUR_HOTMART_SECRET_HERE" \
  --region us-east-1

# 3. Kiwify
aws secretsmanager create-secret \
  --name kiwify-webhook-secret \
  --secret-string "YOUR_KIWIFY_SECRET_HERE" \
  --region us-east-1

# 4. Stripe
aws secretsmanager create-secret \
  --name stripe-webhook-secret \
  --secret-string "YOUR_STRIPE_SECRET_HERE" \
  --region us-east-1
```

**Verificar se foram criadas:**
```bash
aws secretsmanager list-secrets \
  --query 'SecretList[?contains(Name, `webhook`)].Name' \
  --output text
```

**Esperado:**
```
perfectpay-webhook-secret   hotmart-webhook-secret   kiwify-webhook-secret   stripe-webhook-secret
```

---

### STEP 4: Update ECS Task Definition (⏳ 2 min)

ECS task definition precisa referenciar os novos secrets. Mas antes, vamos verificar qual versão temos:

```bash
# Obter última task definition
aws ecs describe-task-definition \
  --task-definition hub-server-side-tracking:1 \
  --query 'taskDefinition.[family, revision]' \
  --output text
```

**Esperado:**
```
hub-server-side-tracking	1
```

Se precisa atualizar (adicionar refs aos novos secrets):
```bash
# NOTA: Isso requer editar a task definition.
# Command: Delegate to @devops to update task definition JSON
# or use AWS Console: ECS → Task Definitions → Select → New Revision
```

Para agora, vamos verificar se os secrets já estão na task definition atual:
```bash
aws ecs describe-task-definition \
  --task-definition hub-server-side-tracking:1 \
  --query 'taskDefinition.containerDefinitions[0].secrets[*].[name, valueFrom]' \
  --output table
```

---

### STEP 5: Scale ECS Service to 2 Replicas (⏳ 1 min)

Para alta disponibilidade, precisamos de 2 replicas:

```bash
# Verificar replicas atuais
aws ecs describe-services \
  --cluster hub-server-side-tracking-cluster \
  --services hub-server-side-tracking-service \
  --query 'services[0].[desiredCount, runningCount]'
```

**Escalar para 2:**
```bash
aws ecs update-service \
  --cluster hub-server-side-tracking-cluster \
  --service hub-server-side-tracking-service \
  --desired-count 2

# Aguardar ambas as tasks ficarem RUNNING (2-3 min)
watch -n 2 'aws ecs describe-services \
  --cluster hub-server-side-tracking-cluster \
  --services hub-server-side-tracking-service \
  --query "services[0].[runningCount, desiredCount]"'
```

---

### STEP 6: Execute Smoke Test (⏳ 30 min)

Agora vamos testar o flow completo: Click → Conversion → Meta CAPI

#### 6.1: Create Test Tenant

```bash
# Connect to RDS
PSQL_CMD="psql -h YOUR_RDS_ENDPOINT -U admin -d track_ai"

# Create tenant
$PSQL_CMD -c "
INSERT INTO tenant (id, slug, name, status, created_at, updated_at)
VALUES (
  'test-tenant-001',
  'test-tenant-001',
  'MVP Test Account',
  'active',
  NOW(),
  NOW()
) ON CONFLICT DO NOTHING;
"

# Verify
$PSQL_CMD -c "SELECT id, slug, status FROM tenant WHERE slug = 'test-tenant-001';"
```

#### 6.2: Generate Test Click

```bash
# Get ALB DNS
ALB_DNS=$(aws elbv2 describe-load-balancers \
  --names hub-server-side-tracking-alb \
  --query 'LoadBalancers[0].DNSName' \
  --output text)

# Send test click
curl -X POST http://$ALB_DNS/api/v1/track/click \
  -H "x-tenant-id: test-tenant-001" \
  -H "Content-Type: application/json" \
  -d '{
    "fbclid": "test-fbclid-001",
    "fbc": "fb.1.123456789.test",
    "fbp": "fb.1.123456789.test",
    "utm_source": "google",
    "utm_medium": "cpc",
    "utm_campaign": "test",
    "ip": "192.168.1.1",
    "userAgent": "Mozilla/5.0"
  }'

# Expected response: 201 {"id": "click-001"}
```

#### 6.3: Verify Click in Database

```bash
$PSQL_CMD -c "
SELECT id, tenant_id, fbclid, created_at FROM click
WHERE tenant_id = 'test-tenant-001'
ORDER BY created_at DESC LIMIT 1;
"

# Expected: 1 row with click-001
```

#### 6.4: Send Test Conversion (PerfectPay)

```bash
# Generate HMAC signature for webhook
# Use: SECRET from Secrets Manager + request body
# HMAC-SHA256(body, secret)

WEBHOOK_SECRET="YOUR_PERFECTPAY_SECRET"
BODY='{"order_id":"test-order-001","customer":{"email":"test@example.com","phone":"+5511999999999"},"amount":99.90,"currency":"BRL","status":"approved"}'

SIGNATURE=$(echo -n "$BODY" | openssl dgst -sha256 -hmac "$WEBHOOK_SECRET" -hex | cut -d' ' -f2)

# Send webhook
curl -X POST http://$ALB_DNS/api/v1/webhooks/perfectpay/test-tenant-001 \
  -H "x-perfectpay-signature: $SIGNATURE" \
  -H "Content-Type: application/json" \
  -d "$BODY"

# Expected response: 202 {"ok": true}
```

#### 6.5: Verify Conversion & Match

```bash
$PSQL_CMD -c "
SELECT COUNT(*) as conversion_count FROM conversion
WHERE tenant_id = 'test-tenant-001';
"

$PSQL_CMD -c "
SELECT COUNT(*) as match_count FROM match_log
WHERE tenant_id = 'test-tenant-001';
"

# Expected: 1 conversion, 1 match
```

#### 6.6: Check SQS Dispatch Queue

```bash
aws sqs get-queue-attributes \
  --queue-url https://sqs.us-east-1.amazonaws.com/571944667101/capi-dispatch \
  --attribute-names ApproximateNumberOfMessages,ApproximateNumberOfMessagesNotVisible

# Expected: 1 message in flight (being processed)
```

#### 6.7: Verify Meta CAPI Dispatch

```bash
# Wait 30 seconds for dispatch worker to process

$PSQL_CMD -c "
SELECT id, conversion_id, status, http_status, error_message, created_at
FROM dispatch_attempt
WHERE conversion_id IN (
  SELECT id FROM conversion WHERE tenant_id = 'test-tenant-001'
)
ORDER BY created_at DESC
LIMIT 1;
"

# Expected: status='sent', http_status=200, no error_message
```

---

### STEP 7: Verify Dashboard (⏳ 5 min)

```bash
# Open browser to dashboard
# URL: https://dashboard.track-ai.com/analytics (or local equivalent)

# Expected to see:
# - KPI cards: 1 event, 100% success, 1 match
# - Events table: test event visible
# - No errors in DLQ
```

---

### STEP 8: Create First Real Customer (⏳ 10 min)

Once smoke test passes:

```bash
# Get customer info from sales/PM
CUSTOMER_ID="customer-001"
CUSTOMER_NAME="Your Customer Name"
CUSTOMER_EMAIL="customer@example.com"

# Create tenant in database
$PSQL_CMD -c "
INSERT INTO tenant (id, slug, name, status, admin_email, created_at, updated_at)
VALUES (
  '$CUSTOMER_ID',
  '$CUSTOMER_ID',
  '$CUSTOMER_NAME',
  'active',
  '$CUSTOMER_EMAIL',
  NOW(),
  NOW()
);
"

# Create funnel for customer
$PSQL_CMD -c "
INSERT INTO funnel (id, tenant_id, name, status, gateway, created_at, updated_at)
VALUES (
  'funnel-001',
  '$CUSTOMER_ID',
  '${CUSTOMER_NAME} Main Funnel',
  'active',
  'hotmart',
  NOW(),
  NOW()
);
"

# Share access with customer
echo "Tenant ID: $CUSTOMER_ID"
echo "Login URL: https://dashboard.track-ai.com/login"
echo "Share with: $CUSTOMER_EMAIL"
```

---

## ✅ SUCCESS CHECKLIST

After completing all steps above, verify:

- [ ] Workflow #39 completed successfully
- [ ] Container logs show "✅ Tudo pronto"
- [ ] Health endpoint returns 200 OK
- [ ] All 4 webhook secrets created
- [ ] ECS service scaled to 2 replicas, both RUNNING
- [ ] Test tenant created in database
- [ ] Test click sent and persisted
- [ ] Test conversion sent and matched
- [ ] SQS dispatch queue processed message
- [ ] Meta CAPI dispatch_attempt shows status='sent'
- [ ] Dashboard shows 1 event, 100% success, 1 match
- [ ] First real customer tenant created
- [ ] First real customer can login to dashboard

---

## 🚨 TROUBLESHOOTING

### Workflow #39 Still Pending After 30 min
- Check GitHub Actions UI: https://github.com/trackai-br/mvp1.0/actions
- Look for error messages in workflow logs
- Manual fallback: Build & push image manually

### Container Not Starting (no logs in CloudWatch)
- Check ECS task definition for incorrect image URI
- Verify secrets are accessible to IAM role
- Check ALB target health (should be HEALTHY)

### Smoke Test Step Fails at Conversion
- Verify webhook secret matches in Secrets Manager
- Check HMAC signature calculation
- Verify tenant_id is correct in request

### Dashboard Shows 0 Events
- Verify analytics views were created
- Check if refresh job ran successfully
- Manually refresh materialized views:
  ```bash
  $PSQL_CMD -c "REFRESH MATERIALIZED VIEW v_dispatch_summary;"
  ```

---

## 📞 CONTACTS

- **Deployment Issues:** @devops
- **Code Issues:** @dev
- **Testing Issues:** @qa
- **Overall Coordination:** @pm
- **Escalation:** @aios-master

---

*Generated: 2026-02-25 21:40 UTC*
*Last Updated By: @devops (Gage)*
