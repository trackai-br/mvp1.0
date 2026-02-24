# Database Migrations Guide

## 📋 Status das Migrations

- **Migration**: `1_init` — Todas as tabelas do schema (Tenant, Click, Identity, Conversion, MatchLog, etc.)
- **Status**: ✅ Criada e pronta para aplicar
- **Local**: `apps/api/prisma/migrations/1_init/migration.sql`

## 🚀 Como Aplicar as Migrations

### 1️⃣ **Setup Inicial**

```bash
# Instalar dependências
npm install

# Carregar variáveis de ambiente (IMPORTANTE)
export $(cat infra/secrets/.env.local | xargs)

# Navegar até o apps/api
cd apps/api
```

### 2️⃣ **Aplicar Migrations**

```bash
# Opção A: Com Prisma (recomendado)
npx prisma migrate deploy

# Opção B: Aplicar diretamente no PostgreSQL
psql $DATABASE_URL < prisma/migrations/1_init/migration.sql
```

### 3️⃣ **Popular com Dados de Teste (Seed)**

```bash
npx prisma db seed
```

Este comando:
- Cria 1 tenant de teste (`test-tenant`)
- Adiciona 2 clicks de exemplo
- Cria 1 webhook raw (PerfectPay)
- Cria 1 conversion com matching
- Cria 1 match log
- Cria 1 setup session

## 📊 Tabelas Criadas

| Tabela | Descrição | Índices |
|--------|-----------|---------|
| **Tenant** | Unidades multi-tenant | `slug` (único) |
| **Click** | Cliques de ads | `(tenantId, fbc)`, `(tenantId, fbclid)` |
| **Identity** | Hashes de email/phone | `(tenantId, emailHash)`, `(tenantId, phoneHash)` |
| **DedupeRegistry** | Deduplicação de eventos | `(tenantId, eventId)` (único) |
| **DispatchAttempt** | Log de tentativas CAPI | `tenantId`, `(tenantId, eventId)` |
| **SetupSession** | Sessões de setup | `tenantId` |
| **Pageview** | Pageviews rastreados | `tenantId` |
| **Checkout** | Checkouts rastreados | `tenantId` |
| **WebhookRaw** | Webhooks brutos (audit) | `(tenantId, gateway, gatewayEventId)` (único), `(tenantId, gateway, createdAt DESC)`, `(tenantId, eventType)` |
| **Conversion** | Conversões normalizadas + hashed | `(tenantId, gateway, gatewayEventId)` (único), `(tenantId, fbc, createdAt DESC)`, `(tenantId, sentToCAPI, createdAt)`, etc |
| **MatchLog** | Detalhes de matching FBC/FBP | `conversionId`, `createdAt DESC`, `(finalStrategy, createdAt)` |
| **Funnel** | Funis de vendas | `tenantId` |

## 🔗 Relacionamentos (Foreign Keys)

```
Tenant
  ├─ Funnel (1:N)
  ├─ Click (1:N)
  ├─ Identity (1:N)
  ├─ DedupeRegistry (1:N)
  ├─ DispatchAttempt (1:N)
  ├─ SetupSession (1:N)
  ├─ Pageview (1:N)
  ├─ Checkout (1:N)
  ├─ WebhookRaw (1:N)
  └─ Conversion (1:N, CASCADE)

WebhookRaw
  └─ Conversion (1:N, CASCADE)

Click
  └─ Conversion.matchedClick (1:N, SET NULL)
```

## 🧪 Verificar Status das Migrations

```bash
# Ver migrations aplicadas
cd apps/api
npx prisma migrate status

# Ver schema atual
npx prisma db execute --stdin < schema.prisma

# Acessar DB via Prisma Studio (GUI)
npx prisma studio
```

## ⚙️ Variáveis de Ambiente Necessárias

Certifique-se de que `.env.local` (ou `.env`) contém:

```env
# Obrigatório
DATABASE_URL=postgresql://user:password@host:port/database

# Opcional (para seed)
PRISMA_DATABASE_URL=$DATABASE_URL  # Se diferente do acima
```

## 🔄 Resetar Database (Desenvolvimento)

⚠️ **CUIDADO**: Isso deleta TUDO. Use apenas em desenvolvimento.

```bash
cd apps/api

# Reset completo
npx prisma migrate reset

# Confirmação necessária (escolher "y")
```

Isso:
1. Deleta todas as tabelas
2. Reaplicar todas as migrations
3. Roda seed.ts automaticamente

## 📝 Criar Nova Migration

Se modificar `schema.prisma`:

```bash
cd apps/api

# Criar migration (escolher nome)
npx prisma migrate dev --name nome_da_migration

# Exemplo:
npx prisma migrate dev --name add_email_field_to_conversion
```

Prisma vai:
1. Detectar mudanças no schema
2. Gerar SQL automático
3. Aplicar no banco
4. Regenerar Prisma Client

## 🐛 Troubleshooting

### "Error: The datasource.url property is required"
```bash
# Garantir que DATABASE_URL está definida
export DATABASE_URL="postgresql://..."
```

### "Error: SSL connection required"
```bash
# Remover ?sslmode=require da DATABASE_URL
# Ou adicionar ?sslmode=disable se banco não usar SSL
```

### "Error: Database already exists"
```bash
# Se migration falhar no meio:
npx prisma migrate resolve --rolled-back 1_init
npx prisma migrate deploy
```

### "Error: relation does not exist"
```bash
# Regenerar Prisma Client
npx prisma generate
```

## 📈 Performance das Índices

Todos os índices foram otimizados para queries de:
- ✅ Click matching by FBC: `index(tenantId, fbc, createdAt DESC)`
- ✅ Click matching by FBCLID: `index(tenantId, fbclid)`
- ✅ Conversion lookup by status: `index(tenantId, sentToCAPI, createdAt)`
- ✅ Match rate analytics: `index(finalStrategy, createdAt DESC)`
- ✅ Webhook deduplication: `unique(tenantId, gateway, gatewayEventId)`

## 🚨 Backup Recomendado

Antes de rodar migrations em produção:

```bash
# Fazer backup do banco
pg_dump $DATABASE_URL > backup_$(date +%Y%m%d_%H%M%S).sql

# Verificar size
ls -lh backup_*.sql
```

## 📚 Documentação Relacionada

- [Schema Prisma](../apps/api/prisma/schema.prisma)
- [Webhook Normalization](./README-architecture.md#webhook-normalization)
- [Match Engine](./README-architecture.md#match-engine)
- [API Endpoints](./README-architecture.md#api-endpoints)
