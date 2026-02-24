# ─── Estágio 1: build ─────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Copiar manifests do monorepo
COPY package.json package-lock.json ./
COPY apps/api/package.json ./apps/api/
COPY packages/shared/package.json ./packages/shared/

# Instalar todas as dependências
RUN npm ci

# Copiar código fonte
COPY apps/api/ ./apps/api/
COPY packages/shared/ ./packages/shared/
COPY tsconfig.base.json ./

# Gerar Prisma Client
RUN npm run prisma:generate -w apps/api

# Compilar shared e api
RUN npm run build -w packages/shared
RUN npm run build -w apps/api

# ─── Estágio 2: produção ───────────────────────────────────────────────────────
FROM node:20-alpine AS production

WORKDIR /app

ENV NODE_ENV=production

# Copiar apenas o necessário do estágio de build
COPY --from=builder /app/apps/api/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps/api/prisma ./prisma

# Substituir o symlink do workspace @hub/shared por arquivos compilados reais
RUN rm -rf ./node_modules/@hub/shared && mkdir -p ./node_modules/@hub/shared
COPY --from=builder /app/packages/shared/dist ./node_modules/@hub/shared/dist
COPY --from=builder /app/packages/shared/package.json ./node_modules/@hub/shared/package.json

EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:3001/api/v1/health || exit 1

CMD ["node", "dist/server.js"]
