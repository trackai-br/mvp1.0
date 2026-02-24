# Hub Server-Side Tracking — Context Guide

## 📋 Visão Geral

Este documento serve como guia de uso para o arquivo `PROJECT_IMPLEMENTATION_CONTEXT.json`, que contém a documentação completa do que foi implementado no projeto Hub Server-Side Tracking.

## 🎯 Para Quem é Este Arquivo?

Este JSON foi criado especificamente para **passar todo o contexto do projeto para outra IA** que precisará continuar desenvolvendo e mantendo o sistema.

## 📁 Estrutura do JSON

### 1. **Backend** (`backend` object)
Documenta toda a API Fastify:
- **Endpoints de Tracking**: `/api/v1/track/*` (click, pageview, checkout)
- **Endpoints de Webhooks**: `/api/v1/webhooks/{gateway}` (hotmart, kiwify, stripe, pagseguro, perfectpay)
- **Endpoints de Setup**: `/api/v1/setup/sessions/*` (wizard de onboarding)
- **Endpoints de Analytics**: `/api/v1/analytics/*` (match stats, dispatch failures)

### 2. **Frontend** (`frontend` object)
Documenta a aplicação Next.js:
- **Páginas**: Home (wizard), Dashboard
- **Componentes**: KPI cards, charts, tables, export panel
- **State Management**: TanStack Query
- **Validação**: React Hook Form + Zod

### 3. **Database** (`database` object)
Documenta o schema PostgreSQL completo:
- **10 Modelos Principais**: Tenant, Click, Pageview, Checkout, Identity, WebhookRaw, Conversion, MatchLog, DispatchAttempt, SetupSession
- **Índices Críticos**: Para performance em queries de matching
- **Constraints**: UNIQUE para deduplicação

### 4. **External Integrations** (`external_integrations` object)
Documenta todas as integrações externas:
- **Payment Gateways**: Hotmart, Kiwify, Stripe, PagSeguro, PerfectPay
- **Advertising Platforms**: Meta Conversions API v21
- **Infrastructure**: AWS (API Gateway, WAF, ECS, RDS, SQS, CloudWatch, Secrets Manager)

### 5. **Stories** (`implemented_stories` + `backlog` objects)
Histórico e roadmap:
- 10 stories implementadas
- Status de cada uma
- Backlog com próximas features

## 🔍 Como Usar Este Arquivo

### Cenário 1: Entender o Fluxo Completo
```
1. Leia "project" → visão geral do stack
2. Leia "backend.endpoints.tracking" → como recebemos dados
3. Leia "backend.endpoints.webhooks" → como recebemos conversões
4. Leia "database.models.Click" + "Conversion" → como armazenamos
5. Leia "backend.core_services.match_engine" → como fazemos matching
6. Leia "external_integrations.advertising_platforms.Meta Conversions API" → como enviamos ao Meta
```

### Cenário 2: Implementar Nova Feature
```
1. Verifique "implemented_stories" → qual foi implementado antes?
2. Leia o "gateway_adapter" correspondente em "backend.core_services.webhook_router"
3. Localize "handlers" em "backend.endpoints"
4. Entenda o fluxo de validação: "backend.validation"
5. Verifique indexes necessários em "database.models"
```

### Cenário 3: Debugar Problema de Matching
```
1. Entenda o pipeline: "backend.core_services.match_engine"
2. Verifique tabelas: "database.models.Click", "Conversion", "MatchLog"
3. Valide indexes estão em uso
4. Veja "backend.core_services.match_engine.matching_order" (FBC → FBP → email)
```

### Cenário 4: Adicionar Novo Gateway
```
1. Leia "external_integrations.payment_gateways" → qual padrão usar?
2. Veja exemplos em "backend.core_services.webhook_router.gateway_adapters"
3. Implemente adapter com "WebhookAdapter" interface
4. Registre em "getWebhookAdapter()" factory
5. Adicione route em "backend.endpoints.webhooks"
6. Atualize "NormalizedWebhookEvent" schema
7. Adicione testes
```

