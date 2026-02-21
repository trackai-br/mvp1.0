# Story Track AI 004 – Endpoint de Ingestão de Click

## Status: Done

## Contexto
Com a infraestrutura deployada e banco conectado (Story 003), o próximo passo é implementar o primeiro endpoint de tracking real: `POST /api/v1/track/click`. Ele recebe dados de clique do script de rastreamento instalado na landing page do lead, persiste no Supabase e retorna confirmação.

## Agentes envolvidos
- `@dev`: implementar endpoint, schema Zod, handler com Prisma
- `@qa`: validar persistência, validação de campos e rate limiting

## Objetivos
1. Implementar `POST /api/v1/track/click` com validação Zod
2. Identificar o tenant via header `x-tenant-id`
3. Capturar IP e user agent dos headers da requisição
4. Persistir click no Supabase (tabela `clicks`)
5. Retornar 201 com o ID do click criado

## Tasks
- [x] Criar `clickIngestSchema` em `@hub/shared`
- [x] Criar `apps/api/src/click-handler.ts` com lógica de persistência
- [x] Registrar rota `POST /api/v1/track/click` no server.ts
- [x] Adicionar testes unitários para o handler
- [x] Build e deploy no ECS

## Critérios de aceite
- [x] `POST /api/v1/track/click` com header `x-tenant-id` válido retorna 201 com `{ id }`
- [x] Click persiste no Supabase com tenantId, fbclid, fbc, fbp, utms, ip, userAgent
- [x] Sem `x-tenant-id`: retorna 400
- [x] Tenant inexistente: retorna 404
- [x] Campos opcionais ausentes: click criado sem eles (não retorna erro)

## Definição de pronto
- Endpoint respondendo em produção
- Testes passando
- Click visível no Supabase

## File List
- `packages/shared/src/index.ts`
- `apps/api/src/click-handler.ts`
- `apps/api/src/server.ts`
- `apps/api/src/click-handler.test.ts`
- `docs/stories/story-track-ai-004-click-ingestion.md`

## Change Log
- Story criada por @sm — River, 2026-02-21.
- Story implementada por @dev (Dex), 2026-02-21. 4/4 testes passando.
- QA gate por @qa (Quinn), 2026-02-21. Verdict: PASS. 7/7 checks OK. Status: InProgress → Done. Pronta para produção.
