# 📋 Relatório de Revisão Funcional — Story 001 (Setup Wizard)

**Data:** 2026-02-23
**Status Geral:** ⚠️ **INCOMPLETO COM DIVERGÊNCIAS**
**Recomendação:** Cor rigir antes de avançar para Story 005 (PerfectPay webhook)

---

## ✅ O Que FUNCIONA Corretamente

### 1. Backend Endpoints
```
✅ POST /api/v1/setup/sessions         (linha 55, server.ts)
✅ POST /api/v1/setup/sessions/:id/validate (linha 65, server.ts)
✅ GET /api/v1/setup/sessions/:id/status   (linha 79, server.ts)
```
- Todos registrados corretamente
- Validação com Zod schema
- Tratamento de erros estruturado
- HTTP status codes corretos (201, 404, 500)

### 2. Schemas Zod Backend (`packages/shared/src/index.ts`)
✅ `setupSessionCreateSchema` — Completo com validação de:
- projectName (required)
- trackingEnvironment (enum: lp, wpp, telegram)
- landingUrl (URL válida)
- meta (pixelId, accessToken, adAccountId)
- gateway (platform, apiKey, webhookSecret)

✅ `setupSessionStatusSchema` — Retorna estado correto com:
- id, projectName, state, timestamps
- webhook object (provider, path, url, token)
- checks (gatewayCredentials, metaToken, landingProbe)
- issues array

✅ Suporte a **5 gateways** definidos:
```javascript
gatewaySchema = z.enum(['perfectpay', 'hotmart', 'kiwify', 'stripe', 'pagseguro'])
```

### 3. Backend Services
✅ **setup-store.ts** — 3 funções implementadas:
- `createSetupSession()` — Cria novo registro no Prisma
- `getSetupSession()` — Busca sessão por ID
- `saveSetupSession()` — Atualiza estado da sessão

✅ **validation.ts** — Validações:
- PerfectPay credentials validation
- Meta token validation
- Landing page probe (HTTP URL check)
- Geração de issues array com mensagens de erro

### 4. Frontend Wizard (`apps/web/src/app/page.tsx`)
✅ **4 Steps implementados:**
- **Step 1:** Instalar script (ambiente + URL site + detecção automática)
- **Step 2:** Conectar redes de anúncios (Pixel ID, Access Token, Ad Account ID)
- **Step 3:** Conectar integrações (search, add integrations, PerfectPay credentials)
- **Step 4:** Concluído (resultado, webhook URL, issues)

✅ **Componentes:**
- Sidebar com progress indicator (circles: pending/in_progress/complete)
- Form com React Hook Form + Zod validation
- TanStack Query para mutations
- Navigation entre steps (BACK, NEXT buttons)
- Conditional rendering por step

✅ **Data sources listing:**
```javascript
Facebook Pixel, Google Ads, TikTok, Bing, Taboola, Outbrain, GA4 (com upgrade flag)
```

✅ **Integrations listing:**
```javascript
Perfect Pay, Hotmart, Kiwify, Stripe, Shopify (com upgrade flag)
```

### 5. Testes
✅ **validation.test.ts** — 2 testes passando:
- "marks session as validated when all checks pass"
- "marks session for troubleshooting when checks fail"

✅ **Cobertura geral:**
```
Test Files: 14 passed | 1 skipped (15)
Tests:      73 passed | 4 skipped (77)
Duration:   800ms
```

### 6. Code Quality
✅ **Lint:** Clean (sem erros/warnings)
✅ **TypeCheck:** OK (sem erros TypeScript)
✅ **Tests:** 73/73 passing (+ 4 skipped load/e2e)

---

## ⚠️ DIVERGÊNCIAS IDENTIFICADAS

### Divergência 1: Gateway Schema Desincronizado
**Severidade:** 🔴 **CRITICAL**

**Problema:**
- `packages/shared/src/index.ts`: gatewaySchema tem **5 gateways**
  ```javascript
  gatewaySchema = z.enum(['perfectpay', 'hotmart', 'kiwify', 'stripe', 'pagseguro'])
  ```

- `apps/web/src/lib/contracts.ts`: gatewaySchema tem apenas **1 gateway**
  ```javascript
  gatewaySchema = z.enum(['perfectpay'])
  ```

