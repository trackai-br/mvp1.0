# Story Track AI 002 – Secrets e API Gateway

## Contexto
Garantir que o backend de Track AI rode com todos os segredos corretos, que o banco esteja acessível e que o API Gateway + WAF proteja as rotas críticas com rate limiting por `tenant_id`. Esse story complementa a fundação do story 001, preparando o ambiente para provisionar e disparar o motor de tracking.

## Agentes envolvidos
- `@devops`: configurar secrets, gateways, monitoramento e documentar o fluxo (conexão, migração).
- `@dev`: validar que as variáveis estão sincronizadas em `.env`/`.env.local`.
- `@qa`: confirmar que os testes e migrações rodaram após o ajuste no banco.

## Objetivos
1. Sincronizar `.env` e `.env.local` com a URL definitiva `postgresql://postgres:ojXw8CODkn1fu5mm@db.lvphewjjvsrhqihdaikd.supabase.co:5432/postgres?sslmode=require` e as demais chaves necessárias (Supabase, Cloudflare, GTM, Stape).  
2. Validar o acesso ao banco via MCP e aplicar a primeira migração com host direto (não pooler).  
3. Planejar e documentar como o API Gateway + WAF deve ser configurado (limite por `tenant_id`, health checks, perfis de rate limit) e quais secrets devem ser replicados no Secrets Manager antes do deploy.

## Tasks
- [x] Atualizar `infra/secrets/.env.local` com a URL definitiva do Supabase, GTM, Cloudflare, Perfect Pay e STAPE.  
- [x] Sincronizar `DB_URL` e as variáveis críticas em `.env`.  
- [x] Validar acesso `SELECT 1` via `npx prisma db execute` e aplicar migração `migrate dev --name init` no host direto acessado pelo MCP.  
- [x] Replicar variáveis no AWS Secrets Manager (`hub-tracking/production`) via IAM user `hub-tracking-deploy`.
- [x] Registrar nos docs o fluxo de atualização de secrets para produção e CI (incluindo `infra/secrets/.env.local` e `infra/secrets/.env.local.example`).
- [x] Documentar e provisionar WAF WebACL (`hub-tracking-waf`) com rate limiting por tenant_id e regras gerenciadas AWS. Documentação publicada em `docs/track-ai-architecture.md`.

## Critérios de aceite
- [x] Todos os secrets necessários estão listados e sincronizados nos arquivos locais ignorados (`infra/secrets`).  
- [x] `npx prisma db execute` e `npx prisma migrate dev --name init` foram executados com sucesso dentro do MCP usando o `DB_URL` definitivo.  
- [x] Secrets replicados no AWS Secrets Manager com ARN `arn:aws:secretsmanager:us-east-1:571944667101:secret:hub-tracking/production-p5mOB9`.
- [x] Guia de configuração do API Gateway + WAF publicado em `docs/track-ai-architecture.md` com regras, limites, rotas protegidas e health check.

## Definição de pronto
- Código revisado e rodado dentro do shell do MCP (`npx prisma migrate dev`).  
- QA validou migração e registrou sucesso.  
- Story registrado no backlog e pronto para revisão quando a documentação final do gateway estiver completa.

## File List
- `infra/secrets/.env.local`
- `.env`
- `docs/stories/story-track-ai-002-secrets-gateway.md`
- `docs/track-ai-architecture.md`

## Change Log
- Sincronizei os segredos e obtive migração no Supabase `db.lvphewjjvsrhqihdaikd`.
- Documentei a estratégia para o Gateway/WAF como parte do plano do story.
- Criado usuário IAM `hub-tracking-deploy` com permissões mínimas (APIGateway, WAF, SecretsManager).
- Secrets replicados no AWS Secrets Manager: `hub-tracking/production` (ARN: `arn:aws:secretsmanager:us-east-1:571944667101:secret:hub-tracking/production-p5mOB9`).
- `.env.local` atualizado com `AWS_ACCOUNT_ID` e `AWS_SECRET_NAME_FOR_DB`.
- `.env.local.example` atualizado com comentários explicativos.
- Guia de aprendizado criado em `docs/learning/GUIDE.md`.
- WAF WebACL `hub-tracking-waf` criado na AWS (ARN: `arn:aws:wafv2:us-east-1:571944667101:regional/webacl/hub-tracking-waf/d77011e7-2880-4385-ae04-fd17e3d304ec`).
- Documentação completa de API Gateway + WAF publicada em `docs/track-ai-architecture.md`.
- Story 002 concluída.
