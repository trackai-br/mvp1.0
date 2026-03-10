# Arquitetura SaaS: Hub Server-Side Tracking para Meta Ads

## 1) Resumo Executivo
Objetivo: criar um SaaS intermediário, no-code/low-code, que conecte trackers client-side e gateways de pagamento ao Meta CAPI com alta taxa de matching, deduplicação robusta, baixa latência e operação auditável.

Metas de arquitetura:
- Escala: 10.000 eventos/min (com burst superior)
- Latência: p95 < 60s entre conversão e envio ao Meta
- Confiabilidade: 99,9% uptime
- Match rate: > 80% (com evolução por scoring)
- Extensibilidade: novo gateway em < 2 dias

## 2) Stack Recomendada
Escolha principal: AWS + TypeScript/Node.js + PostgreSQL + Redis + SQS.

Justificativa:
- Node.js/TypeScript acelera integração com APIs/webhooks e time-to-market.
- PostgreSQL resolve bem consistência transacional, auditoria, joins de atribuição e multi-tenant.
- Redis melhora lookup de sessão/click recente e controle de idempotência quente.
- SQS desacopla ingestão de processamento, com retry e DLQ nativos.
- ECS Fargate simplifica operação sem overhead de Kubernetes no MVP.

Componentes:
- API Gateway + WAF
- Serviços em ECS Fargate:
  - Ingestion API (webhooks + tracking)
  - Match Engine
  - Dispatch Engine (Meta CAPI)
  - Setup Agent Runtime (ferramentas de validação/config)
- Banco: Amazon RDS PostgreSQL
- Cache/locks: ElastiCache Redis
- Fila: SQS Standard + DLQ
- Observabilidade: CloudWatch + OpenTelemetry + Sentry
- Armazenamento de evidências (prints, logs técnicos): S3

Alternativa para fase 2: migrar workers de alta carga para EKS/Kafka quando throughput e fanout justificarem.

## 3) SQL vs NoSQL
Recomendação: SQL (PostgreSQL) como sistema de registro.

Motivo:
- Entidades relacionais claras: click, session, identity, conversion, dedupe_key, dispatch_attempt.
- Regras de consistência (idempotência, FK, unique constraints) são críticas.
- Consultas analíticas e auditoria por tenant/funil/período exigem joins confiáveis.

NoSQL opcional:
- Só para casos pontuais (ex.: documentos de troubleshooting ou vector payload do agente), sem substituir o core transacional.

## 4) Fluxo End-to-End
```mermaid
flowchart TD
  A[Meta Ads Click] --> B[LP/Redirect Link]
  B --> C[/api/v1/track/click]
  C --> D[(Postgres clicks)]
  C --> E[(Redis hot session/index)]

  F[Checkout/Gateway] --> G[/api/v1/webhooks/{gateway}]
  G --> H[SQS ingest-events]
  H --> I[Match Engine Worker]
  I --> J[(Postgres conversions + matches)]
  I --> K[SQS capi-dispatch]
  K --> L[Dispatch Worker]
  L --> M[Meta CAPI v21 events]
  L --> N[(Postgres dispatch_attempts)]
  L --> O[(DLQ)]

  P[UI No-code Funnels] --> Q[/api/v1/funnels]
  Q --> R[(Postgres funnels/mappings)]
```

## 5) Endpoints (v1)
Tracking:
- POST `/api/v1/track/click`
- POST `/api/v1/track/pageview`
- POST `/api/v1/track/initiate_checkout`

Webhooks:
- POST `/api/v1/webhooks/hotmart`
- POST `/api/v1/webhooks/kiwify`
- POST `/api/v1/webhooks/stripe`
- POST `/api/v1/webhooks/perfectpay`
- POST `/api/v1/webhooks/appmax`
- POST `/api/v1/webhooks/braip`

Configuração e operação:
- GET `/api/v1/funnels`
- POST `/api/v1/funnels`
- GET `/api/v1/events`
- GET `/api/v1/events/{id}`
- POST `/api/v1/replay/{event_id}`

Onboarding inteligente:
- POST `/api/v1/setup/sessions`
- POST `/api/v1/setup/sessions/{id}/validate`
- POST `/api/v1/setup/sessions/{id}/autoconfigure`
- GET `/api/v1/setup/sessions/{id}/status`
- POST `/api/v1/setup/sessions/{id}/chat`
- POST `/api/v1/setup/sessions/{id}/actions/{tool}`

