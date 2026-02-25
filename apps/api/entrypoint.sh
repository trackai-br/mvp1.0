#!/bin/sh
set -e

echo "🔄 Executando Prisma migrations..."
npx prisma migrate deploy

echo "✅ Migrations completas. Iniciando servidor..."
exec node dist/server.js
