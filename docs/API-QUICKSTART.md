# API Quick Start Guide

## 🔐 Autenticação

A API usa **JWT Bearer Token** para todos os endpoints (exceto webhooks).

### Obter um Token JWT

```bash
# 1. Gerar um JWT manualmente com sua JWT_SECRET
# Usando Node.js:
node -e "
const jwt = require('jsonwebtoken');
const secret = 'a3f7b8c1e9d4f5a2b6c8e1d3f5a7b9c1e3f5a7b9c1d3e5f7a9b1c3d5e7f9a1...';
const token = jwt.sign(
  { sub: 'test-tenant', iat: Math.floor(Date.now() / 1000) },
  secret,
  { algorithm: 'HS256', expiresIn: '24h' }
);
console.log(token);
"

# 2. Ou usar JWT online: https://jwt.io
# Header: { alg: 'HS256', typ: 'JWT' }
# Payload: { sub: 'test-tenant', iat: <unix-timestamp> }
# Secret: Sua JWT_SECRET
```

## 🚀 Iniciar o Servidor

```bash
# Navegue até o apps/api
cd apps/api

# Carregar variáveis de ambiente
export $(cat ../../infra/secrets/.env.local | xargs)

# Iniciar em desenvolvimento (porta 3001)
npm run dev

# Output esperado:
# ✅ API running on http://localhost:3001
```

## 📡 Endpoints Disponíveis

### 1️⃣ **Track Click**

```bash
curl -X POST http://localhost:3001/api/v1/track/click \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -d '{
    "fbclid": "abc123xyz789",
    "fbc": "fb.1.1234567890.0987654321",
    "fbp": "fb.1.1111111111.2222222222",
    "utm_source": "google",
    "utm_medium": "cpc",
    "utm_campaign": "test-campaign",
    "ip": "192.168.1.1",
    "user_agent": "Mozilla/5.0..."
  }'
```

**Response** (202 Accepted):
```json
{
  "ok": true,
  "clickId": "cuid_generated_id",
  "message": "Click tracked successfully"
}
```

### 2️⃣ **PerfectPay Webhook**

```bash
# PerfectPay envia automaticamente para:
# POST /api/v1/webhooks/perfectpay/:tenantId

# Exemplo payload que PerfectPay enviaria:
curl -X POST http://localhost:3001/api/v1/webhooks/perfectpay/test-tenant \
  -H "Content-Type: application/json" \
  -H "x-perfectpay-signature: <hmac-sha256>" \
  -d '{
    "id": "evt_perfectpay_12345",
    "type": "purchase_approved",
    "customer": {
      "email": "customer@example.com",
      "first_name": "João",
      "last_name": "Silva",
      "phone": "11999999999",
      "date_of_birth": "1990-05-15",
      "address": {
        "city": "São Paulo",
        "state": "SP",
        "country": "BR",
        "zipcode": "01310-100"
      }
    },
    "purchase": {
      "amount": 299.90,
      "currency": "BRL"
    },
    "fbc": "fb.1.1234567890.0987654321",
    "fbp": "fb.1.1111111111.2222222222"
  }'
```

**Response** (202 Accepted):
```json
{
  "ok": true,
  "webhookRawId": "webhook_id",
  "conversionId": "conversion_id",
  "matchLogId": "matchlog_id",
  "eventId": "evt_perfectpay_12345",
  "gateway": "perfectpay",
  "message": "Webhook accepted and matched"
}
```

### 3️⃣ **Analytics - Match Rate**

```bash
curl -X GET http://localhost:3001/api/v1/analytics/match-rate/test-tenant \
  -H "Authorization: Bearer <JWT_TOKEN>"
```

**Response**:
```json
{
  "total": 100,
  "matched": 78,
  "matchRate": 78,
  "byStrategy": [
    {
      "strategy": "fbc",
      "count": 60,
      "percentage": 60
    },
    {
      "strategy": "fbp",
      "count": 18,
      "percentage": 18
    },
    {
      "strategy": "unmatched",
      "count": 22,
      "percentage": 22
    }
  ]
}
```

### 4️⃣ **Analytics - Dispatch Attempts**

```bash
curl -X GET http://localhost:3001/api/v1/analytics/dispatch-attempts/test-tenant?limit=10 \
  -H "Authorization: Bearer <JWT_TOKEN>"
```

