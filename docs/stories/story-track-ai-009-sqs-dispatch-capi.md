# Story Track AI 009 – SQS Dispatch to Meta CAPI (Conversions API)

## Status: Ready

**Approved by @po (Pax)** - 2026-02-21
- Validation Score: 9/10 ✅
- Risks & Mitigation section added
- Ready for @dev implementation

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

- [ ] Criar AWS SQS filas: `capi-dispatch` + `capi-dispatch-dlq`
- [ ] Implementar Meta CAPI v21 client (Node.js + @facebook/business-sdk)
- [ ] Implementar retry logic (exponencial backoff, max 5 tentativas)
- [ ] Implementar circuit breaker (detecta 5+ falhas, pausa 60s)
- [ ] Criar `DispatchAttempt` log (status, error, response)
- [ ] Implementar worker em Node.js async (Bull queue ou SQS consumer)
- [ ] Integrar com CloudWatch para métricas/alarmes
- [ ] Testes unitários (retry logic, circuit breaker, dedup)
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

**Key Decisions:**
- Using Bull queue over raw SQS (cleaner retry/circuit breaker logic)
- Meta token stored in AWS Secrets Manager (never in env)
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

## File List (to be updated)

- [ ] `src/workers/capi-dispatch-worker.ts` — SQS consumer + Meta API calls
- [ ] `src/services/meta-capi-client.ts` — Meta API wrapper with retry logic
- [ ] `src/lib/circuit-breaker.ts` — Circuit breaker utility
- [ ] `src/workers/capi-dispatch-worker.test.ts` — Worker tests
- [ ] `src/services/meta-capi-client.test.ts` — Client tests
- [ ] `infra/terraform/sqs.tf` — SQS queue + DLQ infrastructure
- [ ] `.env.example` — Add META_CAPI_APP_ID, META_CAPI_TOKEN placeholders
- [ ] `docs/CAPI-RUNBOOK.md` — DLQ troubleshooting guide

## Change Log

*To be updated as story progresses*
- 2026-02-21: Story created
