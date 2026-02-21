## Track AI Architecture Blueprint & Backlog

---

## API Gateway + WAF — Configuração Provisionada

> Atualizado em: Story 002 | Status: WAF criado, API Gateway pendente de ALB/ECS

### WAF WebACL — hub-tracking-waf

**ARN:** `arn:aws:wafv2:us-east-1:571944667101:regional/webacl/hub-tracking-waf/d77011e7-2880-4385-ae04-fd17e3d304ec`
**Região:** us-east-1 | **Escopo:** REGIONAL (para ALB)

#### Regras configuradas

| Prioridade | Nome | Tipo | Limite | Alvo | Ação |
|------------|------|------|--------|------|------|
| 1 | RateLimitTracking | Rate-based | 1.000 req/5min por `x-tenant-id` | `/api/v1/track/*` | Block |
| 2 | RateLimitSetup | Rate-based | 100 req/5min por `x-tenant-id` | `/api/v1/setup/*` | Block |
| 3 | RateLimitWebhooks | Rate-based | 500 req/5min por IP | `/api/v1/webhooks/*` | Block |
| 4 | AWSManagedCommonRules | Managed | AWS Common Rule Set | Todas as rotas | Block (regras internas) |
| 5 | AWSManagedKnownBadInputs | Managed | Known Bad Inputs | Todas as rotas | Block (regras internas) |

#### Por que essas regras?

- **Tracking (1.000/5min por tenant):** rotas de alta frequência, mas cada tenant tem seu próprio bucket de requisições — um tenant abusivo não afeta outros.
- **Setup (100/5min por tenant):** rotas sensíveis de configuração. Limite baixo para evitar automação indevida.
- **Webhooks (500/5min por IP):** webhooks vêm de servidores de gateways (Hotmart, PerfectPay), não de usuários. Limitamos por IP de origem para evitar replay attacks.
- **Common Rules:** bloqueia automaticamente SQL injection, XSS, path traversal e outros ataques comuns.
- **Known Bad Inputs:** bloqueia payloads maliciosos conhecidos (Log4Shell, shellshock, etc.).

#### Header obrigatório nas requisições

Todas as requisições ao backend devem incluir:
```
x-tenant-id: {uuid-do-tenant}
```

Sem este header, as regras de rate limiting por tenant não funcionam — o WAF aplica o limite por IP como fallback.

### Como associar o WAF ao ALB (quando o ECS estiver pronto)

```bash
# Substituir {ALB_ARN} pelo ARN do seu Application Load Balancer
aws wafv2 associate-web-acl \
  --region us-east-1 \
  --web-acl-arn "arn:aws:wafv2:us-east-1:571944667101:regional/webacl/hub-tracking-waf/d77011e7-2880-4385-ae04-fd17e3d304ec" \
  --resource-arn "{ALB_ARN}"
```

### Health Check recomendado

Endpoint dedicado a criar no backend:
```
GET /health → 200 OK
{
  "status": "ok",
  "db": "connected",
  "version": "1.0.0"
}
```

Configurar no ALB Target Group:
- Path: `/health`
- Intervalo: 30s
- Threshold saudável: 2 respostas OK
- Threshold não-saudável: 3 falhas

### Rotas protegidas pelo WAF

| Grupo | Rotas | Rate Limit |
|-------|-------|------------|
| Tracking | `POST /api/v1/track/click` `POST /api/v1/track/pageview` `POST /api/v1/track/initiate_checkout` | 1.000 req/5min/tenant |
| Webhooks | `POST /api/v1/webhooks/{hotmart,kiwify,stripe,perfectpay,appmax,braip}` | 500 req/5min/IP |
| Setup | `POST /api/v1/setup/sessions` `POST /api/v1/setup/sessions/:id/*` | 100 req/5min/tenant |
| Config | `GET/POST /api/v1/funnels` `GET /api/v1/events` `POST /api/v1/replay/:id` | Coberto pelo Common Rules |

---

### 1. Blueprint Overview
- **Single Miro board** (whiteboard mode) with quadrants representing the major sectors:
  - **Experience Core (top-left)**: modal wizard, onboarding flow, realtime status, copy snippet CTA, action logs.
  - **Tracking Orchestrator (top-right)**: session controller, GTM template engine, webhook router, validation/test services.
  - **Integrations Grid (bottom-left)**: connectors for Meta (pixel + CAPI), Perfect Pay webhook, RedTrack/UTM dashboards, future connectors.
  - **Operations & Observability (bottom-right)**: audit trail, logs/alerting, agent troubleshooting view, deployment/resilience.
  - Visual cues: use color-coded swimlanes per sector, drawn lanes for event flow (form submission → session → agent actions → monitors) and connectors to teaching resources.

### 2. Miro Board Content
1. **Playback flow**: from `Wizard` sidebar -> `Form collection` -> `Auto validation` -> `Agent chat fallback`.
2. **Agent behavior**: show decision tree for `success path` vs `troubleshoot path`, highlight function calls like `validateGateway`, `applyGtmTemplate`, `emitTestEvent`.
3. **Infrastructure**: annotate API surface (`/api/v1/setup/sessions`, `/status`, `/validate`, `/webhooks/perfectpay/...`) plus how Perfect Pay webhook integrates with the GTM engine.
4. **Deployment notes**: our existing Vercel production URL and instructions for hooking to GitHub/Vercel, plus reminder that the webhook needs a public domain (provided by `https://web-isahrfl1d...vercel.app`).