## 🔐 Segurança & Compliance

### LGPD/GDPR
- ✅ Hashing SHA-256 de PII antes de persistir
- ✅ Não armazenar dados em claro
- ✅ Retenção: 90 dias (padrão)
- Veja: `database.models.Conversion.fields.meta_capi_parameters`

### Webhooks
- ✅ HMAC-SHA256 validation para todos os gateways
- ✅ Timing-safe comparison (timing attack safe)
- Veja: `external_integrations.payment_gateways[].signature_validation`

### Autenticação
- ✅ JWT para analytics routes
- ✅ Multi-tenant isolamento via tenantId
- Veja: `backend.authentication`

## 📊 Key Metrics & SLOs

| Métrica | Target |
|---------|--------|
| Throughput | 10.000 eventos/min |
| Latência (p95) | < 60s end-to-end |
| Match Rate | > 80% |
| Uptime | 99.9% |
| Tempo integração nova gateway | < 2 dias |

Veja: `architecture_slos`

## 🗂️ Organização de Pastas

```
apps/api/src/
├── click-handler.ts                  # POST /api/v1/track/click
├── pageview-handler.ts               # POST /api/v1/track/pageview
├── checkout-handler.ts               # POST /api/v1/track/initiate_checkout
├── match-engine.ts                   # Story 008: Matching logic
├── meta-client.ts                    # (deprecated, veja services/meta-capi-client)
├── services/
│   └── meta-capi-client.ts          # Story 009: Meta CAPI v21 client
├── webhooks/
│   ├── webhook-router.ts            # Factory + NormalizedWebhookEvent
│   ├── hotmart-adapter.ts           # Hotmart webhook parsing
│   ├── kiwify-adapter.ts            # Kiwify webhook parsing
│   ├── stripe-adapter.ts            # Stripe webhook parsing
│   ├── pagseguro-adapter.ts         # PagSeguro webhook parsing
│   └── perfectpay-adapter.ts        # PerfectPay webhook parsing
├── routes/
│   └── analytics.ts                 # GET /api/v1/analytics/*
├── lib/
│   └── circuit-breaker.ts           # Proteção contra cascata de falhas
└── setup-store.ts                   # Setup sessions (in-memory ou DB)

apps/web/src/
├── app/
│   ├── page.tsx                     # Home: Setup wizard
│   ├── dashboard/
│   │   └── page.tsx                 # Dashboard: Analytics
│   └── api/v1/                      # Next.js API routes
├── components/
│   └── dashboard/
│       ├── kpi-cards.tsx            # KPI cards
│       ├── match-rate-chart.tsx     # Match rate over time
│       ├── performance-chart.tsx    # Latency chart
│       ├── events-table.tsx         # Event log
│       ├── failures-monitor.tsx     # Failed dispatches
│       └── export-panel.tsx         # CSV/JSON export
└── lib/
    ├── contracts.ts                 # Types & validation
    └── server/                      # Server-side utilities
```

## 🚀 Como Continuar o Desenvolvimento

### Próximas Steps (Backlog)

1. **Story 011: Replay Engine** — Reprocessar conversões falhadas
   - Depende de: Story 009 (SQS dispatch)

2. **Story 008b: Email Matching** — Terceira estratégia de matching
   - Depende de: Story 008 (Match engine)

3. **Story 012: Advanced Scoring** — ML-based atribution
   - Depende de: Story 008b

4. **S3 Integration** — Audit trail de webhooks em S3
   - Depende de: None (pode ser paralelo)

## 📝 Padrões de Código Reconhecidos

### 1. **Validação com Zod**
Todas as requisições são validadas via schemas em `packages/shared`:
```typescript
const parsed = clickIngestSchema.safeParse(request.body);
if (!parsed.success) return reply.code(400).send(parsed.error.flatten());
```

