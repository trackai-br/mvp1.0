# Backlog MVP - Hub Server-Side Tracking

## Estrutura recomendada no ClickUp

Hierarquia:
- Space: Hub Tracking
- Folders: MVP, Hardening, Scale
- Lists (MVP): Core Platform, Gateways, Setup Agent, Observability, Compliance

Campos customizados minimos:
- `epic` (dropdown)
- `component` (dropdown)
- `risk_level` (low/medium/high)
- `story_points` (number)
- `owner_role` (backend/frontend/data/devops)
- `depends_on` (text)

## Epicos e stories (ordem sugerida)

## EPIC 1 - Foundation e Ingestion

1. Story: Criar estrutura base do backend (Node/TS)
- Entrega: API healthcheck + padrao de modulos
- Saida: servico inicial versionado

2. Story: Endpoint de ingestao de click
- Entrega: `POST /track/click` com validacao
- Saida: click persistido e indexado

3. Story: Endpoint de ingestao de pageview/initiate_checkout
- Entrega: dois endpoints tracking adicionais
- Saida: eventos basicos no banco

4. Story: Webhook receiver generico
- Entrega: `POST /webhooks/{gateway}` com assinatura
- Saida: payload normalizado e enfileirado

## EPIC 2 - Matching e Deduplicacao

1. Story: Modelo de dados de conversao e dedupe
- Entrega: tabelas `conversions`, `matches`, `dedupe_registry`

2. Story: Matching deterministic-first
- Entrega: regras para click_id/session_id/email_hash/phone_hash

3. Story: Scoring baseline
- Entrega: score com threshold configuravel

4. Story: Idempotencia forte
- Entrega: `event_id` estavel + unique constraints + replay seguro

## EPIC 3 - Dispatch para Meta CAPI

1. Story: Worker de dispatch
- Entrega: consumo de fila + envio CAPI

2. Story: Retry + DLQ
- Entrega: politica exponencial com jitter

3. Story: Auditoria de tentativas
- Entrega: tabela `dispatch_attempts` e trilha de erros

## EPIC 4 - Setup Agent v1 (diferencial)

1. Story: Sessao de setup e estado
- Entrega: `setup_sessions`, `setup_messages`, `setup_action_logs`

2. Story: Validacao automatica (tools)
- Entrega: `validate_gateway_credentials`, `validate_meta_token`, `probe_landing_url`

3. Story: Autoconfiguracao assistida
- Entrega: acao de configuracao com log e rollback minimo

4. Story: Chat de troubleshooting
- Entrega: `POST /setup/sessions/{id}/chat` + memoria curta

5. Story: Fallback humano
- Entrega: regra de escalonamento apos N falhas + pacote de handoff

## EPIC 5 - Frontend de Onboarding

1. Story: Wizard de coleta inicial
- Entrega: formulario por etapas com validacao

2. Story: Tela de status de setup
- Entrega: progresso em tempo real (SSE)

3. Story: Chat troubleshooting
- Entrega: interface de chat com upload de screenshot

## EPIC 6 - Observabilidade e Operacao

1. Story: Telemetria padrao
- Entrega: logs estruturados + traces OTel

2. Story: Dashboard operacional
- Entrega: eventos, falhas, retries, replay

3. Story: Alertas SLO
- Entrega: alertas para atraso de fila, erro CAPI, queda de match rate

## EPIC 7 - Seguranca e Compliance

1. Story: Gestao de segredos
- Entrega: secrets manager + rotacao

2. Story: Politicas LGPD
- Entrega: retencao + purge por identificador

3. Story: Consent enforcement
- Entrega: bloqueio de envio quando `consent_ads=false`

## Dependencias criticas

1. EPIC 1 antes de EPIC 2 e EPIC 3
2. EPIC 4 depende de EPIC 1 (setup sessions + tool runtime)
3. EPIC 5 depende de endpoints de EPIC 1 e EPIC 4
4. EPIC 6 e EPIC 7 rodam em paralelo a partir da metade do EPIC 1

## Definicao de backlog pronto para sprint

Checklist:
- [ ] Cada story com AC claro
- [ ] Estimativa em story points
- [ ] Dono definido
- [ ] Dependencias mapeadas
- [ ] Testes aceitos definidos

## Backlog pequeno (primeira fatia executavel)

Objetivo: entregar validacao automatica minima do setup (sem chat completo), em 1 sprint curta.

1. Story: Criar sessao de setup
- Entrega: `POST /api/v1/setup/sessions`
- AC:
  - cria `setup_sessions` com `state=created`
  - retorna `session_id` e metadados basicos
  - valida `tenant_id` obrigatorio

2. Story: Tool `validate_gateway_credentials`
- Entrega: `POST /api/v1/setup/sessions/{id}/actions/validate_gateway_credentials`
- AC:
  - suporta ao menos Hotmart e Kiwify no MVP inicial
  - registra input/output em `setup_action_logs`
  - status final: `success` ou `failed` com motivo tecnico

3. Story: Tool `validate_meta_token`
- Entrega: `POST /api/v1/setup/sessions/{id}/actions/validate_meta_token`
- AC:
  - valida token + permissao basica no Meta
  - registra latencia e codigo de retorno
  - mascaramento de dados sensiveis no log

4. Story: Tool `probe_landing_url`
- Entrega: `POST /api/v1/setup/sessions/{id}/actions/probe_landing_url`
- AC:
  - testa alcance HTTP + status code + tempo de resposta
  - detecta redirecionamento inesperado
  - registra recomendacao de correcao

5. Story: Endpoint de status consolidado
- Entrega: `GET /api/v1/setup/sessions/{id}/status`
- AC:
  - retorna estado consolidado por etapa (gateway/meta/url)
  - retorna ultima falha acionavel
  - pronto para alimentar UI de progresso

Dependencias desta fatia:
1. Banco: `setup_sessions` e `setup_action_logs`
2. Segredos: armazenamento seguro para chaves/token
3. Observabilidade: log estruturado por `setup_session_id`
