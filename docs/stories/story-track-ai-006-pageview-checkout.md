# Story Track AI 006 – Endpoints de Pageview e Initiate Checkout

## Status: InProgress

## Contexto
Com o endpoint de ingestão de click funcionando (Story 004), o próximo passo é capturar os dois outros eventos principais do funnel: **pageview** (quando usuário chega na landing) e **initiate_checkout** (quando começa o processo de compra). Estes eventos fornecem contexto temporal do user journey e são críticos para matching com conversões posteriores.

## Agentes envolvidos
- `@dev`: implementar 2 endpoints, validação Zod, handlers com Prisma
- `@qa`: validar persistência, cobertura de testes, regressão

## Objetivos
1. `POST /api/v1/track/pageview` com validação Zod
2. `POST /api/v1/track/initiate_checkout` com validação Zod
3. Identificar tenant via header `x-tenant-id`
4. Capturar IP, user agent, timestamp dos headers/payload
5. Persistir eventos em tabela `events` (genérica) ou `pageviews` + `checkouts`
6. Retornar 201 com ID do evento criado

## Tasks
- [x] Criar schemas Zod para `pageviewIngestSchema` e `checkoutIngestSchema` em `@hub/shared`
- [x] Criar `apps/api/src/pageview-handler.ts` com lógica de persistência
- [x] Criar `apps/api/src/checkout-handler.ts` com lógica de persistência
- [x] Registrar rotas `POST /api/v1/track/pageview` e `POST /api/v1/track/initiate_checkout` no server.ts
- [x] Adicionar testes unitários para ambos handlers
- [ ] Build e deploy no ECS

## Critérios de aceite
- [x] `POST /api/v1/track/pageview` com header `x-tenant-id` válido retorna 201 com `{ id }`
- [x] Pageview persiste com tenantId, url, referrer, utm_source, utm_medium, utm_campaign, utm_content, utm_term, ip, userAgent, timestamp
- [x] `POST /api/v1/track/initiate_checkout` retorna 201 com dados do checkout persistidos
- [x] Sem `x-tenant-id`: retorna 400
- [x] Tenant inexistente: retorna 404
- [x] Campos opcionais ausentes: evento criado sem eles (não retorna erro)

## Pontos de atenção
- ⚠️ Timestamps devem ser capturados no servidor (confiável), não do cliente (pode ser falsificado)
- ⚠️ Ambos endpoints seguem o mesmo padrão de tenantId + IP capture que Story 004

## Definição de pronto
- Ambos endpoints respondendo em produção
- Testes passando (lint + typecheck + test)
- Eventos visíveis no Supabase

## File List
- `packages/shared/src/index.ts`
- `apps/api/src/pageview-handler.ts`
- `apps/api/src/pageview-handler.test.ts`
- `apps/api/src/checkout-handler.ts`
- `apps/api/src/checkout-handler.test.ts`
- `apps/api/src/server.ts`
- `docs/stories/story-track-ai-006-pageview-checkout.md`

## Change Log
- Story criada por @sm (River) — 2026-02-21. Bloqueada aguardando deploy de Story 005.
- Story implementada por @dev (Dex) — 2026-02-21. Endpoints `/api/v1/track/pageview` e `/api/v1/track/initiate_checkout` implementados com DI pattern. 24 testes passando (lint OK, typecheck OK). Pronto para validação por @po.
