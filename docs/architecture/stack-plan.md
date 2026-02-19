# Stack Plan - Execucao Local (MVP)

## Objetivo
Subir front e backend em localhost para validar o fluxo:
1. Selecionar ambiente de tracking (LP, WhatsApp, Telegram)
2. Conectar Meta (Pixel + token)
3. Selecionar gateway (Hotmart, Kiwify, Stripe)
4. Rodar validacoes e visualizar status do setup

## Estrutura
- `apps/web`: Frontend (Next.js)
- `apps/api`: Backend (Fastify)
- `packages/shared`: Schemas compartilhados (Zod)

## Frontend
- Runtime: `next`, `react`, `react-dom`
- Estado e dados: `@tanstack/react-query`, `axios`
- Formulario e validacao: `react-hook-form`, `@hookform/resolvers`, `zod`
- Utilitarios UI: `clsx`, `tailwind-merge`
- Qualidade: `typescript`, `eslint`, `vitest`

## Backend
- API: `fastify`, `@fastify/cors`, `@fastify/sensible`, `@fastify/env`
- Validacao: `zod`, `fastify-type-provider-zod`
- Dados e fila: `@prisma/client`, `prisma`, `ioredis`, `bullmq`
- HTTP externas: `undici`
- Logs: `pino`, `pino-pretty`
- Qualidade: `typescript`, `tsx`, `eslint`, `vitest`, `supertest`

## Shared
- Contratos de request/response com `zod`

## Comandos
- `npm run dev:web`
- `npm run dev:api`
- `npm run lint`
- `npm run typecheck`
- `npm test`

## Proxima etapa (mao na massa)
1. Implementar wizard frontend (3 passos)
2. Implementar endpoints de setup session no backend
3. Conectar frontend -> backend
4. Simular validacoes Meta/Gateway com respostas mockadas