**Impacto:**
- Frontend pode aceitar apenas 'perfectpay' no formulário
- Backend pode receber 'hotmart', 'kiwify', 'stripe', 'pagseguro' mas frontend não permite selecioná-los
- Violação de contrato cliente-servidor
- Tipo validation fail se tentar usar gateway != 'perfectpay'

**Causa Raiz:**
Frontend está usando arquivo **local** `apps/web/src/lib/contracts.ts` ao invés de importar de `packages/shared`

**Verificação:**
```bash
# Frontend imports:
import { setupSessionCreateSchema, type SetupSessionStatus } from '@/lib/contracts';
                                                               # Local, não de @hub/shared!

# Backend imports:
import { setupSessionCreateSchema, type SetupSessionStatus } from '@hub/shared';
                                                               # Correto, do packages/shared
```

---

### Divergência 2: Gateway Hardcoded no Frontend
**Severidade:** 🟡 **HIGH**

**Problema:**
Line 453 no `apps/web/src/app/page.tsx`:
```javascript
<input type="hidden" {...form.register('gateway.platform')} value="perfectpay" />
```

**Impacto:**
- Usuário **não consegue selecionar** outro gateway (hardcoded)
- Documentação diz "integração de gateway de pagamento" (singular, implica chooser)
- Documentação lista 5 gateways como suportados

**Esperado:**
User deveria selecionar gateway em Step 3, não estar hardcoded

---

### Divergência 3: Falta Import de packages/shared no Frontend
**Severidade:** 🟡 **HIGH**

**Problema:**
`apps/web/src/lib/contracts.ts` é um **arquivo local** que duplica schemas de `packages/shared`

**Verificação:**
```bash
$ head -5 apps/web/src/lib/contracts.ts
import { z } from 'zod';
export const trackingEnvironmentSchema = z.enum(['lp', 'wpp', 'telegram']);
export const gatewaySchema = z.enum(['perfectpay']);  # ← INCOMPLETO

$ head -5 packages/shared/src/index.ts
import { z } from 'zod';
export const trackingEnvironmentSchema = z.enum(['lp', 'wpp', 'telegram']);
export const gatewaySchema = z.enum(['perfectpay', 'hotmart', 'kiwify', 'stripe', 'pagseguro']);  # ← CORRETO
```

**Recomendação:**
Remover `apps/web/src/lib/contracts.ts` e importar de `@hub/shared` como o backend faz

---

## ❓ Perguntas Respondidas

### 1. Os endpoints estão registrados no server.ts?
✅ **SIM** — Todos 3 endpoints registrados corretamente (linhas 55, 65, 79)

### 2. Rodaram os testes com sucesso?
✅ **SIM** — 73 tests passed, 4 skipped. Lint OK, typecheck OK.

### 3. O wizard chega ao Step 4?
✅ **SIM** — Implementado:
```javascript
// Line 473-494 in page.tsx
{step === 4 && result && (
  <div style={{ textAlign: 'center', paddingTop: 60 }}>
    <h1>🎉 Concluido</h1>
    <p>Seu setup inicial foi processado com sucesso.</p>
    // ... mostra webhook URL, issues, etc
  </div>
)}
```

### 4. Schemas Zod existem em packages/shared?
✅ **SIM** — Ambos schemas existem e completos:
- `setupSessionCreateSchema`
- `setupSessionStatusSchema`

### 5. Há divergências entre documentação e implementação?
⚠️ **SIM** — 3 divergências críticas identificadas (veja seção acima)

---

## 📊 Tabela de Status Detalhado

| Componente | Status | Observação |
|-----------|--------|-----------|
| Backend endpoints | ✅ | 3/3 registrados |
| Schemas Zod (backend) | ✅ | Completos, 5 gateways |
| Schemas Zod (frontend local) | ⚠️ | Desincronizado, apenas 1 gateway |
| Frontend wizard UI | ✅ | 4 steps funcionais |
| Setup-store (Prisma) | ✅ | CRUD funcionando |
| Validations | ✅ | 3 checks implementados |
| Tests | ✅ | 73 passed, 4 skipped |
| Lint | ✅ | Clean |
| TypeCheck | ✅ | OK |
| **Gateway Selection** | ❌ | Hardcoded para 'perfectpay' |
| **Schema Sync** | ❌ | Frontend importa local, não @hub/shared |

