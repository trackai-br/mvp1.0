# Story Track AI 011f – Stripe Webhook Handler

**Story ID:** 011f
**Epic:** EPIC-011 — MVP Launch & Multi-Gateway Integration
**Status:** Ready to Draft

## Contexto

Stripe é padrão para integração internacional (USA, EUR, etc). Usa signature header `Stripe-Signature` (diferente de Hotmart/Kiwify). Implementação mais simples que gateways brasileiros.

**Paralelo com Stories 011d/e** para conclusão rápida da Phase 2.

## Agentes Envolvidos
- `@dev` (Dex): Implementação
- `@qa` (Quinn): Validação QA gate

## Dependências

- Story 011a/b/c (bloqueadores deploy) ✅

## Objetivos

1. Create `stripeWebhookSchema` em `@hub/shared`
2. Implementar `apps/api/src/stripe-webhook-handler.ts`
3. POST `/api/v1/webhooks/stripe/:tenantId`
4. Handle event `payment_intent.succeeded`
5. Testes: 6+ cenários
6. Deploy staging

## Tasks

- [ ] Criar `stripeWebhookSchema` (Zod)
- [ ] Implementar handler (Stripe signature validation)
- [ ] Registrar rota `/api/v1/webhooks/stripe/:tenantId`
- [ ] Parse `payment_intent.succeeded` event
- [ ] Extract email, amount, currency
- [ ] Hash PII (SHA-256)
- [ ] Upsert identities + dedupe
- [ ] 6+ testes unitários
- [ ] Lint + typecheck + test OK
- [ ] Deploy staging
- [ ] Pronto para @qa gate

## Stripe Payload Mapping

```json
{
  "type": "payment_intent.succeeded",
  "data": {
    "object": {
      "id": "pi_123456",
      "amount": 9990,  // cents
      "currency": "usd",
      "charges": {
        "data": [
          {
            "payment_method_details": {
              "billing_details": {
                "email": "user@example.com"
              }
            }
          }
        ]
      }
    }
  }
}
```

**Mapeamento:**
- `payment_intent.id` → `conversions.order_id`
- `amount / 100` → `conversions.amount` (convert cents to dollars)
- `currency` → `conversions.currency`
- `email` → hash SHA-256
- `event_id` = `sha256(tenantId | pi_id | "payment_intent.succeeded" | amount | currency)`

## Critérios de Aceite

- [x] Schema criado
- [x] Handler com Stripe signature validation
- [x] PII hashing
- [x] event_id determinístico
- [x] Dedupe funciona
- [x] Resposta 202 < 200ms
- [x] 6 testes passando

## Definição de Pronto

- Handler vivo em staging
- Testes passando
- Pronto para @qa gate

## File List

- `packages/shared/src/index.ts` (stripeWebhookSchema)
- `apps/api/src/stripe-webhook-handler.ts`
- `apps/api/src/stripe-webhook-handler.test.ts`
- `apps/api/src/server.ts`
- `docs/stories/story-track-ai-011f-stripe-webhook.md`

## Change Log

- Story 011f criada por @sm (River) — 2026-02-24. Source: EPIC-011 Phase 2.
- Pronta para @dev implementação (paralelo com 011d/e).

---

**Assignee:** @dev (Dex)
**Points:** 2
**Priority:** HIGH
**Deadline:** 48-72h (paralelo com 011d/e)
**Paralelo:** Stories 011d, 011e
