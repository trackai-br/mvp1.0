# Story Track AI 009 – SQS Dispatch to Meta CAPI (Conversions API)

## Status: InProgress

**Approved by @po (Pax)** - 2026-02-21
- Validation Score: 9/10 ✅
- Risks & Mitigation section added

**Phase 1 Status - COMPLETE ✅** (2026-02-21)
- @dev completed core components (MetaCapiClient + CircuitBreaker)
- 17 new unit tests added, all passing (60 total tests)
- Code lint-clean, typecheck passing
- All checkboxes marked complete

**Phase 2 Status - COMPLETE ✅** (2026-02-21)
- @devops resolved IAM permission blocker
- Created SQS primary queue: `capi-dispatch`
- Created SQS dead letter queue: `capi-dispatch-dlq`
- Configured RedrivePolicy (maxReceiveCount=5)
- Created Secrets Manager secret: `meta-capi-credentials`
- Updated `.env.local` with queue URLs and secret name
- Ready for Phase 3: @dev implements SQS Worker

**Phase 2b Status - COMPLETE ✅** (2026-02-21)
- @dev completed SQS Worker implementation (CapiDispatchWorker class)
- Full polling loop with long polling, deduplication, and circuit breaker protection
- 8 new unit tests added (68 total passing)
- All quality gates passing: lint ✅, typecheck ✅, tests ✅
- Ready for Phase 3: Load testing + E2E validation

## Contexto

Com o Match Engine (Story 008) correlacionando cliques com conversões e hashing de PII, o próximo passo crítico é **enviar essas conversões ao Meta Conversions API (CAPI)** para feed de otimização.

Sem CAPI dispatch:
- Campanhas não recebem dados de conversão reais
- Meta não consegue otimizar bids
- CPM/CPC dispara por falta de feedback de performance

Esta story implementa:
1. **Worker SQS**: Lê fila `capi-dispatch`, envia eventos ao Meta
2. **Retry Logic**: Exponencial backoff (3-5 tentativas)
3. **Circuit Breaker**: Detecta falhas da Meta, pausa envios
4. **Audit Trail**: Cada tentativa logged em `DispatchAttempt`
5. **Dead Letter Queue**: Eventos não recuperáveis via DLQ para análise

## Agentes envolvidos

- `@dev`: Implementação do worker SQS + Meta API client
- `@qa`: Validação de retry logic, circuit breaker, edge cases
- `@devops`: Deploy do worker em ECS Fargate, configuração SQS + DLQ

## Objetivos

1. **Meta CAPI Integration**: Enviar conversões com 15 parâmetros hashed
2. **Reliability**: 99%+ entrega ao Meta (com retries), < 1% para DLQ
3. **Performance**: p95 < 2s por evento (fila → Meta → logged)
4. **Observability**: Métricas SQS, latência por gateway, taxa de sucesso
5. **Audit**: Cada dispatch attempt registrado com timestamp, status, response

## Tasks

**Phase 1 - Core Utilities (COMPLETE):**
- [x] Implementar Meta CAPI v21 client (Node.js + @facebook/business-sdk)
- [x] Implementar retry logic (exponencial backoff, max 5 tentativas)
- [x] Implementar circuit breaker (detecta 5+ falhas, pausa 60s)
- [x] Testes unitários (retry logic, circuit breaker, dedup)

**Phase 2 - AWS Infrastructure (COMPLETE):**
- [x] Criar AWS SQS filas: `capi-dispatch` + `capi-dispatch-dlq`
- [x] Criar AWS Secrets Manager secret para Meta CAPI credentials
- [x] Atualizar .env.local com queue URLs

**Phase 2b - SQS Worker Implementation (COMPLETE):**
- [x] Implementar worker em Node.js async (SQS consumer)
- [x] Integrar MetaCapiClient + CircuitBreaker na loop do worker
- [x] Implementar DispatchAttempt logging (schema já existe desde Story 008)
- [x] Integrar com CloudWatch para métricas/alarmes

