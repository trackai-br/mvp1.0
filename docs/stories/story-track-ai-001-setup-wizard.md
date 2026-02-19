# Story Track AI 001 - Setup Wizard + Setup Session API

## Contexto
Implementar a primeira fatia funcional do Track AI para teste local:
- Frontend com wizard em 3 passos
- Backend para criar sessao, validar e consultar status

## Agentes AIOS aplicados (funcao por etapa)
- `@architect`: desenho do fluxo frontend -> API -> status
- `@dev`: implementacao de frontend/backend/shared schemas
- `@qa`: testes unitarios e quality gates
- `@pm`: sequenciamento de entrega MVP (fatia vertical)

## Escopo
1. Wizard frontend (ambiente, Meta, gateway)
2. API setup sessions (`create`, `validate`, `status`)
3. Validacao automatica mockada para enable visual testing

## Acceptance Criteria
- [x] Usuario consegue preencher os 3 passos no frontend
- [x] Frontend cria sessao e executa validacao
- [x] Tela mostra status final e checks
- [x] API responde em `/api/v1/setup/sessions`
- [x] API responde em `/api/v1/setup/sessions/:id/validate`
- [x] API responde em `/api/v1/setup/sessions/:id/status`

## Checklist de Qualidade
- [x] `npm run lint`
- [x] `npm run typecheck`
- [x] `npm test`

## File List
- `packages/shared/src/index.ts`
- `apps/api/src/setup-store.ts`
- `apps/api/src/validation.ts`
- `apps/api/src/validation.test.ts`
- `apps/api/src/server.ts`
- `apps/web/src/components/providers.tsx`
- `apps/web/src/app/layout.tsx`
- `apps/web/src/app/page.tsx`
- `apps/web/next.config.mjs`
- `apps/web/package.json`
- `apps/api/package.json`
- `docs/stories/story-track-ai-001-setup-wizard.md`
