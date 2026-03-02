#!/bin/bash
# Hub Server-Side Tracking — Setup Local Development Environment
# Script para configurar banco de dados, migrations e seed data
# Uso: bash scripts/setup-local.sh

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🚀 Hub Server-Side Tracking — Local Setup${NC}"
echo "=================================================="

# Step 1: Start PostgreSQL Docker container
echo -e "\n${YELLOW}[1/5] Starting PostgreSQL (Docker)...${NC}"
CONTAINER_NAME="hub-postgres"
CONTAINER_PORT="5432"

# Check if container already exists
if docker ps -a --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
  if docker ps --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
    echo -e "${GREEN}✓ PostgreSQL container already running${NC}"
  else
    echo -e "${YELLOW}Starting stopped container...${NC}"
    docker start "$CONTAINER_NAME" 2>/dev/null || true
  fi
else
  echo "Starting new PostgreSQL container..."
  docker run -d \
    --name "$CONTAINER_NAME" \
    -e POSTGRES_PASSWORD=postgres \
    -e POSTGRES_USER=postgres \
    -e POSTGRES_DB=tracking \
    -p "${CONTAINER_PORT}:5432" \
    postgres:15-alpine 2>/dev/null || true
  echo -e "${GREEN}✓ PostgreSQL container started${NC}"
fi

# Step 2: Wait for PostgreSQL to be ready
echo -e "\n${YELLOW}[2/5] Waiting for PostgreSQL to be ready...${NC}"
for i in {1..30}; do
  if pg_isready -h localhost -p "$CONTAINER_PORT" -U postgres >/dev/null 2>&1; then
    echo -e "${GREEN}✓ PostgreSQL is ready${NC}"
    break
  fi
  if [ $i -eq 30 ]; then
    echo -e "${RED}✗ PostgreSQL failed to start${NC}"
    exit 1
  fi
  echo "Waiting... ($i/30)"
  sleep 1
done

# Step 3: Set DATABASE_URL environment variable
echo -e "\n${YELLOW}[3/5] Setting DATABASE_URL...${NC}"
export DATABASE_URL="postgresql://postgres:postgres@localhost:${CONTAINER_PORT}/tracking?sslmode=disable"
echo -e "${GREEN}✓ DATABASE_URL=${DATABASE_URL}${NC}"

# Step 4: Run Prisma migrations
echo -e "\n${YELLOW}[4/5] Running Prisma migrations...${NC}"
cd "$(dirname "$0")/../apps/api" || exit 1

# Load .env.local if it exists (prisma.config.ts will also load it)
if [ -f "../../infra/secrets/.env.local" ]; then
  export $(cat ../../infra/secrets/.env.local | grep -v '^#' | xargs)
fi

# Run migrations
if npx prisma migrate deploy --skip-generate 2>&1 | tee migration-output.log; then
  echo -e "${GREEN}✓ Migrations completed successfully${NC}"
else
  echo -e "${RED}✗ Migration failed${NC}"
  cat migration-output.log
  exit 1
fi

# Step 5: Generate Prisma Client
echo -e "\n${YELLOW}[5/5] Generating Prisma Client...${NC}"
if npx prisma generate; then
  echo -e "${GREEN}✓ Prisma Client generated${NC}"
else
  echo -e "${RED}✗ Prisma Client generation failed${NC}"
  exit 1
fi

# Return to root directory
cd - > /dev/null

# Summary
echo -e "\n${BLUE}=================================================="
echo -e "✅ Setup complete!${NC}"
echo ""
echo -e "${YELLOW}Next steps:${NC}"
echo "1. Start API server:"
echo "   npm run dev:api"
echo ""
echo "2. In another terminal, start web app:"
echo "   npm run dev:web"
echo ""
echo "3. Test with:"
echo "   curl http://localhost:3001/api/v1/health"
echo ""
echo -e "${YELLOW}Full end-to-end test:${NC}"
echo "   node test-flow.js"
echo ""
echo -e "${YELLOW}Database URL (for reference):${NC}"
echo "   $DATABASE_URL"
echo ""