---

## 🔧 O Que Precisa de Correção

### 1. **[CRITICAL]** Sincronizar Gateway Schemas
**Arquivo:** `apps/web/src/lib/contracts.ts`

**Opção A - Recomendada (Remove duplicação):**
Deletar arquivo local e importar de `@hub/shared`:

```javascript
// apps/web/src/lib/contracts.ts
export {
  setupSessionCreateSchema,
  type SetupSessionCreateInput,
  setupSessionStatusSchema,
  type SetupSessionStatus
} from '@hub/shared';
```

**Opção B - Sincronizar schemas:**
Copiar `gatewaySchema` de `packages/shared/src/index.ts` para local

### 2. **[HIGH]** Permitir Seleção de Gateway
**Arquivo:** `apps/web/src/app/page.tsx` (linha 453)

**De:**
```javascript
<input type="hidden" {...form.register('gateway.platform')} value="perfectpay" />
```

**Para:**
```javascript
<select {...form.register('gateway.platform')}>
  <option value="perfectpay">Perfect Pay</option>
  <option value="hotmart">Hotmart</option>
  <option value="kiwify">Kiwify</option>
  <option value="stripe">Stripe</option>
  <option value="pagseguro">PagSeguro</option>
</select>
```

### 3. **[MEDIUM]** Adicionar Teste para Gateway Selection
**Arquivo:** `apps/web/src/app/page.test.ts`

Adicionar teste que valida seleção de gateway diferente de 'perfectpay'

---

## 📋 Checklist de Correção

```
[ ] 1. Sincronizar Zod schemas entre frontend e backend
[ ] 2. Permitir usuário selecionar gateway em Step 3
[ ] 3. Remover arquivo local contracts.ts ou sincronizar com @hub/shared
[ ] 4. Rodar testes novamente (npm run test)
[ ] 5. Rodar lint novamente (npm run lint)
[ ] 6. Rodar typecheck novamente (npm run typecheck)
[ ] 7. Testar manualmente: selecionar cada gateway no wizard
[ ] 8. Testar validações: tentar enviar gateway desconhecido
[ ] 9. Confirmar que webhook URL muda com gateway selecionado
[ ] 10. Atualizar STORIES_DETAILED.md com status atual
```

---

## 🎯 Recomendação Final

**Status:** ⚠️ **FUNCIONAL MAS INCOMPLETO**

**Recomendação:**
> ❌ **NÃO avançar para Story 005 (PerfectPay webhook) até corrigir as divergências acima.**
>
> As 3 divergências são críticas e causarão problemas quando:
> 1. Usuários tentarem usar gateways além de PerfectPay
> 2. Backend receber gateway != 'perfectpay' do frontend (tipo validation fail)
> 3. Novos devs tentarem adicionar novo gateway (encontrarão 2 schemas diferentes)

**Tempo Estimado para Correção:** 30-60 minutos
- 10 min: Sincronizar schemas
- 15 min: Implementar gateway selector
- 15 min: Testes + lint + typecheck
- 10 min: Teste manual

---

## 📝 Resumo Executivo

### ✅ Completamente Implementado
- 3 endpoints Setup Sessions
- 4 steps do wizard (UI + navegação)
- Validações de PerfectPay, Meta, Landing page
- Persistência em Supabase via Prisma
- Testes passando
- Code quality OK (lint, typecheck)

### ⚠️ Incompleto/Divergente
- Gateway schema desincronizado (frontend vs backend)
- Gateway hardcoded para 'perfectpay' (user não consegue escolher)
- Frontend importa schemas locais ao invés de compartilhados

### 🚫 Bloqueadores
- **Crítico:** Impossível selecion ar gateways além de PerfectPay
- **Crítico:** Tipo contracts divergente entre frontend/backend
- **Médio:** Falta testes para seleção de gateway

---

**Criado:** 2026-02-23
**Revisor:** Claude Code (Haiku 4.5)
**Próxima Ação:** Corrigir divergências, testar, e reportar