## 6) Modelo de Dados (mínimo)
Tabelas principais:
- `tenants` (id, nome, plano, status)
- `funnels` (id, tenant_id, tipo, config_json, ativo)
- `clicks` (id, tenant_id, funnel_id, click_id unique, fbclid, fbc, fbp, utms, ip, ua, ts)
- `sessions` (id, tenant_id, session_id unique, first_click_id, last_click_id, last_seen_at)
- `identities` (id, tenant_id, email_hash, phone_hash, first_seen_at, last_seen_at)
- `conversions` (id, tenant_id, gateway, order_id, amount, currency, status, ts, email_hash, phone_hash)
- `matches` (id, conversion_id unique, click_id, confidence_score, rule_applied, matched_at)
- `capi_events` (id, tenant_id, conversion_id, event_name, event_id unique, payload_json, status)
- `dispatch_attempts` (id, capi_event_id, attempt_no, provider_response, http_status, ts)
- `dedupe_registry` (id, tenant_id, event_id unique, source, first_seen_at)
- `setup_sessions` (id, tenant_id, state, provider_meta, provider_gateway, created_at)
- `setup_messages` (id, setup_session_id, role, content, created_at)
- `setup_action_logs` (id, setup_session_id, tool_name, input_json, output_json, status)

Índices críticos:
- `clicks(tenant_id, ts desc)`
- `clicks(tenant_id, fbc)`
- `clicks(tenant_id, fbclid)`
- `conversions(tenant_id, order_id unique)`
- `identities(tenant_id, email_hash)`
- `identities(tenant_id, phone_hash)`
- `matches(conversion_id unique)`
- `capi_events(tenant_id, status, created_at)`

## 7) Matching de Eventos (resposta direta)
Estratégia híbrida determinística + scoring:

Etapa 1 (determinística, alta confiança):
- `session_id`/`click_id` explícito
- `email_hash` exato
- `phone_hash` exato

Etapa 2 (semi-determinística):
- `fbc`/`fbclid` + janela temporal
- `ip + ua` + proximidade temporal

Etapa 3 (scoring):
- Score ponderado por sinais e recência
- Thresholds:
  - >= 0,85: auto-match
  - 0,60-0,84: pending_review/auto com flag
  - < 0,60: unmatched

Janela de atribuição recomendada:
- Click-through: 7 dias (configurável)
- View-through: opcional, 1 dia

## 8) Deduplicação (resposta direta)
Padrão recomendado:
- Gerar `event_id` estável por conversão/evento: `sha256(tenant_id|order_id|event_name|value|currency)`.
- Enviar o mesmo `event_id` no browser (quando possível) e no server (CAPI).
- Persistir em `dedupe_registry` com unique index por `tenant_id + event_id`.
- Rejeitar/envio idempotente para duplicatas em qualquer reprocessamento.

Janela prática:
- 48h de proteção forte no hub (Meta deduplica, mas o hub também deve deduplicar).

## 9) Fila e Processamento Assíncrono (resposta direta)
Recomendação: SQS Standard + DLQ.

Topologia:
- Queue `ingest-events` (webhook normalizado)
- Queue `match-events` (opcional separação por tipo)
- Queue `capi-dispatch`
- DLQs por fila

Padrões:
- Retry exponencial com jitter
- Visibility timeout ajustado ao tempo médio de worker
- Circuit breaker para erros 5xx do Meta
- Reprocessamento manual por event_id

Escalabilidade:
- Auto Scaling por backlog (ApproximateNumberOfMessagesVisible)
- Partition key lógica por tenant para fairness

## 10) Latência e SLA
Para p95 < 60s:
- ACK rápido em webhook (< 200ms) e processamento async
- Worker capi com lotes pequenos (1-20 eventos) e alta concorrência
- Redis para lookup de contexto quente
- Pré-cálculo de hashes e payload templates
- Retry imediato em erros transitórios de rede

SLOs iniciais:
- Ingestão webhook p95 < 300ms
- Match p95 < 5s
- Dispatch p95 < 20s
- End-to-end p95 < 45s; p99 < 60s

## 11) Segurança e LGPD/GDPR
Princípios:
- Data minimization: armazenar somente o necessário
- Hash antes de persistir para email/phone (SHA-256 com normalização)
- Criptografia at-rest (RDS, S3, Redis) e in-transit (TLS)
- Segredos em AWS Secrets Manager

Políticas recomendadas:
- Retenção padrão: 90 dias para dados de matching; agregados anonimizados por 13 meses
- Direito ao esquecimento: endpoint/admin job para purge por email_hash/phone_hash/order_id
- Consentimento: flag por evento (`consent_ads=true/false`), bloqueando envio ao Meta quando falso
- Logs sem PII em claro; usar IDs e hashes truncados

## 12) Agente de Setup Inteligente (integrado ao core)
Arquitetura recomendada:
- LLM primário: Claude Sonnet ou GPT-4.1 para troubleshooting técnico
- Roteador de modelos por custo/latência:
  - Diagnóstico simples: modelo rápido/barato
  - Casos críticos: modelo premium
