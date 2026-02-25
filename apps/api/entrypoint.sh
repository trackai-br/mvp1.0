#!/bin/sh
set -e

echo "⏳ Aguardando injeção de secrets (5s)..."
sleep 5

# ─── VALIDAÇÃO 1: DATABASE_URL ───────────────────────────────────────────────
echo "🔍 Validando DATABASE_URL..."
if [ -z "$DATABASE_URL" ]; then
  echo "❌ ERRO CRÍTICO: DATABASE_URL não está definida!"
  echo "   Contexto:"
  echo "   - NODE_ENV: $NODE_ENV"
  echo "   - PORT: $PORT"
  echo "   - Variáveis definidas: $(env | wc -l)"
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
if npx prisma migrate deploy; then
  echo "✅ Migrations executadas com sucesso"
else
  echo "❌ ERRO: Prisma migrations falharam"
  exit 1
fi

# ─── INICIALIZAÇÃO: Servidor ────────────────────────────────────────────────
echo "✅ Tudo pronto. Iniciando servidor na porta ${PORT:-3001}..."
exec node dist/server.js