**Response**:
```json
{
  "total": 78,
  "success": 76,
  "failed": 2,
  "successRate": 97.44,
  "recentAttempts": [
    {
      "id": "dispatch_id",
      "eventId": "evt_123",
      "attempt": 1,
      "status": "success",
      "error": null,
      "createdAt": "2026-02-23T20:30:00Z"
    }
  ]
}
```

### 5️⃣ **Analytics - Performance**

```bash
curl -X GET http://localhost:3001/api/v1/analytics/performance/test-tenant \
  -H "Authorization: Bearer <JWT_TOKEN>"
```

**Response**:
```json
{
  "avgProcessingTimeMs": 45,
  "p50ProcessingTimeMs": 40,
  "p95ProcessingTimeMs": 120,
  "p99ProcessingTimeMs": 250,
  "minProcessingTimeMs": 10,
  "maxProcessingTimeMs": 500,
  "processingTimeDistribution": {
    "0-50ms": 45,
    "50-100ms": 30,
    "100-200ms": 18,
    "200ms+": 5
  }
}
```

## 🔍 Debugging

### Ver logs em tempo real

```bash
# Terminal 1: Iniciar servidor
npm run dev

# Terminal 2: Monitore logs
tail -f ~/.local/share/app/api/logs/*.log
```

### Acessar Prisma Studio

```bash
cd apps/api
npx prisma studio
# Abre em http://localhost:5555
```

### Testar conexão com banco

```bash
node -e "
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
prisma.tenant.findFirst().then(() => {
  console.log('✅ Banco conectado!');
  process.exit(0);
}).catch(e => {
  console.error('❌ Erro:', e.message);
  process.exit(1);
});
"
```

## 🧪 Teste End-to-End Completo

```bash
#!/bin/bash

# 1. Gerar JWT
JWT="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."

# 2. Rastrear click
echo "📍 Rastreando click..."
curl -X POST http://localhost:3001/api/v1/track/click \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $JWT" \
  -d '{
    "fbclid": "test_'$(date +%s)'",
    "fbc": "fb.1.1234567890.0987654321",
    "utm_source": "test"
  }'

echo "\n"

# 3. Simular webhook
echo "🔔 Enviando webhook PerfectPay..."
curl -X POST http://localhost:3001/api/v1/webhooks/perfectpay/test-tenant \
  -H "Content-Type: application/json" \
  -H "x-perfectpay-signature: abc123" \
  -d '{
    "id": "evt_test_'$(date +%s)'",
    "type": "purchase_approved",
    "customer": {
      "email": "test@example.com",
      "first_name": "Test",
      "last_name": "User",
      "phone": "11999999999",
      "date_of_birth": "1990-01-01"
    },
    "purchase": {
      "amount": 99.90,
      "currency": "BRL"
    },
    "fbc": "fb.1.1234567890.0987654321"
  }'

echo "\n"

# 4. Ver match rate
echo "📊 Verificando match rate..."
curl -X GET http://localhost:3001/api/v1/analytics/match-rate/test-tenant \
  -H "Authorization: Bearer $JWT"
```

## 📋 Checklist de Setup

- [ ] Variáveis de ambiente carregadas (`.env.local`)
- [ ] Database PostgreSQL conectado
- [ ] Migrations aplicadas (`npx prisma migrate deploy`)
- [ ] Dados de seed populados (`npx prisma db seed`)
- [ ] JWT_SECRET definida
- [ ] Servidor iniciado (`npm run dev`)
- [ ] Primeiro click rastreado com sucesso
- [ ] Webhook recebido e processado
- [ ] Match rate visível em analytics

## 🆘 Troubleshooting

### "Unauthorized" (401)
```
❌ Problema: JWT Token inválido ou expirado
✅ Solução: Gerar novo JWT com JWT_SECRET correta
```

### "Conversion not found"
```
❌ Problema: WebhookRaw não foi criado
✅ Solução: Garantir que webhook foi recebido antes de chamar match
```

### "Database connection refused"
```
❌ Problema: DATABASE_URL inválida
✅ Solução: Verificar .env.local e conexão com Supabase
```

### "SQS Queue not found"
```
❌ Problema: SQS_QUEUE_URL inválida
✅ Solução: Atualizar variáveis AWS ou desabilitar SQS para dev
```

## 📚 Documentação Completa

- [Migrations Guide](./MIGRATIONS.md)
- [Architecture Overview](./README-architecture.md)
- [Database Schema](./database-schema.md)