- Tool-calling estrito (allowlist):
  - `validate_gateway_credentials`
  - `validate_meta_token`
  - `probe_landing_url`
  - `send_test_capi_event`
  - `check_pixel_presence`
  - `generate_tracking_snippet`

RAG/Knowledge Base:
- Necessária para reduzir alucinação e padronizar suporte
- Base inicial: docs internas, playbooks por gateway, erros conhecidos
- Stack simples: pgvector no Postgres (MVP) antes de Pinecone/Weaviate

Memória da conversa:
- Curto prazo: histórico da sessão (`setup_messages`)
- Longo prazo: fatos persistidos (`setup_session.state_json`)

Fallback humano:
- Escalonar após N falhas (ex.: 3) ou confiança baixa
- Handoff com pacote completo: transcript + ações tentadas + logs + evidências

Canal em tempo real:
- SSE primeiro (mais simples que websocket para MVP)

## 13) Prompt Engineering para não alucinar
Regras de sistema:
- “Responda apenas com base em contexto recuperado/tool outputs.”
- “Quando faltarem dados, peça evidência específica.”
- “Nunca inventar status de integração.”
- “Toda recomendação técnica deve citar fonte interna (doc/tool_result).”

Guardrails:
- Schema validation para respostas estruturadas
- Classificador de risco (alta incerteza => pedir validação humana)
- Testes offline com suíte de prompts reais

## 14) Custo Estimado
Premissas:
- 1M eventos/mês, ~33k/dia, picos concentrados
- 2 ambientes (prod + stage enxuto)

Infra (ordem de grandeza/mês):
- ECS Fargate + ALB + API GW + SQS + RDS + Redis + observabilidade: USD 800 a 2.500
- Pode subir em Black Friday/lancamentos (autoscaling + logs): USD 2.500 a 6.000 no mês de pico

LLM setup-agent (1.000 conversas/mês):
- Com roteamento híbrido (rápido + premium quando necessário): USD 80 a 600/mês
- Faixa varia por tamanho médio do contexto e % de escalonamento para modelo premium

## 15) Riscos Técnicos Não-Triviais
- Quebra de contrato em webhooks de gateways sem versionamento
- Qualidade baixa de sinais (sem fbc/fbp/fbclid) reduz match rate
- Restrição de consentimento/regulatório por país/setor
- Dependência de APIs externas (Meta/gateways) durante picos
- Drift de configuração em funis no-code sem validação automatizada

Mitigações:
- Contract tests por gateway
- Feature flags por integração
- Alertas de qualidade de sinal (taxa de eventos incompletos)
- Chaos testing em filas/retries
- Validador de funil antes de publicar

## 16) Respostas Diretas às 7 Perguntas
1. Stack: Node.js/TypeScript + PostgreSQL + Redis + SQS + ECS Fargate na AWS, pela combinação de velocidade de entrega, robustez e custo operacional equilibrado.
2. SQL ou NoSQL: SQL (PostgreSQL) no core transacional; NoSQL apenas complementar.
3. Matching: pipeline híbrido deterministic-first + scoring por sinais + janela temporal configurável.
4. Deduplicação: `event_id` estável compartilhado Pixel/CAPI + idempotência no hub via unique constraint.
5. Fila: SQS Standard com DLQ, retries exponenciais, autoscaling por backlog.
6. Custo 1M eventos/mês: infra ~USD 800-2.500/mês (normal), com pico podendo elevar para USD 2.500-6.000.
7. Riscos não previstos: contratos instáveis de webhook, baixa qualidade de sinal, gargalos em APIs externas e governança de consentimento.

## 17) Plano de Entrega (2-3 dias úteis para definição)
Dia 1:
- Event storming + contratos de webhook + modelo de dados final
- SLO/SLI + política LGPD e retenção

Dia 2:
- Desenho detalhado de filas/workers, dedupe e matching
- RFC do Setup Agent (tools, guardrails, handoff humano)

Dia 3:
- ADRs finais + backlog MVP (épicos e stories) + estimativa macro

## 18) MVP sugerido (primeiros 45 dias)
Escopo MVP:
- Gateways: Hotmart, Kiwify, Stripe
- Tracking: click + initiate_checkout + purchase
- Meta CAPI com dedupe completo
- Match deterministic + scoring básico
- Setup Agent v1 com 5 tools críticas
- Dashboard operacional mínimo (event status, falhas, replay)

Fora do MVP:
- Otimizações avançadas de ML para atribuição
- Integrações secundárias (Appmax/Braip/Perfect Pay) após estabilização
