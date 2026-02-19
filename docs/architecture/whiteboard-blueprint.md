# Whiteboard Blueprint - Hub Server-Side Tracking

## 1. Decisao de Ferramentas (eficiencia)

Escolha recomendada para este projeto:
- Whiteboard tecnico: **Miro**
- Backlog e execucao: **ClickUp**

Motivo pratico:
- Miro e mais forte para diagramacao sistemica (fluxos grandes, frames e canvas livre).
- ClickUp oferece hierarquia nativa para produto/engenharia (Epic -> Story -> Subtask), campos customizados e webhooks maduros para automacao com agentes.

Quando usar Figma/Trello:
- Figma: para UI/prototipos de telas; manter como ferramenta secundaria.
- Trello: somente se o time for pequeno e backlog simplificado; para este produto multi-servicos, tende a escalar pior.

## 2. Integracao dos Agentes (antes do dev)

### 2.1 Agentes -> Miro

Objetivo: o agente criar/atualizar board tecnico automaticamente (frames, sticky notes, cards de decisoes).

Escopo MVP:
- Criar board base por tenant/projeto.
- Criar frames padrao: Contexto, Frontend, API, Workers, Banco, Riscos, Decisoes.
- Publicar snapshots de arquitetura por versao (v0, v1, v2).

Integração tecnica:
- OAuth app no Miro.
- API principal: `/v2/boards`, `/v2/boards/{board_id}/items`, `/items/bulk`.
- Estrategia de sincronizacao: write-through por comando do agente (nao evento em tempo real).

Observacao importante:
- Webhooks experimentais do Miro foram descontinuados em **5 de dezembro de 2025**. Portanto, o padrao mais seguro hoje e sincronizacao ativa via API (polling controlado ou comandos de publicacao).

### 2.2 Agentes -> ClickUp

Objetivo: transformar arquitetura aprovada em backlog executavel, com rastreabilidade.

Escopo MVP:
- Criar Space "Hub Tracking".
- Criar Folders por release (MVP, Hardening, Scale).
- Criar Lists por dominio (Core, Integracoes, Setup Agent, Observabilidade, Compliance).
- Criar tasks (stories) com campos de prioridade, risco, owner, estimativa e dependencia.

Integração tecnica:
- API v2 do ClickUp para tarefas/campos.
- Webhooks para eventos de status (taskCreated, taskUpdated, taskStatusUpdated).
- Assinatura HMAC com `X-Signature` no endpoint receptor.

## 3. Board Visual de Arquitetura (Miro)

## 3.1 Mapa Macro (sistema)

```mermaid
flowchart LR
  U[Usuario] --> FE[Frontend Setup Wizard]
  FE --> API[Hub API - Ingestion/Setup]

  GW[Gateways: Hotmart Kiwify Stripe] --> API
  LP[Landing Page + Pixel] --> API

  API --> Q1[SQS ingest-events]
  Q1 --> W1[Match Worker]
  W1 --> DB[(PostgreSQL)]
  W1 --> Q2[SQS capi-dispatch]
  Q2 --> W2[Dispatch Worker]
  W2 --> META[Meta CAPI]

  API --> REDIS[(Redis)]
  API --> S3[(S3 Evidencias)]
  API --> OBS[CloudWatch + OTel + Sentry]

  FE --> SETUP[AI Setup Agent]
  SETUP --> TOOLS[Tool Calling Seguro]
  TOOLS --> API
```

## 3.2 Fluxo Frontend (onboarding + troubleshooting)

```mermaid
flowchart TD
  A[Inicio Setup] --> B[Formulario Estruturado]
  B --> C[Validacao local campos]
  C --> D[POST /setup/sessions]
  D --> E[POST /validate]
  E --> F{Validou tudo?}

  F -- Sim --> G[POST /autoconfigure]
  G --> H{Autoconfig ok?}
  H -- Sim --> I[Setup concluido + dashboard]
  H -- Nao --> J[Abrir chat IA]

  F -- Nao --> J
  J --> K[Agente diagnostica + chama tools]
  K --> L{Resolvido?}
  L -- Sim --> I
  L -- Nao --> M[Escalar para humano]
```

## 3.3 Fluxo API/Workers (eventos)

```mermaid
sequenceDiagram
  participant G as Gateway Webhook
  participant A as Ingestion API
  participant Q as SQS ingest-events
  participant M as Match Worker
  participant D as Postgres
  participant C as SQS capi-dispatch
  participant P as Dispatch Worker
  participant F as Meta CAPI

  G->>A: POST /webhooks/{gateway}
  A-->>G: 200 ACK rapido
  A->>Q: enqueue evento normalizado
  Q->>M: consume
  M->>D: persist conversion + match
  M->>C: enqueue capi_event
  C->>P: consume
  P->>F: send CAPI
  F-->>P: response
  P->>D: dispatch_attempts + status
```

## 3.4 Modelo de dados (ER simplificado)

```mermaid
erDiagram
  TENANTS ||--o{ FUNNELS : has
  TENANTS ||--o{ CLICKS : has
  TENANTS ||--o{ SESSIONS : has
  TENANTS ||--o{ IDENTITIES : has
  TENANTS ||--o{ CONVERSIONS : has
  TENANTS ||--o{ CAPI_EVENTS : has
  TENANTS ||--o{ DEDUPE_REGISTRY : has
  TENANTS ||--o{ SETUP_SESSIONS : has

  CONVERSIONS ||--|| MATCHES : generates
  CONVERSIONS ||--o{ CAPI_EVENTS : produces
  CAPI_EVENTS ||--o{ DISPATCH_ATTEMPTS : logs
  SETUP_SESSIONS ||--o{ SETUP_MESSAGES : stores
  SETUP_SESSIONS ||--o{ SETUP_ACTION_LOGS : stores
```

## 4. Frames obrigatorios no Miro

Crie estes frames no board:
1. Contexto de Produto e Metricas
2. Fluxo Frontend (Wizard + Chat)
3. Contratos de API (Setup + Tracking + Webhooks)
4. Event Pipeline (SQS/Workers)
5. Banco de Dados e idempotencia
6. Setup Agent (tools, guardrails, fallback)
7. Observabilidade e SLOs
8. Riscos e Mitigacoes

## 5. Padrao de contratos de API (resumo)

Setup:
- `POST /api/v1/setup/sessions`
- `POST /api/v1/setup/sessions/{id}/validate`
- `POST /api/v1/setup/sessions/{id}/autoconfigure`
- `GET /api/v1/setup/sessions/{id}/status`
- `POST /api/v1/setup/sessions/{id}/chat`
- `POST /api/v1/setup/sessions/{id}/actions/{tool}`

Tracking:
- `POST /api/v1/track/click`
- `POST /api/v1/track/pageview`
- `POST /api/v1/track/initiate_checkout`

Webhooks:
- `POST /api/v1/webhooks/{gateway}`

Operacao:
- `GET /api/v1/events`
- `GET /api/v1/events/{id}`
- `POST /api/v1/replay/{event_id}`

## 6. Definicao de pronto para iniciar desenvolvimento

Checklist:
- [ ] Board Miro com 8 frames obrigatorios aprovado por produto + engenharia
- [ ] Contratos de API v1 revisados
- [ ] ER simplificado aprovado
- [ ] Regras de dedupe/matching documentadas
- [ ] Backlog MVP criado no ClickUp com owners e dependencias
- [ ] Politica de seguranca e LGPD documentada
