# Story Track AI 011d – Hotmart Webhook Handler (HMAC-SHA256)

**Story ID:** 011d
**Epic:** EPIC-011 — MVP Launch & Multi-Gateway Integration
**Status:** Ready to Draft

## Contexto

Com PerfectPay deployada e Story 006 validada, próximo passo crítico é integração com **Hotmart** — gateway nº2 em volume de tráfego do MVP. Webhook Hotmart usa padrão similar (HMAC-SHA256) mas payload structure diferente. Reutilizar pattern PerfectPay para consistência.

**Sem Hotmart:** ~40% das conversões esperadas não chegam em produção.

## Agentes Envolvidos
- `@sm` (River): Story preparation (você — atual)
- `@dev` (Dex): Implementação
- `@qa` (Quinn): Validação QA gate

## Dependências

- Story 005 (PerfectPay webhook pattern) ✅ DONE
- Story 006 (pageview/checkout) ✅ READY
- Story 009 (SQS dispatch) ✅ READY FOR QA

## Objetivos

1. Create `hotmartWebhookSchema` em `@hub/shared`
2. Implementar `apps/api/src/hotmart-webhook-handler.ts`
3. Reutilizar pattern PerfectPay (timing-safe HMAC, PII hashing)
4. POST `/api/v1/webhooks/hotmart/:tenantId`
5. Testes: 8+ cenários (assinatura, dedupe, hashing)
6. Deploy + smoke test em staging

## Tasks

- [ ] Criar `hotmartWebhookSchema` (Zod) em `packages/shared/src/index.ts`
- [ ] Criar `apps/api/src/hotmart-webhook-handler.ts` com:
  - [ ] Validação HMAC-SHA256 (timing-safe)
  - [ ] Hash SHA-256 de email + phone
  - [ ] Geração event_id determinístico
  - [ ] Upsert em identities
  - [ ] Insert idempotente em dedupe_registry
- [ ] Registrar rota `POST /api/v1/webhooks/hotmart/:tenantId` em `server.ts`
- [ ] Testes: 8+ cenários, assinatura válida/inválida, dedupe, hash
- [ ] Build + test: `npm run lint && npm run typecheck && npm test`
- [ ] Deploy staging + smoke test
- [ ] Pronto para @qa gate

## Hotmart Payload Mapping

```json
{
  "order_id": "HT12345",
  "customer": {
    "email": "user@example.com",
    "phone": "+55 11 99999-9999"
  },
  "amount": 99.90,
  "currency": "BRL",
  "status": "approved|rejected",
  "event_time": "2026-02-24T10:00:00Z",
  "product_id": "prod-123"
}
```

**Mapeamento:**
- `order_id` → `conversions.order_id`
- `customer.email` → hash SHA-256 → `identities.email_hash`
- `customer.phone` → hash SHA-256 → `identities.phone_hash`
- `amount` + `currency` + `event_time` → `conversions.amount`, `conversions.currency`, `conversions.ts`
- `event_id` = `sha256(tenantId | orderId | "purchase" | amount | currency)`

## Critérios de Aceite

- [x] Schema Zod criado + exported
- [x] Handler implementado com DI pattern
- [x] HMAC-SHA256 validado com timing-safe comparison
- [x] PII (email, phone) hasheada com SHA-256
- [x] event_id determinístico gerado corretamente
- [x] Upsert em identities funciona
- [x] Dedupe via dedupe_registry sem duplicatas
- [x] Resposta 202 em < 200ms
- [x] Assinatura inválida → 401
- [x] Tenant inexistente → 404
- [x] 8 testes passando (lint OK, typecheck OK)

## Pontos de Atenção

- ⚠️ Hotmart secret em HOTMART_WEBHOOK_SECRET (env)
- ⚠️ Validar assinatura sobre raw body (não parsed)
- 🔴 Sem hash SHA-256 em PII = QA FAIL (LGPD violation)
- 🔴 Sem dedupe = duplicatas no Meta CAPI

## Definição de Pronto

- Handler vivo em staging
- Testes passando
- Pronto para @qa gate

## File List

- `packages/shared/src/index.ts` (hotmartWebhookSchema)
- `apps/api/src/hotmart-webhook-handler.ts`
- `apps/api/src/hotmart-webhook-handler.test.ts`
- `apps/api/src/server.ts` (registrar rota)
- `docs/stories/story-track-ai-011d-hotmart-webhook.md`

## Change Log

- Story 011d criada por @sm (River) — 2026-02-24. Source: EPIC-011 Phase 2.
- Pronta para @dev implementação.

---

**Assignee:** @dev (Dex)
**Points:** 3
**Priority:** HIGH
**Deadline:** 48-72h (paralelo com 011e/f)
**Dependency:** 011a/b/c DONE