### 2. **Webhook Adapters (Factory Pattern)**
Cada gateway tem um adapter com interface padrão:
```typescript
interface WebhookAdapter {
  validateSignature(rawBody, signature, secret): void;
  parseEvent(body): NormalizedWebhookEvent;
}
```

### 3. **Prisma Transactions**
Operações críticas (matching + dispatch) usam transações:
```typescript
await prisma.$transaction([
  prisma.conversion.create(...),
  prisma.matchLog.create(...),
  // Enqueue to SQS...
]);
```

### 4. **Error Handling Estruturado**
Respostas padronizadas com HTTP status correto:
```typescript
if ('error' in result && result.error === 'tenant_not_found') {
  return reply.code(404).send({ message: 'Tenant nao encontrado.' });
}
```

## 🔗 Relação Entre Componentes

```
Cliente (browser/script)
    ↓
POST /api/v1/track/click
    ↓
click-handler.ts → Save Click
    ↓
POST /api/v1/webhooks/{gateway}
    ↓
webhook-router.ts (factory) → {gateway}-adapter.ts (parse)
    ↓
NormalizedWebhookEvent
    ↓
match-engine.ts (FBC → FBP → email)
    ↓
Conversion + MatchLog
    ↓
SQS queue (capi-dispatch)
    ↓
meta-capi-client.ts
    ↓
Meta CAPI v21
    ↓
DispatchAttempt log
    ↓
Frontend dashboard
    ↓
GET /api/v1/analytics/*
```

## 💾 Banco de Dados: Fluxo de Dados

```
Click Table
(fbclid, fbc, fbp, IP, userAgent)
        ↓
        ├─ Match against Conversion (72h window)
        │
Conversion Table
(webhookRawId, gateway, amount, customerEmail, ...)
        ↓
        ├─ All 15 Meta CAPI parameters (hashed PII)
        │
MatchLog Table
(fbcAttempted, fbpAttempted, finalStrategy, finalClickId)
        ↓
DispatchAttempt Table
(eventId, attempt, status, error)
        ↓
Meta CAPI API
```

## 📞 Próximas Integrações (Pipeline)

### Curto Prazo (< 2 semanas)
- [ ] Replay engine (Story 011)
- [ ] Email matching (Story 008b)
- [ ] S3 audit logging

### Médio Prazo (1-2 meses)
- [ ] Advanced scoring algorithm
- [ ] Multi-attribute matching
- [ ] Custom funnel builder (next.js route)

### Longo Prazo (> 2 meses)
- [ ] ML-based attribution
- [ ] Real-time dashboards via WebSocket
- [ ] Webhook replay UI

## ✅ Checklist para Novos Developers

- [ ] Leia este arquivo completamente
- [ ] Leia `PROJECT_IMPLEMENTATION_CONTEXT.json` com atenção
- [ ] Clone e rode o projeto localmente
- [ ] Rode testes: `npm run test`
- [ ] Entenda o schema Prisma
- [ ] Trace um evento completo (click → conversion → CAPI)
- [ ] Implemente uma pequena feature (ex.: novo campo em tracking)
- [ ] Abra PR com testes inclusos

## 🤔 Perguntas Frequentes

**P: Como adicionar novo campo em tracking?**
R: 1) Adicione em `clickIngestSchema` (packages/shared), 2) Adicione em Click model (schema.prisma), 3) Rodar `npx prisma migrate dev`, 4) Atualize click-handler.ts

**P: Como debugar matching?**
R: 1) Verifique MatchLog table, 2) Valide que Click existe com FBC/FBP, 3) Verifique janela de 72h, 4) Cheque indexes

**P: Como reprocessar conversão falhada?**
R: 1) Use Conversion.id como base, 2) Coloque na fila SQS novamente, 3) Ou implemente Story 011 (Replay engine)

**P: Como adicionar novo gateway?**
R: Veja "Cenário 4: Adicionar Novo Gateway" acima

---

**Criado:** 2026-02-23
**Última Atualização:** 2026-02-23
**Status:** Ready for handoff
