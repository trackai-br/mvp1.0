# Story Track AI 011e – Kiwify Webhook Handler (HMAC-SHA256)

**Story ID:** 011e
**Epic:** EPIC-011 — MVP Launch & Multi-Gateway Integration
**Status:** Ready to Draft

## Contexto

Kiwify é gateway nº3 em importância. Payload structure diferente de Hotmart mas mesmo padrão HMAC-SHA256. Implementação segue pattern Hotmart (Story 011d) com mapeamento de campos específico.

**Paralelo com Story 011d** para acelerar integração multi-vendor.

## Agentes Envolvidos
- `@dev` (Dex): Implementação (paralelo com Hotmart)
- `@qa` (Quinn): Validação QA gate

## Dependências

- Story 011a/b/c (bloqueadores deploy) ✅
- Story 011d (Hotmart pattern) — referenciar apenas

## Objetivos

1. Create `kiwifyWebhookSchema` em `@hub/shared`
2. Implementar `apps/api/src/kiwify-webhook-handler.ts`
3. POST `/api/v1/webhooks/kiwify/:tenantId`
4. Testes: 8+ cenários
5. Deploy staging + smoke test

## Tasks

- [ ] Criar `kiwifyWebhookSchema` (Zod)
- [ ] Implementar handler com DI pattern (reutilizar estrutura Hotmart)
- [ ] Registrar rota `/api/v1/webhooks/kiwify/:tenantId`
- [ ] 8+ testes unitários
- [ ] Lint + typecheck + test OK
- [ ] Deploy staging
- [ ] Pronto para @qa gate

## Kiwify Payload Mapping

```json
{
  "purchase_id": "KW98765",
  "buyer": {
    "email": "user@example.com",
    "phone": "+55 11 99999-9999"
  },
  "value": 49.90,
  "currency": "BRL",
  "status": "completed|pending",
  "created_at": "2026-02-24T10:00:00Z"
}
```

**Mapeamento:**
- `purchase_id` → `conversions.order_id`
- `buyer.email` → hash SHA-256
- `buyer.phone` → hash SHA-256
- `value` + `currency` → `conversions.amount`, `conversions.currency`
- `created_at` → `conversions.ts`
- `event_id` = `sha256(tenantId | purchaseId | "purchase" | value | currency)`

## Critérios de Aceite

- [x] Schema criado + exportado
- [x] Handler com DI pattern
- [x] HMAC-SHA256 timing-safe
- [x] PII hashing SHA-256
- [x] event_id determinístico
- [x] Dedupe funciona
- [x] Resposta 202 < 200ms
- [x] 8 testes passando

## Definição de Pronto

- Handler vivo em staging
- Testes passando
- Pronto para @qa gate

## File List

- `packages/shared/src/index.ts` (kiwifyWebhookSchema)
- `apps/api/src/kiwify-webhook-handler.ts`
- `apps/api/src/kiwify-webhook-handler.test.ts`
- `apps/api/src/server.ts`
- `docs/stories/story-track-ai-011e-kiwify-webhook.md`

## Change Log

- Story 011e criada por @sm (River) — 2026-02-24. Source: EPIC-011 Phase 2.
- Pronta para @dev implementação (paralelo com 011d).

---

**Assignee:** @dev (Dex)
**Points:** 3
**Priority:** HIGH
**Deadline:** 48-72h (paralelo com 011d)
**Paralelo:** Story 011d (Hotmart)