### 3. ClickUp Backlog Structure (replacing any prior tasks)
- **Business Unit: Backend Tracking Engine**
  * Space: Session Reliability
    - Task: "Session lifecycle API hardening" (due **Feb 25**) – document request/response shapes, add telemetry, and add retries for Perfect Pay webhook validation (owner: TBD).
    - Task: "Agent troubleshooting hooks" (due **Mar 2**) – expand `/validate` logic to detect 401/timeout, store remediation hints, and expose a retry endpoint (owner: TBD).
  * Space: Template Generation
    - Task: "GTM template engine" (due **Mar 5**) – implement templating service, version snippets per lead, support `applyGtmTemplate` function call, store resulting code in DB (owner: TBD).
    - Task: "Snippet delivery workflow" (due **Mar 6**) – surface generated snippet, include copy instructions, and emit audit log (owner: TBD).
- **Business Unit: Integration Platform**
  * Space: Meta + Perfect Pay Connectors
    - Task: "Meta validation agent" (due **Feb 28**) – call Meta APIs with `pixelID`/`accessToken`, emit sample conversion event, surface errors with suggestions (owner: TBD).
    - Task: "Perfect Pay webhook setup" (due **Feb 27**) – register endpoint, validate payload format, test dedup token, log response (owner: TBD).
  * Space: External Dashboards (RedTrack/UTMfy)
    - Task: "UTM builder + RedTrack API" (due **Mar 4**) – convert lead data into UTM set, push through connectors, record statuses (owner: TBD).
    - Task: "Integration troubleshooting prompts" (due **Mar 6**) – craft agent prompts for failure cases, map to remediation actions (owner: TBD).
- **Business Unit: Reliability & Observability**
  * Space: Audit & Support
    - Task: "Agent chat history retention" (due **Mar 9**) – save transcripts + function-call logs, allow context export during escalation (owner: TBD).
    - Task: "Monitoring + alerts" (due **Mar 7**) – expose validation/build metrics, hook to Slack/email/ClickUp updates (owner: TBD).

> NOTE: Any previous ClickUp tasks were superseded by this new structure. Please archive or delete older entries before importing the new set to prevent duplication.

### 4. Stories to feed the epic
1. **Story: Session lifecycle hardening** – As a backend engineer, I want the setup session endpoints to record each state transition (created → validating → success/failure) so that the frontend and ClickUp can surface accurate status. Acceptance: API docs updated, telemetry stored, idempotent retries when Perfect Pay webhook fails.
2. **Story: GTM template generator** – As an automation engine, I want to apply lead-specific data to GTM/Pixel/webhook templates and persist the resulting snippet so the lead receives a ready-to-install code block. Acceptance: versioned snippet stored per session, ability to regenerate, `applyGtmTemplate` function returning JS string.
3. **Story: Meta + Perfect Pay connector validation** – As an integration service, I want to validate pixel/token and webhook connectivity and emit test conversions to Meta CAPI so the agent can confirm the tracking path. Acceptance: connectors report `green`/`red` states with remediation hints.
4. **Story: Troubleshooting agent flows** – As a conversational agent, I want to detect failures (401, 404, missing pixel) and suggest next steps, optionally retrying validations so the lead experiences a guided resolution. Acceptance: errors captured, prompts mapped to tasks, automatic revalidation when triggered.
5. **Story: Observability & alerts** – As an operator, I want to see logs, agent chat transcripts, and alert rules for the backend tracking flow so I can escalate before the lead notices. Acceptance: dashboards/ClickUp updates exist, alerts defined for webhook failures and failed builds.

### 5. Miro Flowchart (whiteboard)
Use the existing board (`https://miro.com/app/board/uXjVG97k_Ew=/`) as the single whiteboard. Arrange the zones as follows:
1. **Input zone (top-left)**: depict the wizard form (fields: pixel ID, access token, landing URL, gateway, webhook endpoint). Show an arrow entering the Session Controller block.
2. **Core engine zone (center)**: draw the session lifecycle with `create → validate → success/failure` states, include functions `validateGateway`, `applyGtmTemplate`, `emitTestEvent`, and annotate the API endpoints that drive each action.
3. **Integration zone (top-right)**: map connectors to Meta CAPI, Perfect Pay, RedTrack/UTMfy dashboards. Include the Perfect Pay webhook path and the fallback agent chat for troubleshooting.
4. **Observability zone (bottom)**: illustrate logs, agent transcripts, alert panels, and the snippet delivery drawer.
5. **Flow annotations**: color-code success paths (green) and failure routes (red), add legends for connectors, and note that all GTM templates live internally (no third-party templates exposed).

Replace any existing visual diagrams with this updated flow so there's no duplication.

### 4. Operational Notes
- All tasks with external dependency (ex: obtaining GTM OAuth, verifying dashboards) remain unassigned until the human team confirms availability.
- Each ClickUp task includes checklists (e.g., `Draft function spec`, `Write tests`, `Document in wiki`), attach relevant context via `docs/track-ai-architecture.md`.
- Backlog scales with new connectors; blueprint stays single-board to respect Miro Free limits.

### 5. Next Immediate Steps
1. Populate the described ClickUp workspace/business units/spaces/tasks (with due dates above) using the automation described; leave ownership blank for manual assignments.
2. Capture the Miro board layout in a new section of the board (preferably the `Experience Core` quadrant) so every collaborator can visualize the flow.
3. Begin implementing `GTM template engine` and Meta/Perfect Pay validation agents on the backend; deliver status updates in ClickUp tasks.

— Aria, arquitetando o futuro 🏗️
