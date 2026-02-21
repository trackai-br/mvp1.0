# Story Track AI 007 – Generic Webhook Receiver

## Status: Draft

## Contexto

Com os três eventos principais do funnel rastreados (Click, Pageview, Checkout), o próximo passo é **capturar eventos de pagamento confirmado** de múltiplos gateways. Atualmente, temos suporte apenas a PerfectPay (Story 005). Precisamos estender para:

- **Hotmart** (maior plataforma de cursos online no Brasil)
- **Kiwify** (plataforma de vendas SaaS)
- **Stripe** (processador de pagamentos global)
- **PagSeguro** (processador de pagamentos brasileiro)

Cada gateway tem:
- Formato de webhook diferente
- Assinatura de segurança diferente (HMAC key, algoritmo)
- Status codes diferentes ("approved", "confirmed", "completed", etc.)

## Agentes envolvidos

- `@architect`: definir pattern genérico para handlers
- `@dev`: implementar handlers específicos para cada gateway
- `@qa`: validar segurança (HMAC, deduplicação, rate limit)

## Objetivos

1. **Factory pattern**: criar sistema que roteie webhooks para o handler correto baseado no gateway
2. **Adapter pattern**: cada gateway tem um adapter que normaliza dados para formato interno
3. **Segurança**: validar HMAC de cada gateway diferentemente
4. **Persistência**: salvar raw webhook + eventos parseados para auditoria
5. **Deduplicação**: evitar processar o mesmo pagamento 2x (mesmo com retries)

## Tasks

- [ ] Desenhar arquitetura genérica (factory + adapters) com @architect
- [ ] Criar schemas Zod para cada gateway (`hotmartWebhookSchema`, `kiwifyWebhookSchema`, etc.)
- [ ] Implementar router genérico `POST /api/v1/webhooks/:gateway/:tenantId`
- [ ] Criar adapter para Hotmart (converter para formato interno)
- [ ] Criar adapter para Kiwify
- [ ] Criar adapter para Stripe
- [ ] Criar adapter para PagSeguro
- [ ] Adicionar testes unitários para cada adapter
- [ ] Validar deduplicação com event IDs únicos
- [ ] Testar com webhooks reais (ou simulados)

## Critérios de aceite

- [ ] Router `POST /api/v1/webhooks/hotmart/:tenantId` valida HMAC Hotmart corretamente
- [ ] Router `POST /api/v1/webhooks/kiwify/:tenantId` valida HMAC Kiwify
- [ ] Router `POST /api/v1/webhooks/stripe/:tenantId` valida assinatura Stripe
- [ ] Router `POST /api/v1/webhooks/pagseguro/:tenantId` valida assinatura PagSeguro
- [ ] Dados são normalizados: `{ tenantId, eventId, status, amount, currency, timestamp }`
- [ ] Deduplicação funciona: mesmo webhook 2x → processado 1x (idempotent)
- [ ] Todas as assinaturas verificadas com timing-safe comparison
- [ ] 100% testes passando (lint, typecheck, unit tests)
- [ ] Implementação ready para validação por @po

## Pontos de atenção

⚠️ **Cada gateway usa HMAC diferente:**
- **PerfectPay**: SHA-256 (já implementado)
- **Hotmart**: SHA-256, mas chave diferente
- **Kiwify**: SHA-256 com algoritmo ligeiramente diferente
- **Stripe**: HMAC-SHA256 com header signature padrão
- **PagSeguro**: X-PagSeguro-Signature (formato XML, não JSON)

⚠️ **Status codes variam:**
- Hotmart: `approved`, `processing`, `refunded`
- Kiwify: `confirmed`, `completed`, `cancelled`
- Stripe: `payment_intent.succeeded`, `charge.succeeded`
- PagSeguro: `PAGTO` (pagamento) vs `DEVOLVIDO` (reembolso)

⚠️ **Deduplicação complexa:**
- Cada gateway pode reenviar o webhook 3-5x em case de erro
- Precisamos garantir que idempotência sem duplicar no banco

## Definição de pronto

- Todos os 4 gateways rodando localmente
- Webhooks reais ou simulados sendo recebidos e parseados corretamente
- Testes cobrindo HMAC inválido, status desconhecido, deduplicação
- Documentação de como adicionar novo gateway no futuro

## File List

- `packages/shared/src/index.ts` (add 4 schemas)
- `apps/api/src/webhooks/` (novo diretório)
  - `webhook-router.ts` (factory pattern)
  - `hotmart-adapter.ts`
  - `hotmart-adapter.test.ts`
  - `kiwify-adapter.ts`
  - `kiwify-adapter.test.ts`
  - `stripe-adapter.ts`
  - `stripe-adapter.test.ts`
  - `pagseguro-adapter.ts`
  - `pagseguro-adapter.test.ts`
- `apps/api/src/server.ts` (add route)

## Change Log

- Story criada por @dev (Dex) como scaffold — 2026-02-21. Awaiting @sm refinement.

---

## Notas Técnicas (para @architect)

### Pattern Proposto: Factory + Adapter

```typescript
// Factory decide qual adapter usar
function getWebhookAdapter(gateway: string): WebhookAdapter {
  switch (gateway) {
    case 'hotmart': return new HotmartAdapter();
    case 'kiwify': return new KiwifyAdapter();
    case 'stripe': return new StripeAdapter();
    case 'pagseguro': return new PagSeguroAdapter();
    default: throw new Error(`Unknown gateway: ${gateway}`);
  }
}

// Cada adapter implementa interface comum
interface WebhookAdapter {
  validateSignature(rawBody: string, signature: string, secret: string): boolean;
  parseEvent(body: unknown): NormalizedEvent;
}

// Router usa factory
app.post('/api/v1/webhooks/:gateway/:tenantId', async (req, reply) => {
  const adapter = getWebhookAdapter(req.params.gateway);
  adapter.validateSignature(req.rawBody, req.headers['signature'], secret);
  const event = adapter.parseEvent(req.body);
  // ... persistir e processar
});
```

### Trade-offs Considerados

| Opção | Prós | Contras |
|-------|------|---------|
| Factory + Adapter | Escalável, cada gateway isolado | Mais arquivos, mais complexo |
| Conditional if-else | Simples, poucos arquivos | Difícil de manter, cresce demais |
| Metaprogramming | Dinâmico, genérico | Difícil de debugar, tipo-unsafety |

**Recomendação:** Factory + Adapter (escalável).

---

## Referências Externas

- [Hotmart Webhooks Documentation](https://developers.hotmart.com/)
- [Kiwify Webhooks Documentation](https://docs.kiwify.com.br/)
- [Stripe Webhooks Security](https://stripe.com/docs/webhooks/signatures)
- [PagSeguro Webhook Format](https://dev.pagseguro.uol.com.br/)

