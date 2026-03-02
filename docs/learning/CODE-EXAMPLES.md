# Exemplos de Código Real — Como o Sistema Funciona

Este documento mostra código **exatamente como está** no seu projeto, explicado em linguagem leiga.

---

## 1. Frontend: Enviando os 14 Parâmetros

### 1.1 Código HTML/JS na Landing Page

```html
<!-- Este código roda no NAVEGADOR do cliente -->
<script>
  // Quando alguém clica em um anúncio do Meta, Facebook adiciona fbclid na URL
  // Exemplo: https://seu-site.com/?fbclid=abc123&utm_source=facebook&utm_campaign=black_friday

  // 1. Extrair parâmetros da URL
  const urlParams = new URLSearchParams(window.location.search);

  const fbclid = urlParams.get('fbclid');           // Parâmetro 1: Facebook Click ID
  const utm_source = urlParams.get('utm_source');   // Parâmetro 4: Fonte do tráfego
  const utm_medium = urlParams.get('utm_medium');   // Parâmetro 5: Tipo (CPC, email, etc)
  const utm_campaign = urlParams.get('utm_campaign');// Parâmetro 6: Nome da campanha

  // 2. Obter dados do Meta Pixel (já instalado)
  const fbp = fbq.getPixelId();  // Parâmetro 2: Facebook Pixel ID
  const fbc = getCookie('_fbc'); // Parâmetro 3: Facebook Container ID

  // 3. Obter dados do navegador
  const userAgent = navigator.userAgent;  // Parâmetro 10: Browser info
  const url = window.location.href;       // Parâmetro 11: Página atual
  const referrer = document.referrer;     // Parâmetro 12: De onde veio

  // 4. Montar payload com os 14 parâmetros
  const payload = {
    // Facebook tracking (3 params)
    fbclid: fbclid,           // ← Parâmetro 1
    fbp: fbp,                 // ← Parâmetro 2
    fbc: fbc,                 // ← Parâmetro 3

    // Campanha (5 params)
    utm_source: utm_source,   // ← Parâmetro 4
    utm_medium: utm_medium,   // ← Parâmetro 5
    utm_campaign: utm_campaign, // ← Parâmetro 6
    utm_content: urlParams.get('utm_content'),  // ← Parâmetro 7
    utm_term: urlParams.get('utm_term'),        // ← Parâmetro 8

    // Dispositivo (2 params)
    userAgent: userAgent,     // ← Parâmetro 10
    // IP é obtido pelo servidor (não pelo JS por segurança)

    // Página (2 params)
    url: url,                 // ← Parâmetro 11
    referrer: referrer,       // ← Parâmetro 12

    // Dados customizados (2 params)
    productId: document.querySelector('[data-product-id]')?.dataset.productId,
    customValue: 'landing-page-hero'
  };

  // 5. Enviar para seu backend
  fetch('https://seu-dominio.com/api/v1/track/click', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  })
    .then(res => res.json())
    .then(data => console.log('✓ Click rastreado:', data.id))
    .catch(err => console.error('✗ Erro:', err));
</script>
```

### 1.2 O que cada parâmetro representa?

```
fbclid = "abc123xyz789..."
├─ Criado pelo: Meta (Facebook Ads)
├─ Significado: "Este clique é do anúncio X"
├─ Vive em: URL da página
└─ Importância: CRÍTICA (permite matching perfeito)

utm_source = "facebook"
├─ Criado pelo: Você (na sua campanha)
├─ Significado: "Este clique veio do Facebook"
├─ Vive em: URL da página
└─ Importância: Analytics (saber que ROI do Facebook)

userAgent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64)..."
├─ Criado pelo: Browser do usuário
├─ Significado: "Usuário está em Windows, Chrome, 64-bit"
├─ Vive em: Header HTTP
└─ Importância: Média (ajuda matching por device)

url = "https://seu-site.com/checkout?produto=sapato"
├─ Criado pelo: Servidor (naturalmente)
├─ Significado: "Usuário está na página de checkout"
├─ Vive em: Location do navegador
└─ Importância: Alta (saber em qual página converteu)
```

---

## 2. Backend: Recebendo e Processando

### 2.1 Click Handler (click-handler.ts)

**O que faz:** Recebe os 14 parâmetros do frontend e armazena no banco.

