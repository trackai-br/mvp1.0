# 🚀 Plano de Execução Paralela — Stories 007-011 + Staging Deploy

**Decisão:** Trabalhar em paralelo para maximizar produtividade
**Data:** 2026-03-05 22:35 UTC

---

## 📌 Overview

```
┌─────────────────────────────────────┐
│  PHASE 1 STEP 3: ECS Staging        │
│  (Deploy + Smoke Tests)             │
│  ⏱️ 2-3 horas (paralelo)            │
│  @devops (Gage)                     │
└─────────────────────────────────────┘
         ⬇ paralelo ⬇

┌─────────────────────────────────────┐
│  STORY 007: Generic Webhook         │
│  (Hotmart, Kiwify, Stripe, PagSeg)  │
│  ⏱️ 4-5 horas                       │
│  @sm → @po → @dev                   │
└─────────────────────────────────────┘
         ⬇ bloqueador ⬇

┌─────────────────────────────────────┐
│  STORY 008: Match Engine            │
│  (Click ↔ Conversion Correlation)   │
│  ⏱️ 5-6 horas                       │
│  @dev (Dex)                         │
└─────────────────────────────────────┘
         ⬇ bloqueador ⬇

┌─────────────────────────────────────┐
│  STORY 009: SQS/BullMQ Dispatch     │
│  (Meta CAPI Integration)            │
│  ⏱️ 4-5 horas                       │
│  @dev                               │
└─────────────────────────────────────┘
         ⬇ bloqueador ⬇

┌─────────────────────────────────────┐
│  STORY 010: Analytics Dashboard     │
│  (Next.js Dashboard + BI)           │
│  ⏱️ 6-8 horas                       │
│  @dev + @ux-design-expert           │
└─────────────────────────────────────┘

┌─────────────────────────────────────┐
│  STORY 011: Replay Engine           │
│  (Retry Failed Conversions)         │
│  ⏱️ 3-4 horas                       │
│  @dev                               │
└─────────────────────────────────────┘

         ⬇ paralelo ⬇

┌─────────────────────────────────────┐
│  PHASE 2: Production Deploy         │
│  (After Stories 007-009 validated)  │
│  ⏱️ 2 horas                         │
│  @devops                            │
└─────────────────────────────────────┘
```

---

## ⏱️ Timeline

### **Timeline A: Staging Deploy (Paralelo)**
```
T0 (22:35)    → Start @devops ECS deploy
T0 + 30 min   → Task definition updated
T0 + 1h       → ECS rolling deployment
T0 + 1.5h     → Smoke tests running
T0 + 2.5h     → COMPLETE ✅
```

**Resultado esperado:** Sistema deployado em staging com baseline de performance

---

### **Timeline B: Stories 007-009 (Sequential)**

#### Story 007: Generic Webhook (4-5h)
```
T1 (22:40)    → @sm cria story 007 + criteria
T1 + 30min    → @po valida story (GO/NO-GO)
T1 + 1h       → @dev inicia implementação
  - Hotmart adapter review + test
  - Kiwify adapter review + test
  - Stripe adapter review + test
  - PagSeguro adapter review + test
  - Webhook router integration
T1 + 4h       → Unit tests passing
T1 + 5h       → E2E test WebhookRaw insertion ✅
```

#### Story 008: Match Engine (5-6h)
```
T2 (T1+5h)    → @dev inicia Story 008
  - FBC matching logic
  - FBP matching logic
  - Email matching logic (com Identity join)
  - PII hashing (SHA-256)
  - MatchLog insertion
  - Indexes optimization
T2 + 3h       → Core logic done
T2 + 5h       → Tests + performance tuning
T2 + 6h       → COMPLETE ✅
```

#### Story 009: Meta CAPI Dispatch (4-5h)
```
T3 (T2+6h)    → @dev inicia Story 009
  - SQS queue setup (ou BullMQ)
  - Payload construction (15 Meta params)
  - Signature generation
  - HTTP request to Meta CAPI
  - Response handling + retry logic
  - DispatchAttempt logging
T3 + 3h       → Core dispatch done
T3 + 4.5h     → Error handling + circuit breaker
T3 + 5h       → COMPLETE ✅
```

---

## 🎯 Marcos Importantes

| Marco | Timeline | Owner | Status |
|-------|----------|-------|--------|
| **Staging Deploy Starts** | T0 | @devops | 🔄 Inicio |
| **Story 007 Draft + Validation** | T1 | @sm/@po | 📋 Next |
| **Story 007 Implementation Starts** | T1 + 1h | @dev | 📋 Next |
| **Story 007 Complete** | T1 + 5h | @dev | 📋 Next |
| **Story 008 Starts** | T2 | @dev | 📋 Next |
| **Story 008 Complete** | T2 + 6h | @dev | 📋 Next |
| **Story 009 Starts** | T3 | @dev | 📋 Next |
| **Story 009 Complete** | T3 + 5h | @dev | 📋 Next |
| **Staging Tests Confirm OK** | T0 + 2.5h | @qa | 🔄 Ongoing |
| **Ready for Production** | T3 + 5h | @all | 📋 Gated |

