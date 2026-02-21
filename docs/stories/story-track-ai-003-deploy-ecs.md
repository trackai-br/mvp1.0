# Story Track AI 003 – Deploy da API no ECS + Prisma conectado ao Supabase

## Status: Done

## Contexto
O servidor Fastify existe e roda localmente, o schema do banco está definido no Prisma, e a infraestrutura de segurança (WAF, Secrets Manager) já está provisionada. O próximo passo é fazer a API rodar de verdade na nuvem AWS e conectar ao banco Supabase via Prisma — substituindo o armazenamento em memória atual por persistência real.

## Agentes envolvidos
- `@devops`: Dockerfile, ECR, ECS Fargate, ALB, variáveis de ambiente via Secrets Manager.
- `@dev`: integrar Prisma no server.ts, melhorar /health com check de banco, ajustar setup-store para persistência real.
- `@qa`: validar que o /health retorna 200 com db conectado, e que sessões persistem no Supabase.

## Objetivos
1. Containerizar a API com Dockerfile otimizado para produção.
2. Criar repositório ECR, construir e fazer push da imagem.
3. Provisionar ECS Fargate cluster + task definition + service com as variáveis do Secrets Manager.
4. Criar ALB e associar o WAF `hub-tracking-waf` provisionado na Story 002.
5. Conectar Prisma ao Supabase e melhorar o `/health` para verificar conectividade real com o banco.

## Tasks
- [x] Criar `apps/api/Dockerfile` otimizado (multi-stage build)
- [x] Criar repositório ECR `hub-tracking-api`
- [x] Build e push da imagem Docker para o ECR
- [x] Criar cluster ECS `hub-tracking`
- [x] Criar task definition com variáveis do Secrets Manager
- [x] Criar service ECS com ALB
- [x] Associar WAF ao ALB
- [x] Integrar Prisma Client no server.ts (substituir setup-store em memória)
- [x] Melhorar `/health` para verificar conexão com banco

## Critérios de aceite
- [x] `GET /health` retorna `{ status: "ok", db: "connected" }` a partir do domínio público
- [x] Sessões de setup persistem no Supabase (não em memória)
- [x] WAF ativo protegendo o ALB
- [x] Logs visíveis no CloudWatch

## Definição de pronto
- API acessível via URL pública (ALB DNS ou domínio configurado)
- Banco conectado e migração aplicada
- WAF associado ao ALB

## File List
- `apps/api/Dockerfile`
- `apps/api/prisma/schema.prisma`
- `apps/api/prisma.config.ts`
- `apps/api/vitest.config.ts`
- `apps/api/src/server.ts`
- `apps/api/src/db.ts`
- `apps/api/src/setup-store.ts`
- `apps/api/prisma/migrations/20260221145234_add_checks_to_setup_session/`
- `docs/stories/story-track-ai-003-deploy-ecs.md`

## Notas técnicas
- Prisma 7.4.1 requer `@prisma/adapter-pg` (driver adapter) — `engineType = "library"` foi removido
- `prisma.config.ts` com `datasource.url` necessário para `prisma migrate` (url não aceita mais no schema.prisma)
- SSL Supabase: `ssl: { rejectUnauthorized: false }` no Pool + `NODE_TLS_REJECT_UNAUTHORIZED=0` no ECS
- Dockerfile: `.prisma` deve ser copiado APÓS `node_modules` raiz para não ser sobrescrito
- Health check retorna HTTP 200 mesmo em modo degraded para não derrubar o serviço

## Change Log
- Story criada por @sm — River.
- Story concluída por @devops (Gage) + @dev — 2026-02-21. API deployada, banco conectado, setup-store migrado de memória para Supabase.