```typescript
// apps/api/src/click-handler.ts

import type { ClickIngestInput } from '@hub/shared';
import { prisma } from './db.js';

// Interface com tipos dos parâmetros esperados
export type ClickHandlerDeps = {
  findTenant?: (id: string) => Promise<{ id: string } | null>;
  createClick?: (data: {
    tenantId: string;
    fbclid?: string;       // Parâmetro 1
    fbc?: string;          // Parâmetro 3
    fbp?: string;          // Parâmetro 2
    utmSource?: string;    // Parâmetro 4
    utmMedium?: string;    // Parâmetro 5
    utmCampaign?: string;  // Parâmetro 6
    ip?: string;           // Parâmetro 9
    userAgent?: string;    // Parâmetro 10
  }) => Promise<{ id: string }>;
};

// Função principal: recebe os 14 parâmetros
export async function handleClickIngest(
  tenantId: string,                          // Qual cliente
  body: ClickIngestInput,                    // Os parâmetros do frontend
  request: { ip?: string; headers: Record<string, string | string[] | undefined> },
  deps: ClickHandlerDeps = {}                // Dependências para testes
): Promise<{ id: string } | { error: 'tenant_not_found' }> {
  // 1. Verificar se tenant existe
  const findTenant = deps.findTenant ?? ((id) => prisma.tenant.findUnique({ where: { id } }));
  const createClick = deps.createClick ?? ((data) => prisma.click.create({ data }));

  const tenant = await findTenant(tenantId);
  if (!tenant) {
    return { error: 'tenant_not_found' };  // Cliente não existe
  }

  // 2. Extrair IP e User-Agent do request HTTP
  const userAgent = request.headers['user-agent'];
  const ip = request.ip ?? (request.headers['x-forwarded-for'] as string | undefined);

  // 3. Armazenar no banco de dados (Prisma)
  const click = await createClick({
    tenantId: tenant.id,
    fbclid: body.fbclid,           // ← Parâmetro 1
    fbc: body.fbc,                 // ← Parâmetro 3
    fbp: body.fbp,                 // ← Parâmetro 2
    utmSource: body.utmSource,     // ← Parâmetro 4
    utmMedium: body.utmMedium,     // ← Parâmetro 5
    utmCampaign: body.utmCampaign, // ← Parâmetro 6
    ip,                            // ← Parâmetro 9
    userAgent: Array.isArray(userAgent) ? userAgent[0] : userAgent, // ← Parâmetro 10
  });

  // 4. Retornar ID do click criado (200 OK)
  return { id: click.id };
}
```

**O que acontece aqui, em leigo:**

1. Cliente frontend envia payload JSON com 14 parâmetros
2. Você extrai o `tenantId` da URL: `/track/click/{tenantId}`
3. Verifica se esse cliente existe no banco
4. Coleta IP e User-Agent que o navegador enviou
5. Armazena tudo na tabela `Click`
6. Retorna `{ id: "click_abc123" }` (confirmação)
7. Tudo isso leva ~50ms

---

### 2.2 Validação com Zod (packages/shared/src/index.ts)

**O que faz:** Valida se os 14 parâmetros têm formato correto (tipo, tamanho, etc).

```typescript
// packages/shared/src/index.ts

import { z } from 'zod';  // Biblioteca de validação

// Define schema (regras) para os 14 parâmetros
export const clickIngestSchema = z.object({
  fbclid: z.string().optional(),           // ← Parâmetro 1: string, opcional
  fbc: z.string().optional(),              // ← Parâmetro 3: string, opcional
  fbp: z.string().optional(),              // ← Parâmetro 2: string, opcional
  utmSource: z.string().optional(),        // ← Parâmetro 4: string, opcional
  utmMedium: z.string().optional(),        // ← Parâmetro 5: string, opcional
  utmCampaign: z.string().optional(),      // ← Parâmetro 6: string, opcional
  // Parâmetros 7-12 não estão no Click, mas em Pageview
});

// Este é o tipo TypeScript gerado do schema
export type ClickIngestInput = z.infer<typeof clickIngestSchema>;

// COMO USAR:
const payload = {
  fbclid: "abc123",
  fbp: "fb.1.123456789.123456789",
  utmSource: "facebook"
};

// Validar
try {
  const validated = clickIngestSchema.parse(payload);
  // ✓ Validação passou
} catch (error) {
  // ✗ Validação falhou (ex: fbclid não é string)
  console.error('Erro de validação:', error.errors);
}
```

