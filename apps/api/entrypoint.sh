#!/bin/sh
set -e

echo "⏳ Aguardando injeção de secrets (5s)..."
sleep 5

# ─── VALIDAÇÃO 1: DATABASE_URL ───────────────────────────────────────────────
echo "🔍 Validando DATABASE_URL..."
echo "   DATABASE_URL value: [$DATABASE_URL]"
echo "   DATABASE_URL length: ${#DATABASE_URL}"
echo "   All env vars with 'DATABASE': $(env | grep -i database || echo 'NONE')"

if [ -z "$DATABASE_URL" ]; then
  echo "❌ ERRO CRÍTICO: DATABASE_URL não está definida!"
  echo "   Contexto:"
  echo "   - NODE_ENV: $NODE_ENV"
  echo "   - PORT: $PORT"
  echo "   - Variáveis definidas: $(env | wc -l)"
  echo "   - Todas as variáveis:"
  env | sort
  exit 1
fi

if [ "$DATABASE_URL" = " " ] || ! echo "$DATABASE_URL" | grep -q "postgres"; then
  echo "⚠️  AVISO: DATABASE_URL está vazio ou inválido!"
  echo "   Valor: [$DATABASE_URL]"
  exit 1
fi

echo "✅ DATABASE_URL encontrada (length: ${#DATABASE_URL})"

# ─── VALIDAÇÃO 2: Conectividade RDS ─────────────────────────────────────────
echo "🔗 Testando conectividade ao banco de dados..."
if ! npx prisma db execute --stdin < /dev/null 2>/dev/null; then
  echo "⚠️  Aviso: Não conseguiu conectar ao banco via Prisma (pode estar em setup)"
fi

# ─── EXECUÇÃO: Migrations ────────────────────────────────────────────────────
echo "🔄 Executando Prisma migrations..."
echo "   Command: npx prisma migrate deploy"
echo "   Working Directory: /app"
echo "   Prisma Schema: /app/prisma/schema.prisma"

if npx prisma migrate deploy 2>/dev/null; then
  echo "✅ Migrations executadas com sucesso!"
else
  echo "⚠️  AVISO: Migrations falharam ou não foram necessárias (tabelas podem já existir)"
  echo "   Continuando com startup mesmo assim..."
fi

# ─── INICIALIZAÇÃO: Servidor ────────────────────────────────────────────────
echo "✅ Tudo pronto. Iniciando servidor na porta ${PORT:-3001}..."
exec node dist/server.js