**Phase 3 - Testing & Deployment (PENDING):**
- [ ] Testes de carga (1k+ events/min)
- [ ] Deploy em ECS Fargate com environment vars (Meta app ID, token)
- [ ] E2E test: Conversão do webhook → CAPI callback

## Critérios de Aceite

- [ ] Worker processa fila `capi-dispatch` continuamente
- [ ] Cada evento envia para Meta com 15 parâmetros (email, phone, etc hashed)
- [ ] Eventos duplicados não reprocessados (dedup via `gatewayEventId`)
- [ ] Meta retorna event_id + processing time < 2s p95
- [ ] Falhas Meta acionam retry (exp backoff: 1s, 2s, 4s, 8s, 16s)
- [ ] Após 5 falhas, evento → DLQ para análise manual
- [ ] Cada tentativa logged em `DispatchAttempt` com status/error/response
- [ ] Circuit breaker detecta Meta down (5+ falhas), pausa novos envios
- [ ] Zero conversões perdidas (matched ou unmatched vão para Meta)
- [ ] CloudWatch dashboards: latency, success rate, DLQ depth

## Riscos & Mitigação

| Risco | Impacto | Mitigação |
|-------|---------|-----------|
| **Meta API downtime** | Conversões acumulam em SQS, não chegam ao Meta | Circuit breaker detecta 5+ falhas, pausa envios por 60s, enfileira manualmente |
| **Token expiração** | Todas as requisições falham com 401 | Refresh token 24h antes de expiração; alertar via CloudWatch se token < 24h para vencer |
| **Alta latência de retry** | Conversão atrasada no Meta (ex: 30+ segundos) | Monitor p99 latency, alert se > 5s; implementar timeout 3s por requisição |
| **DLQ acumula eventos** | Manual investigation burden | Setup CloudWatch alarm: DLQ depth > 100; runbook para diagnosis |
| **Dedup failure** | Duplicatas enviadas ao Meta (múltiplas charges) | Unique constraint (tenantId, gateway, gatewayEventId) + idempotency key no Meta |

## Definição de Pronto

- Worker SQS respondendo em produção
- 1º conversão real indo para Meta com sucesso
- Métricas de sucesso visíveis em CloudWatch
- On-call runbook para DLQ troubleshooting
- Deployment automático via GitHub Actions

## Dev Notes

**Phase 1 Implementation Decisions:**
- MetaCapiClient: Direct axios integration with built-in exponential backoff (1s→2s→4s→8s→16s)
- CircuitBreaker: Standalone utility using state machine pattern (CLOSED→OPEN→HALF_OPEN→CLOSED)
- Retry logic: Recursive implementation in sendEvent() with automatic DispatchAttempt logging
- SQS Worker: Deferred to Phase 2 due to AWS infrastructure dependency
- DispatchAttempt schema: Already exists from Story 008 schema migration

**Key Decisions (from original spec):**
- Using axios over native fetch for better error handling and interceptor support
- Meta token stored in AWS Secrets Manager (never hardcoded in env)
- Conversion dedup via unique constraint (tenantId, gateway, gatewayEventId)
- DLQ investigação manual (não re-try automaticamente)

**Architecture Diagram:**
```
Conversion in PostgreSQL
         ↓
    Enqueue to SQS capi-dispatch
         ↓
 Worker: Read event
         ↓
  Build CAPI payload (15 params, all hashed)
         ↓
  Call Meta /events endpoint
         ↓
  Success? → Log DispatchAttempt(status=success)
      ↓
     No → Retry logic
           Attempt < 5? → Exponential backoff, re-enqueue
           Attempt >= 5? → Send to DLQ
                           Log DispatchAttempt(status=failed)
```

## File List

**Phase 1 (COMPLETE):**
- [x] `apps/api/src/services/meta-capi-client.ts` — Meta CAPI v21 client with retry logic (exponential backoff)
- [x] `apps/api/src/lib/circuit-breaker.ts` — Circuit breaker utility (CLOSED/OPEN/HALF_OPEN states)
- [x] `apps/api/src/services/meta-capi-client.test.ts` — Client tests (7 tests: payload building, validation)
- [x] `apps/api/src/lib/circuit-breaker.test.ts` — Circuit breaker tests (10 tests: state transitions, metrics)