**Schema para PAGEVIEW (que inclui parâmetros 7-12):**

```typescript
export const pageviewIngestSchema = z.object({
  url: z.string().url(),                   // ← Parâmetro 11: URL válida
  referrer: z.string().url().optional(),   // ← Parâmetro 12: URL válida
  title: z.string().optional(),            // Título da página
  utmSource: z.string().optional(),        // ← Parâmetro 4
  utmMedium: z.string().optional(),        // ← Parâmetro 5
  utmCampaign: z.string().optional(),      // ← Parâmetro 6
  utmContent: z.string().optional(),       // ← Parâmetro 7
  utmTerm: z.string().optional(),          // ← Parâmetro 8
  fbclid: z.string().optional(),           // ← Parâmetro 1
  fbc: z.string().optional(),              // ← Parâmetro 3
  fbp: z.string().optional(),              // ← Parâmetro 2
});
```

**Schema para WEBHOOK (que inclui parâmetros 13-14):**

```typescript
export const perfectPayWebhookSchema = z.object({
  order_id: z.string().min(1),
  customer: z.object({
    // Dados pessoais (para hashing depois)
    email: z.string().optional(),
    phone: z.string().optional(),
    first_name: z.string().optional(),
    // ... mais campos
  }).optional(),
  amount: z.number().optional(),
  currency: z.string().optional(),
  status: z.string().optional(),
  fbc: z.string().optional(),              // ← Parâmetro 3
  fbp: z.string().optional(),              // ← Parâmetro 2
  product_id: z.string().optional(),       // ← Parâmetro 13
  // Parâmetro 14 (customValue) vai em JSON genérico
});
```

---

## 3. Banco de Dados: Armazenando

### 3.1 Tabela Click (prisma/schema.prisma)

```prisma
model Click {
  id        String   @id @default(cuid())  // ID único
  tenantId  String                         // Qual cliente

  // Parâmetros 1-3: Facebook
  fbclid    String?                        // Parâmetro 1
  fbc       String?                        // Parâmetro 3
  fbp       String?                        // Parâmetro 2

  // Parâmetros 4-6: UTM Campaign
  utmSource String?                        // Parâmetro 4
  utmMedium String?                        // Parâmetro 5
  utmCampaign String?                      // Parâmetro 6

  // Parâmetros 9-10: Device
  ip        String?                        // Parâmetro 9
  userAgent String?                        // Parâmetro 10

  // Metadata
  createdAt DateTime @default(now())       // Quando foi clicado

  // Relações
  tenant Tenant @relation(fields: [tenantId], references: [id])
  matchedConversions Conversion[]          // Conversões que vieram deste click

  // Índices (para queries rápidas)
  @@index([tenantId, fbc])                 // Buscar por fbc
  @@index([tenantId, fbclid])              // Buscar por fbclid
}
```

### 3.2 Tabela Conversion (prisma/schema.prisma)

```prisma
model Conversion {
  id              String        @id @default(cuid())
  tenantId        String

  // Dados de compra (do webhook)
  amount          Float?                    // Quanto pagou
  currency        String        @default("BRL")

  // Dados do Meta CAPI (15 hashes + identifiers)
  fbc             String?                   // Parâmetro 3 (do webhook)
  fbp             String?                   // Parâmetro 2 (do webhook)

  // PII HASHED (por LGPD)
  emailHash       String?                   // SHA-256(email)
  phoneHash       String?                   // SHA-256(phone)
  firstNameHash   String?
  lastNameHash    String?
  dateOfBirthHash String?
  cityHash        String?
  stateHash       String?
  countryCode     String?
  zipCodeHash     String?

  // Device (do click relacionado)
  clientIp        String?                   // Parâmetro 9
  userAgent       String?                   // Parâmetro 10

  // MATCHING (qual click originou esta conversão?)
  matchedClickId  String?       @db.Uuid
  matchStrategy   MatchStrategy?            // "fbc", "fbp", "email", "unmatched"

  // Envio ao Meta CAPI
  sentToCAPI      Boolean       @default(false)
  capiResponse    Json?
  capiRequestPayload Json?

  // Timestamps
  createdAt       DateTime      @default(now())
  updatedAt       DateTime      @updatedAt

  // Relações
  tenant          Tenant        @relation(fields: [tenantId], references: [id])
  matchedClick    Click?        @relation(fields: [matchedClickId], references: [id])

  // Índices (para queries rápidas de matching)
  @@unique([tenantId, gateway, gatewayEventId])
  @@index([tenantId, fbc, createdAt(sort: Desc)])  // Buscar por fbc
  @@index([tenantId, fbp, createdAt(sort: Desc)])  // Buscar por fbp
  @@index([tenantId, emailHash, createdAt(sort: Desc)])  // Buscar por email
}

enum MatchStrategy {
  fbc               // Matched por Facebook Container ID
  fbp               // Matched por Facebook Pixel ID
  email             // Matched por email hash
  unmatched         // Não conseguiu fazer matching
}
```