---

## 📊 Resource Allocation

### **@devops (Gage)**
- **T0 to T0+2.5h:** ECS Staging Deploy
- **T0+2.5h to T3+5h:** Monitoring + fixing issues
- **T3+5h to T3+7h:** PHASE 2 Production Deploy (standby)

### **@sm (River)**
- **T1:** Create Story 007 draft
- **After T1+5h:** Create Story 008 draft (while @dev implements 007)

### **@po (Pax)**
- **T1 + 30min:** Validate Story 007 (GO/NO-GO)
- **Ongoing:** Track story progress

### **@dev (Dex)**
- **T1 + 1h:** Start Story 007 implementation
- **T1 + 5h:** Complete Story 007 → Start Story 008
- **T2 + 6h:** Complete Story 008 → Start Story 009
- **T3 + 5h:** Complete Story 009 (ready for Meta CAPI)

### **@qa**
- **T0 + 2.5h:** Run staging smoke tests
- **T1+5h:** Review Story 007 QA gate
- **T2+6h:** Review Story 008 QA gate
- **T3+5h:** Review Story 009 QA gate
- **Final:** Production readiness check

---

## 🔄 Dependências

```
Staging Deploy (independent)    ✅ Ready
        ⬇
Story 007 (independent)         ✅ Ready (after story draft)
        ⬇
Story 008 (bloqueador: 007)     ⏳ Awaits 007
        ⬇
Story 009 (bloqueador: 008)     ⏳ Awaits 008
        ⬇
PHASE 2 Prod (bloqueador: 009)  ⏳ Awaits 009
```

**Não há dependencies entre Staging Deploy e Stories 007-009** → podem rodar em paralelo sem bloqueios

---

## ✅ Pre-Flight Checklist

Antes de começar, validar:

- [ ] **Staging Deploy:**
  - [ ] AWS credentials fresh (`aws sts get-caller-identity`)
  - [ ] ECR image exists and is latest
  - [ ] Task definition ready (or create new version)
  - [ ] Supabase staging connection string ready

- [ ] **Story 007:**
  - [ ] Webhook secrets for all 4 gateways in `.env.local`
  - [ ] Test payloads prepared (or mock data ready)
  - [ ] Adapter files reviewed for existing code

- [ ] **Story 008:**
  - [ ] Database indexes created (should be auto from schema)
  - [ ] Click test data available (from E2E tests)
  - [ ] Performance baseline tool ready

- [ ] **Story 009:**
  - [ ] Meta CAPI credentials (pixelId, accessToken) ready
  - [ ] SQS queue created (or BullMQ config ready)
  - [ ] Meta rate limits documented

- [ ] **General:**
  - [ ] PROGRESS.md ready for updates
  - [ ] Git branch strategy (main vs feature branches)
  - [ ] Communication channel open

---

## 📝 Documentation Updates

Before starting each story, update these files:

### Story 007
- [ ] `docs/DATA_FLOW_TO_META_CAPI.md` → "STEP 1: Webhook Received" section
- [ ] `apps/api/src/webhooks/README.md` (create if needed) → Adapter usage

### Story 008
- [ ] `docs/DATA_FLOW_TO_META_CAPI.md` → "STEP 2: Matching" section
- [ ] `apps/api/src/match-engine.ts` → Inline comments explaining strategies

### Story 009
- [ ] `docs/DATA_FLOW_TO_META_CAPI.md` → "STEP 3 & 4: Dispatch" section
- [ ] `docs/operations/MODUS_OPERANDI.md` → SQS/BullMQ setup

---

## 🚨 Potential Blockers & Mitigations

| Bloqueador | Probabilidade | Mitigação |
|-----------|--------------|----------|
| Staging deploy fails | Média | Have rollback plan, test locally first |
| Webhook secrets missing | Baixa | Pre-stage all secrets in `.env.local` |
| Match query too slow | Média | Pre-create indexes, run EXPLAIN ANALYZE |
| Meta CAPI auth fails | Baixa | Test credentials before implementation |
| Database locks on indices | Baixa | Run index creation in staging first |

---

## 🎬 Como Começar

### **Imediatamente:**
1. ✅ @devops inicia PHASE 1 STEP 3 (ECS deploy)
2. ✅ @sm começa draft de Story 007

### **Enquanto staging rodar:**
3. @po valida Story 007
4. @dev prepara ambiente para Story 007 impl

### **Depois que Story 007 estiver pronto:**
5. @dev implementa Story 007
6. Enquanto isso, @sm começa Story 008 draft

### **Cascata de stories:**
7. Story 007 → Story 008 → Story 009

---

**Status:** 🟡 READY TO START
**Próximo comando:** Começar PHASE 1 STEP 3 + Story 007 draft