**Phase 2 (COMPLETE):**
- [x] `apps/api/src/workers/capi-dispatch-worker.ts` — SQS consumer + Meta API calls (300+ lines, full implementation)
- [x] `apps/api/src/workers/capi-dispatch-worker.test.ts` — Worker integration tests (8 tests covering init, metrics, circuit breaker, lifecycle)
- [x] `infra/terraform/sqs.tf` — SQS queue + DLQ infrastructure (@devops responsibility)
- [x] `.env.example` — Add META_CAPI_APP_ID, META_CAPI_TOKEN placeholders

**Phase 2b Infrastructure Files (Created by @devops):**
- [x] `infra/PHASE2-SETUP.md` — Documentation with AWS CLI and Terraform implementation paths
- [x] `infra/setup-sqs.sh` — Automated SQS queue creation script
- [x] `infra/IAM-POLICY-REQUIRED.md` — IAM policy documentation with resolution steps
- [x] `.env.local` — Updated with SQS_QUEUE_URL, SQS_DLQ_URL, META_CAPI_SECRET_NAME

**Phase 3 (PENDING):**
- [ ] `docs/CAPI-RUNBOOK.md` — DLQ troubleshooting guide

## Change Log

- 2026-02-21: Story created by @sm, validated by @po (score 9/10)
- 2026-02-21: **Phase 1 COMPLETE** by @dev
  - Created MetaCapiClient service with exponential backoff retry logic (max 5 attempts)
  - Created CircuitBreaker utility with CLOSED/OPEN/HALF_OPEN state machine
  - Added comprehensive unit tests (17 new tests, 60 total passing)
  - All tests passing: `npm test` ✅, Lint clean: `npm run lint` ✅, TypeScript: `npm run typecheck` ✅
- 2026-02-21: **Phase 2 COMPLETE** by @devops
  - Resolved IAM permissions: Attached SQS-SecretsManager-Policy to hub-tracking-deploy user
  - Created SQS primary queue: capi-dispatch (30s visibility timeout, 14-day retention)
  - Created SQS DLQ: capi-dispatch-dlq (RedrivePolicy with maxReceiveCount=5)
  - Created Secrets Manager secret: meta-capi-credentials (placeholder values)
  - Updated .env.local with SQS_QUEUE_URL, SQS_DLQ_URL, META_CAPI_SECRET_NAME
  - Status: AWS infrastructure ready for Phase 3 (SQS Worker implementation by @dev)
- 2026-02-21: **Phase 2b COMPLETE** by @dev (commit: 23f98e5)
  - Created CapiDispatchWorker class (300+ lines) with full SQS polling implementation
  - Key Features:
    * SQS message polling with long polling (10s WaitTimeSeconds)
    * Conversion duplicate detection via composite unique key (tenantId, gateway, gatewayEventId)
    * Meta CAPI payload building with circuit breaker protection
    * Exponential backoff retry logic (1s→2s→4s→8s→16s) integrated from Phase 1
    * DispatchAttempt logging for audit trail with timestamp and status
    * Dead Letter Queue (DLQ) routing on max retries
    * CloudWatch metrics emission (success, failure, DLQ, latency, circuit breaker state)
    * Graceful lifecycle management (start/stop with timeout cleanup)
  - AWS Integration:
    * SQS client for queue operations with long polling
    * Secrets Manager client for CAPI credentials retrieval
    * CloudWatch client for metrics emission
  - Added 8 new comprehensive unit tests covering initialization, metrics, circuit breaker, lifecycle
  - All tests passing: 68 total (8 new + 60 existing) ✅
  - Lint clean, TypeScript strict mode passing ✅
  - Installed AWS SDK dependencies: @aws-sdk/client-secrets-manager, @aws-sdk/client-cloudwatch
  - Status: Ready for Phase 3 (load testing + E2E)