---

## 4. Match Engine: Conectando Clique → Conversão

### 4.1 Código Real (match-engine.ts)

**O que faz:** Procura qual clique originou uma conversão.

```typescript
// apps/api/src/match-engine.ts (simplificado)

export async function matchConversion(
  tenantId: string,
  conversion: {
    fbc?: string;           // Parâmetro 3 do webhook
    fbp?: string;           // Parâmetro 2 do webhook
    emailHash?: string;     // Email da conversão (hashed)
  }
): Promise<{ matchedClickId?: string; strategy: MatchStrategy }> {

  const TIME_WINDOW = 72 * 60 * 60 * 1000; // 72 horas em ms
  const now = new Date();
  const since = new Date(now.getTime() - TIME_WINDOW);

  // ESTRATÉGIA 1: Procurar por FBC (mais preciso)
  // ═════════════════════════════════════════════
  if (conversion.fbc) {
    const click = await prisma.click.findFirst({
      where: {
        tenantId,
        fbc: conversion.fbc,      // ← Parâmetro 3
        createdAt: { gte: since }
      },
      orderBy: { createdAt: 'desc' }
    });

    if (click) {
      // ✓ ENCONTROU! FBC bateu
      return { matchedClickId: click.id, strategy: 'fbc' };
    }
  }

  // ESTRATÉGIA 2: Procurar por FBP (menos preciso que FBC)
  // ════════════════════════════════════════════════════════
  if (conversion.fbp) {
    const click = await prisma.click.findFirst({
      where: {
        tenantId,
        fbp: conversion.fbp,      // ← Parâmetro 2
        createdAt: { gte: since }
      },
      orderBy: { createdAt: 'desc' }
    });

    if (click) {
      // ✓ ENCONTROU! FBP bateu
      return { matchedClickId: click.id, strategy: 'fbp' };
    }
  }

  // ESTRATÉGIA 3: Procurar por EMAIL HASH (determinístico)
  // ═════════════════════════════════════════════════════════
  if (conversion.emailHash) {
    // Primeiro, procurar se temos esse email em Identity
    const identity = await prisma.identity.findFirst({
      where: {
        tenantId,
        emailHash: conversion.emailHash  // ← Email da conversão
      }
    });

    if (identity) {
      // Agora procurar clicks desse email
      const click = await prisma.click.findFirst({
        where: {
          tenantId,
          // Aqui teríamos que fazer JOIN com Identity
          // (simplificado para exemplo)
          createdAt: { gte: since }
        },
        orderBy: { createdAt: 'desc' }
      });

      if (click) {
        // ✓ ENCONTROU! Email bateu
        return { matchedClickId: click.id, strategy: 'email' };
      }
    }
  }

  // ✗ NÃO ENCONTROU EM NENHUMA ESTRATÉGIA
  return { strategy: 'unmatched' };
}
```

**Analogia para entender:**

```
Você recebe uma conversão com:
- fbc: "fb.2.987654"
- fbp: "fb.1.123456"
- email: "joao@email.com"

Match Engine faz:
1. "Procuro um clique com fbc = 'fb.2.987654' nos últimos 3 dias?"
   └─ SIM! Encontrei click_abc123 que veio do anúncio no dia 1

   RETORNA: { matchedClickId: 'click_abc123', strategy: 'fbc' }

Se não encontrasse:
2. "Procuro um clique com fbp = 'fb.1.123456' nos últimos 3 dias?"
3. "Procuro um clique de joao@email.com nos últimos 3 dias?"

E assim sucessivamente até encontrar ou desistir.
```

