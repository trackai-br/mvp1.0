## EPIC · Track AI Backend Tracking Core

**Context de negócio**
- Campanhas sofrem perda de performance porque os dados de conversão não chegam ao Meta via CAPI, gerando gaps diretos em otimização e custo por aquisição.
- O produto será 100% no-code: o lead preenche um formulário leve, cola um snippet e recebe um webhook — todo o provisionamento ocorre por agentes controlados internamente (DNS, sGTM, GTM Web, banco, CAPI).
- Perfect Pay é o gateway core desta fase. O foco é automatizar o track completo dentro de Track AI para que o lead precise fazer o mínimo possível.

**Objetivo**
Criar o motor backend que:
1. Recebe credenciais do lead (pixel, token, webhook secret, landing) e valida cada repositório (gateway, meta, landing, GTM).
2. Provisiona infraestrutura (Cloudflare, Stape, GTM, banco, fila) em paralelo, mantendo o lead informado.
3. Garante ingestão confiável de eventos (webhooks/clicks), matching/deduplicação e dispatch no Meta CAPI com retries/circuit breaker.
4. Alimenta o Setup Agent com ferramentas que diagnosticam falhas, aplicam templates e retornam o snippet pronto.
5. Exibe status (dashboard, logs, alerts) e integra com QA para validar ponta a ponta.

**Arquitetura e decisões pré-aprovadas**
- DNS: Cloudflare API v4 com registros CNAME proxied=false.
- sGTM: Stape API com container Pro por cliente, polling estado active.
- GTM Web: Google Tag Manager API v2 via Service Account com escopos `tagmanager.*`.
- Banco: PostgreSQL RDS Multi-AZ + Redis; indexes críticos e deduplicação com event_id sha256.
- Filas: AWS SQS (ingest-events, match-events, capi-dispatch + DLQs).
- Backend: Node.js/TypeScript no ECS Fargate, API Gateway + WAF de entrada, monitoramento CloudWatch + Sentry.
- Dashboard: Next.js + Supabase Realtime (wizard + status).

**O que já foi entregue**
- Google Cloud Project, GTM API, Service Account, Cloudflare e Stape configurados (ver `.env` referencial).
- Conta Perfect Pay conectada + tokens de webhook definidos.
- Repositório com APIs básicas e wizard modal inicial (aplicação rodando em localhost/Vercel).

**Dependências**
- `GTM_CREDENTIALS_PATH`, `CF_*`, `STAPE_API_KEY`, `PERFECTPAY_WEBHOOK_SECRET`, secrets de banco em `.env`.
- Credenciais primeiramente em `.env`, depois replicar em AWS Secrets Manager antes da produção.
- Repositório de templates GTM/Pixel + base de agents para automação.

**Critérios de sucesso**
- Lead recebe snippet + webhook e o agente valida Publicação (Events Manager).
- Eventos Perfect Pay chegam ao `@track` (matched) e disparo Meta CAPI completado com event_id/dedup.
- Dashboard indica tenant `active`, Event Match Quality ≥ 6, DLQ zerada.
- Tudo registrado com logs + alerts configurados via CloudWatch/Sentry.

— Morgan, planejando o futuro 📊
