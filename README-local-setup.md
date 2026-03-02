# Local Development Setup — Hub Server-Side Tracking

Este guia detalha como configurar o ambiente de desenvolvimento local para o Hub Server-Side Tracking.

## Pré-requisitos

- **Node.js** 18+ (verificar com `node --version`)
- **Docker** (para PostgreSQL local)
- **npm** (incluído com Node.js)

## Setup Rápido (Recomendado)

Execute um único comando para configurar tudo:

```bash
bash scripts/setup-local.sh
```

Este script:
1. ✅ Inicia PostgreSQL em container Docker
2. ✅ Aguarda banco estar pronto
3. ✅ Executa todas as 3 migrations Prisma
4. ✅ Gera Prisma Client

## Setup Manual (Passo a Passo)

### 1. Iniciar PostgreSQL

```bash
# Via Docker (recomendado)
docker run -d \
  --name hub-postgres \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_DB=tracking \
  -p 5432:5432 \
  postgres:15-alpine

# Aguardar banco estar pronto
sleep 5
pg_isready -h localhost -p 5432
```

### 2. Definir DATABASE_URL

```bash
export DATABASE_URL="postgresql://postgres:postgres@localhost:5432/tracking?sslmode=disable"
```

### 3. Executar Migrations

```bash
cd apps/api
npx prisma migrate deploy
npx prisma generate
cd ../..
```

## Iniciar Servidores

### Terminal 1: Backend API (porta 3001)

```bash
npm run dev:api
```

Esperado:
```
Server listening on port 3001
Database connected: ✓
```

### Terminal 2: Frontend Web (porta 3000)

```bash
npm run dev:web
```

Esperado:
```
▲ Next.js 16.0.0
- ready started server on 0.0.0.0:3000
```

## Validações

### Health Check API

```bash
curl http://localhost:3001/api/v1/health
```

Resposta esperada:
```json
{
  "status": "ok",
  "db": "connected",
  "timestamp": "2026-03-02T14:00:00Z"
}
```

### Executar Testes

```bash
# Linting + TypeScript
npm run lint
npm run typecheck

# Testes completos
npm run test
```

### End-to-End Test

```bash
node test-flow.js
```

Esperado:
```
✅ Setup session created
✅ Click event ingested
✅ Conversion created
✅ Match detected
✅ All tests passed!
```

## Troubleshooting

### Error: TlsConnectionError

**Problema:** `Error: TLSConnectionError: Connection terminated`

**Solução:** Banco está com SSL ativado. Verificar DATABASE_URL:
```bash
echo $DATABASE_URL
# Deve conter: sslmode=disable
```

Se não tiver, rodar:
```bash
export DATABASE_URL="postgresql://postgres:postgres@localhost:5432/tracking?sslmode=disable"
```

---

### Error: P1010: User was denied access

**Problema:** `P1010: User was denied access (invalid credentials)`

**Solução:** Variável `DATABASE_URL` não está definida ou incorreta:
```bash
# Verificar
echo $DATABASE_URL

# Se vazia, definir:
export DATABASE_URL="postgresql://postgres:postgres@localhost:5432/tracking?sslmode=disable"

# Tentar migration novamente
npx prisma migrate deploy
```

---

### Error: ECONNREFUSED (PostgreSQL não está rodando)

**Problema:** `Error: connect ECONNREFUSED 127.0.0.1:5432`

**Solução:** Iniciar Docker:
```bash
# Verificar se container existe
docker ps -a | grep hub-postgres

# Se existe, iniciar
docker start hub-postgres

# Se não existe, criar novo
docker run -d \
  --name hub-postgres \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_DB=tracking \
  -p 5432:5432 \
  postgres:15-alpine

# Aguardar ficar pronto
sleep 5
pg_isready -h localhost -p 5432
```

---

### Error: migration number already applied

**Problema:** Tentou rodar migration que já foi aplicada

**Solução:** Isso é normal. Migration é idempotente:
```bash
npx prisma migrate deploy --skip-generate
# Se já foi aplicada, apenas pula
```

## Limpeza

Para remover o banco local e começar do zero:

```bash
# Parar e remover container
docker stop hub-postgres
docker rm hub-postgres

# Deletar arquivo de migrations (se existir)
rm -rf apps/api/prisma/migrations/

# Executar setup novamente
bash scripts/setup-local.sh
```

## Documentação Completa

- **API Endpoints:** `docs/README-architecture.md`
- **Schema Database:** `docs/database-schema.md`
- **Educational Guide:** `docs/learning/GUIDE.md`

---

**Última atualização:** 2026-03-02