---

## 5. Webhook Handler: Recebendo de Gateway

### 5.1 Hotmart Webhook (hotmart-webhook-handler.ts)

**O que faz:** Recebe webhook do Hotmart, valida HMAC, extrai parâmetros.

```typescript
// apps/api/src/hotmart-webhook-handler.ts

import { createHmac } from 'crypto';
import { hotmartWebhookSchema } from '@hub/shared';

export async function handleHotmartWebhook(
  tenantId: string,
  body: any,  // Payload do Hotmart
  signature: string  // HMAC do Hotmart
): Promise<{
  status: 'success' | 'error';
  message?: string;
}> {

  // PASSO 1: VALIDAR HMAC (segurança)
  // ═════════════════════════════════════
  const webhookSecret = process.env.HOTMART_WEBHOOK_SECRET;
  const expectedSignature = createHmac('sha256', webhookSecret)
    .update(JSON.stringify(body))
    .digest('hex');

  if (signature !== expectedSignature) {
    // ✗ Assinatura não bate = webhook falso
    return { status: 'error', message: 'Invalid HMAC signature' };
  }

  // PASSO 2: VALIDAR SCHEMA (Zod)
  // ═══════════════════════════════════
  try {
    const validated = hotmartWebhookSchema.parse(body);
    console.log('✓ Webhook validado:', validated);
  } catch (error) {
    return { status: 'error', message: 'Schema validation failed' };
  }

  // PASSO 3: EXTRAIR DADOS DO WEBHOOK
  // ═════════════════════════════════════
  const {
    id: orderId,                          // Hotmart Order ID
    buyer: {
      email,
      phone,
      name,
      birth_date,
      address
    },
    fbc,                                  // ← Parâmetro 3
    fbp,                                  // ← Parâmetro 2
    product: { id: productId },           // ← Parâmetro 13
    amount,
    currency,
    status
  } = validated;

  // PASSO 4: HASH DADOS PESSOAIS (LGPD)
  // ═════════════════════════════════════
  const crypto = require('crypto');

  const emailHash = crypto
    .createHash('sha256')
    .update(email.toLowerCase())
    .digest('hex');

  const phoneHash = crypto
    .createHash('sha256')
    .update(normalizePhone(phone))
    .digest('hex');

  const firstNameHash = crypto
    .createHash('sha256')
    .update(name.split(' ')[0])
    .digest('hex');

  // PASSO 5: ARMAZENAR WEBHOOK RAW (auditoria)
  // ═════════════════════════════════════════════
  const webhookRaw = await prisma.webhookRaw.create({
    data: {
      tenantId,
      gateway: 'hotmart',
      gatewayEventId: orderId,
      rawPayload: body,  // JSON original
      eventType: 'purchase_approved'
    }
  });

  // PASSO 6: CRIAR CONVERSION (sem matching ainda)
  // ═════════════════════════════════════════════════
  const conversion = await prisma.conversion.create({
    data: {
      tenantId,
      webhookRawId: webhookRaw.id,
      gateway: 'hotmart',
      gatewayEventId: orderId,
      amount,
      currency,
      fbc,                                // ← Parâmetro 3
      fbp,                                // ← Parâmetro 2
      emailHash,                          // HASHED
      phoneHash,                          // HASHED
      firstNameHash,                      // HASHED
      sentToCAPI: false
    }
  });

  // PASSO 7: COLOCAR NA FILA DE MATCHING
  // ═══════════════════════════════════════════
  // (Processará depois, assincronamente)
  await sqs.sendMessage({
    QueueUrl: process.env.SQS_MATCH_QUEUE,
    MessageBody: JSON.stringify({
      conversionId: conversion.id,
      tenantId,
      fbc,    // ← Parâmetro 3 para matching
      fbp,    // ← Parâmetro 2 para matching
      emailHash
    })
  });

  // PASSO 8: RESPONDER 200 OK (importante!)
  // ════════════════════════════════════════════
  // Hotmart precisa receber 200 rápido, não espera resultado
  return { status: 'success' };
}
```

**O que é HMAC e por que é importante?**

```
Hotmart quer ter certeza de que foi ELA que enviou o webhook, não um hacker.

PROCESSO:
1. Hotmart pega o payload JSON
2. Hotmart calcula: HMAC = SHA256(JSON + webhookSecret)
3. Hotmart envia: payload + HMAC como header

4. Você recebe: payload + HMAC
5. Você calcula: HMAC_esperado = SHA256(JSON + webhookSecret)
6. Você compara: HMAC_esperado == HMAC_recebido?
   ✓ SIM → É realmente do Hotmart
   ✗ NÃO → Alguém falsificou

Analogia: É como uma assinatura. Só Hotmart conhece o webhookSecret.
```

---

## 6. Envio ao Meta CAPI: Dispatch Engine

### 6.1 Dispatch para Meta CAPI

**O que faz:** Monta payload CAPI com hashes + IDs do Facebook e envia.

```typescript
// apps/api/src/dispatch-engine.ts (simplificado)

export async function dispatchToCAPI(
  conversionId: string,
  tenantId: string
): Promise<{ success: boolean; error?: string }> {

  // PASSO 1: BUSCAR CONVERSION + CLIQUE
  // ════════════════════════════════════
  const conversion = await prisma.conversion.findUnique({
    where: { id: conversionId },
    include: { matchedClick: true }
  });

  if (!conversion) {
    return { success: false, error: 'Conversion not found' };
  }

  // PASSO 2: MONTAR PAYLOAD CAPI
  // ═════════════════════════════════
  const capiPayload = {
    data: [{
      event_name: 'Purchase',
      event_time: Math.floor(new Date() / 1000),
      event_source_url: 'https://seu-site.com/checkout',
      event_source_type: 'website',

      // Dados de conversão
      custom_data: {
        value: conversion.amount,
        currency: conversion.currency,
        content_name: 'Produto comprado'
      },

      // Dados do usuário (14 hashes do Meta CAPI)
      user_data: {
        // Hashes de email/phone (Parâmetros implícitos)
        em: [conversion.emailHash],        // Email hashed
        ph: [conversion.phoneHash],        // Phone hashed

        // Facebook IDs (Parâmetros 2-3 do webhook)
        fbc: conversion.fbc,               // ← Parâmetro 3
        fbp: conversion.fbp,               // ← Parâmetro 2

        // Se temos clique relacionado, adicionar IPs/browsers dele
        client_ip_address: conversion.clientIp,        // Parâmetro 9
        client_user_agent: conversion.userAgent,       // Parâmetro 10
      }
    }],
    access_token: config.META_ACCESS_TOKEN
  };

  // PASSO 3: VALIDAR DEDUPLICAÇÃO
  // ═══════════════════════════════════
  // Gerar event_id estável = mesmo ID no pixel + CAPI
  const eventId = crypto
    .createHash('sha256')
    .update(`${tenantId}|${conversion.gatewayEventId}|purchase`)
    .digest('hex');

  capiPayload.data[0].event_id = eventId;

  // Verificar se já foi enviado
  const existing = await prisma.dedupeRegistry.findUnique({
    where: {
      tenantId_eventId: {
        tenantId,
        eventId
      }
    }
  });

  if (existing) {
    // ✗ Já foi enviado antes = SKIP (idempotente)
    return { success: true };  // Retorna sucesso pra não reprocessar
  }

  // PASSO 4: ENVIAR PARA META CAPI
  // ════════════════════════════════════
  try {
    const response = await fetch(
      `https://graph.facebook.com/v21.0/${config.PIXEL_ID}/events`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(capiPayload)
      }
    );

    const result = await response.json();

    // PASSO 5: REGISTRAR RESULTADO
    // ═════════════════════════════════
    await prisma.conversion.update({
      where: { id: conversionId },
      data: {
        sentToCAPI: true,
        capiResponse: result,
        capiRequestPayload: capiPayload
      }
    });

    // PASSO 6: REGISTRAR NA DEDUPE
    // ═══════════════════════════════════
    await prisma.dedupeRegistry.create({
      data: {
        tenantId,
        eventId
      }
    });

    // ✓ SUCESSO!
    return { success: true };

  } catch (error) {
    // ✗ Erro ao enviar
    console.error('Erro ao enviar para Meta:', error);

    // Registrar tentativa
    await prisma.dispatchAttempt.create({
      data: {
        tenantId,
        eventId,
        attempt: 1,
        status: 'failed',
        error: error.message
      }
    });

    return { success: false, error: error.message };
  }
}
```

**Resumo do que é enviado ao Meta:**

```
Payload para Meta CAPI:
{
  event_name: "Purchase",
  custom_data: {
    value: 99.90,      // Quanto pagou
    currency: "BRL"
  },
  user_data: {
    em: ["abc123..."],         // Email hashed (SHA-256)
    ph: ["789xyz..."],         // Phone hashed (SHA-256)
    fbc: "fb.2.987654...",     // ← Parâmetro 3 (do webhook)
    fbp: "fb.1.123456...",     // ← Parâmetro 2 (do webhook)
    client_ip_address: "192.168.1.1",      // Parâmetro 9 (do clique)
    client_user_agent: "Mozilla/5.0...",   // Parâmetro 10 (do clique)
  },
  event_id: "sha256(...)",     // ID único para dedup
  event_time: 1234567890      // Timestamp
}

IMPORTANTE:
- Email/phone NUNCA são enviados em claro (apenas hashes)
- Facebook IDs (fbc, fbp) são enviados em CLARO (Meta precisa para matching)
- IP e User-Agent também em claro (Meta usa para device matching)
```

---

## 7. Exemplo Completo: Um Clique → Uma Conversão

### 7.1 Timeline do Exemplo

**Hora 10:00:00** - Usuário clica em anúncio do Facebook

```javascript
// Frontend (landing page do usuário)
Browser envia:
POST https://seu-dominio.com/api/v1/track/click

{
  "fbclid": "abc123xyz789",
  "fbp": "fb.1.123456789.987654321",
  "fbc": "fb.2.321654987.123456789",
  "utm_source": "facebook",
  "utm_medium": "cpc",
  "utm_campaign": "black_friday",
  "ip": "192.168.1.100",
  "userAgent": "Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X)"
}

Backend recebe → Valida com Zod → Armazena em Click table
Retorna: { id: "click_abc123" }
⏱️ Latência: 45ms
```

---

**Hora 10:05:30** - Usuário completa compra no Hotmart

```json
Hotmart webhooks você:
POST https://seu-dominio.com/api/v1/webhooks/hotmart

{
  "id": "order_123456",
  "status": "approved",
  "buyer": {
    "email": "joao.silva@email.com",
    "phone": "11999999999",
    "name": "João Silva",
    "birth_date": "1990-01-15",
    "address": {
      "city": "São Paulo",
      "state": "SP",
      "country": "BR",
      "zip_code": "01234567"
    }
  },
  "fbc": "fb.2.321654987.123456789",
  "fbp": "fb.1.123456789.987654321",
  "product": { "id": "sapato-corrida-2024" },
  "amount": 299.90,
  "currency": "BRL"
}

Backend:
1. Valida HMAC-SHA256 ✓
2. Valida schema Zod ✓
3. Hashes:
   - emailHash = sha256("joao.silva@email.com") = "abc123..."
   - phoneHash = sha256("11999999999") = "def456..."
4. Armazena WebhookRaw (auditoria)
5. Cria Conversion (ainda não matched)
6. Coloca na fila de matching

Retorna: 200 OK
⏱️ Latência: 120ms
```

---

**Hora 10:05:35** - Match Engine processa (na fila)

```
Worker processa fila:
1. Busca Conversion (da hora 10:05:30)
2. Executa Match Engine:
   - Procura Click com fbc = "fb.2.321654987.123456789"
   - Encontrou! → matchedClickId = "click_abc123"
   - matchStrategy = "fbc"
3. Atualiza Conversion: matchedClickId = "click_abc123"
4. Coloca na fila de dispatch

⏱️ Latência: 5ms (match foi perfeito, FBC bateu!)
```

---

**Hora 10:05:40** - Dispatch para Meta CAPI (na fila)

```
Worker processa fila:
1. Busca Conversion + Click relacionado
2. Monta payload CAPI com:
   - fbc: "fb.2.321654987.123456789"  ← Parâmetro 3
   - fbp: "fb.1.123456789.987654321"  ← Parâmetro 2
   - emailHash: "abc123..."
   - phoneHash: "def456..."
   - client_ip: "192.168.1.100"       ← Parâmetro 9 (do click)
   - client_user_agent: "Mozilla/5.0..." ← Parâmetro 10 (do click)
3. POST para Meta CAPI
4. Meta responde: 200 OK { "events_received": 1 }
5. Atualiza Conversion: sentToCAPI = true
6. Registra em DedupeRegistry (previne duplicatas)

⏱️ Latência: 240ms (network para Meta + processamento)

TOTAL DE PONTA A PONTA:
10:00:00 (clique)
└─ 10:05:40 (enviado ao Meta)
   = 5 minutos 40 segundos ✓

Meta CAPI é event-driven, não determinístico. Pode levar horas
para fazer matching interno. Mas nós mandamos para ela assim que
conseguimos fazer o match.
```

---

## 8. Estrutura do Projeto

```
apps/api/src/
├── server.ts                    # Router principal (Fastify)
├── db.ts                        # Instância Prisma singleton
├── click-handler.ts             # POST /track/click
├── pageview-handler.ts          # POST /track/pageview
├── checkout-handler.ts          # POST /track/checkout
├── hotmart-webhook-handler.ts   # POST /webhooks/hotmart
├── kiwify-webhook-handler.ts    # POST /webhooks/kiwify
├── stripe-webhook-handler.ts    # POST /webhooks/stripe
├── perfectpay-webhook-handler.ts # POST /webhooks/perfectpay
├── match-engine.ts              # Lógica de matching click → conversion
├── dispatch-engine.ts           # Envia para Meta CAPI
└── jobs/
    ├── match-worker.ts          # Worker de matching (SQS)
    └── dispatch-worker.ts       # Worker de dispatch (SQS)

packages/shared/src/
├── index.ts                     # Schemas Zod (validação)

apps/api/prisma/
├── schema.prisma                # Modelos do banco
└── migrations/                  # Histórico de mudanças

tests/
├── click-handler.test.ts
├── hotmart-webhook-handler.test.ts
└── match-engine.test.ts
```

---

## 9. Como Adicionar Novo Parâmetro (Exemplo Prático)

**Requisito:** Rastrear "versão da landing page"

### Passo 1: Schema Zod

```typescript
// packages/shared/src/index.ts

export const clickIngestSchema = z.object({
  fbclid: z.string().optional(),
  // ... existing fields ...
  lpVersion: z.enum(['v1', 'v2', 'v3']).optional(),  // ← NOVO
});
```

### Passo 2: Migration

```bash
cd apps/api
npx prisma migrate dev --name add_lp_version_to_click
```

Cria:
```sql
ALTER TABLE "Click" ADD COLUMN "lpVersion" TEXT;
```

### Passo 3: Prisma Schema

```prisma
model Click {
  // ... existing fields ...
  lpVersion String?  // ← NOVO
}
```

### Passo 4: Gerar Client

```bash
cd apps/api
npx prisma generate
```

### Passo 5: Handler

```typescript
// click-handler.ts

const click = await createClick({
  // ... existing fields ...
  lpVersion: body.lpVersion,  // ← NOVO
});
```

### Passo 6: Test

```bash
npm run test  # Deve passar
```

### Passo 7: Use em Analytics

```sql
SELECT lpVersion, COUNT(*) as clicks
FROM Click
GROUP BY lpVersion
ORDER BY clicks DESC;

-- Resultado esperado:
-- lpVersion | clicks
-- v2        | 150
-- v1        | 100
-- v3        | 50
```

---

## Glossário de Código

| Termo | Significa |
|-------|-----------|
| **Prisma** | ORM que acessa o banco de dados |
| **Zod** | Biblioteca que valida schemas JSON |
| **HMAC** | Assinatura criptográfica (prova de autenticidade) |
| **SHA-256** | Algoritmo que transforma texto em hash (irreversível) |
| **SQS** | Fila da AWS (armazena jobs para processar depois) |
| **Worker** | Processo que pega jobs da fila e processa |
| **DLQ** | Dead Letter Queue (fila de erros permanentes) |
| **CAPI** | Conversions API do Meta (API server-side) |
| **Dedup** | Deduplicação (evitar duplicatas) |
| **Webhook** | URL que serviço externo chama quando algo acontece |

---

**Próximo passo:** Leia `/docs/learning/TECHNICAL-DEEP-DIVE.md` para entender infraestrutura, custos e como adicionar parâmetros.
