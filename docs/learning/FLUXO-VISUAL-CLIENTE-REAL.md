# Fluxo Visual Completo — Um Cliente Real Usando Seu Sistema

> Este documento mostra **passo a passo** o que acontece quando um cliente usa seu Hub Server-Side Tracking, com diagramas ASCII.

---

## 0. Setup Inicial (Onboarding)

```
┌─────────────────────────────────────────────────────────────────┐
│                    NOVO CLIENTE CHEGANDO                        │
└─────────────────────────────────────────────────────────────────┘

1. Cliente acessa seu dashboard em: https://seu-hub-tracking.com

2. Faz signup:
   - Email: vendedor@ecommerce.com
   - Nome da empresa: "Cursos ABC"
   - Plano: "Growth" (até 100k eventos/mês)

3. Sistema cria um "Tenant":
   - tenant_id = "cursos-abc-2026"
   - Status = "provisioning"
   - Recebe webhook_secret para validar webhooks

4. Dashboard mostra setup wizard:
   ┌────────────────────────────────────┐
   │  Passo 1: Instalação (3 passos)   │
   ├────────────────────────────────────┤
   │ □ Copiar tracking pixel JavaScript │
   │ □ Validar webhook do PerfectPay   │
   │ □ Fazer teste de conversão        │
   └────────────────────────────────────┘

5. Cliente copia snippet JavaScript do site dele:

   <script>
     const trackingPixel = {
       tenantId: "cursos-abc-2026",
       serverUrl: "https://seu-api.com"
     };

     // Quando usuário clica no anúncio
     window.onload = () => {
       fetch(trackingPixel.serverUrl + "/api/v1/track/click", {
         method: "POST",
         headers: {
           "x-tenant-id": trackingPixel.tenantId,
           "Content-Type": "application/json"
         },
         body: JSON.stringify({
           fbclid: new URL(location).searchParams.get("fbclid"),
           utmSource: "facebook",
           utmCampaign: "curso-python"
         })
       });
     };
   </script>

6. Cliente configura webhook do PerfectPay:
   URL: https://seu-api.com/api/v1/webhooks/perfectpay/cursos-abc-2026
   Secret: (recebe do seu dashboard)

7. Cliente faz teste clicando em link de teste
   ✅ Seu servidor recebe clique
   ✅ Dashboard mostra "Pixel funcionando!"

8. Status muda para: "active"

```

---

## 1. Dia Real: Um Usuário Clica em um Anúncio

```
┌─────────────────────────────────────────────────────────────────┐
│  FACEBOOK ADS — Anúncio do Cliente                             │
├─────────────────────────────────────────────────────────────────┤
│  Titulo: "Aprenda Python do Zero — 50% OFF"                   │
│  Imagem: [thumbnail do curso]                                  │
│  Público: Homens 18-45, interesse em tecnologia               │
│  Budget: R$ 500/dia                                           │
│                                                                 │
│  Link de destino:                                              │
│  https://cursos-abc.com/python                                │
│    ?utm_source=facebook                                        │
│    &utm_medium=paid                                            │
│    &utm_campaign=curso-python-fevereiro                       │
│    &fbclid=IwAR3n5H2x8L9K1m4Q7r0Js2V5W6Y8Zx1B2Cn3Dp4Fq5Gr6 ←│ Meta coloca automaticamente
│                                                                 │
│  [CLIQUE AQUI] ←── USUÁRIO CLICA                               │
└─────────────────────────────────────────────────────────────────┘
         │
         │ Browser navega para URL acima
         ▼
┌─────────────────────────────────────────────────────────────────┐
│  SITE DO CLIENTE (cursos-abc.com/python)                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  [Landing page com informações do curso]                       │
│                                                                 │
│  <script>  (seu tracking pixel)                                │
│    fetch("/api/v1/track/click", {                             │
│      headers: { "x-tenant-id": "cursos-abc-2026" },          │
│      body: {                                                   │
│        fbclid: "IwAR3n5H2x8L9K1m4Q7r0Js2V5W6Y8Zx1B2Cn3Dp4...",│
│        utmSource: "facebook",                                  │
│        utmCampaign: "curso-python-fevereiro"                 │
│      }                                                         │
│    })                                                          │
│  </script>                                                     │
│                                                                 │
│  [COMPRAR AGORA]  ← botão que usuário vai clicar               │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
         │
         │ JavaScript do tracking pixel executa
         │ FETCH → https://seu-api.com/api/v1/track/click
         ▼
┌─────────────────────────────────────────────────────────────────┐
│  SEU SERVIDOR (Hub Centralizado)                               │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  POST /api/v1/track/click                                     │
│                                                                 │
│  Headers:                                                      │
│    x-tenant-id: cursos-abc-2026                              │
│                                                                 │
│  Body:                                                         │
│  {                                                             │
│    "fbclid": "IwAR3n5H2x8L9K1m4Q7r0Js2V5W6Y8Zx1B2...",      │
│    "utmSource": "facebook",                                    │
│    "utmCampaign": "curso-python-fevereiro",                  │
│    "ip": "201.48.123.45",  (automático)                      │
│    "userAgent": "Mozilla/5.0 Chrome..."  (automático)        │
│  }                                                             │
│                                                                 │
│  1. Validate tenant exists                                     │
│     ✅ cursos-abc-2026 existe e está ativo                    │
│                                                                 │
│  2. Validate schema using Zod                                 │
│     ✅ fbclid presente, formato válido                        │
│                                                                 │
│  3. Save to database (PostgreSQL):                            │
│     INSERT INTO clicks VALUES (                               │
│       id='click-uuid-xyz',                                    │
│       tenant_id='cursos-abc-2026',                            │
│       fbclid='IwAR3n5H2x8L9K1m4...',                         │
│       utm_source='facebook',                                  │
│       utm_campaign='curso-python-fevereiro',                 │
│       ip='201.48.123.45',                                    │
│       user_agent='Mozilla/5.0...',                           │
│       created_at='2026-03-02T14:30:00Z'                      │
│     )                                                         │
│     ✅ Salvo no banco                                         │
│                                                                 │
│  4. Return response:                                          │
│     {                                                         │
│       "ok": true,                                            │
│       "id": "click-uuid-xyz"                                 │
│     }                                                         │
│                                                                 │
│  ⏱️  Tudo levou 147ms (< 200ms target)                        │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
         │
         │ Resposta volta ao browser do usuário
         ▼
┌─────────────────────────────────────────────────────────────────┐
│  DASHBOARD DO CLIENTE                                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Home > Eventos                                               │
│  ┌───────────────────────────────────────────────┐            │
│  │ Cliques de hoje: 47 ✨                       │            │
│  │ Conversões: 8                                 │            │
│  │ Taxa de conversão: 17%                        │            │
│  │ ROI estimado: +240%                           │            │
│  └───────────────────────────────────────────────┘            │
│                                                                 │
│  Últimos cliques:                                            │
│  [14:30] facebook | curso-python | fbclid=IwAR3n5H2x8... ← │
│  [14:28] instagram| curso-python | fbclid=IwAR9w2K1j3...   │
│  [14:25] google  | curso-python | -                         │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘

```

---

## 2. Usuário Vê a Landing Page

```
┌─────────────────────────────────────────────────────────────────┐
│  USUÁRIO NAVEGANDO NO SITE                                    │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Página carregou        Seu servidor recebeu clique           │
│                         ↓                                       │
│  JavaScript            POST /api/v1/track/pageview            │
│  executa:              {                                       │
│                          "tenantId": "cursos-abc-2026",       │
│    fetch("/api/v1/track/pageview", {  "url": "https://...",  │
│      headers: {...},    "title": "Curso Python...",           │
│      body: {            "referrer": "google.com"              │
│        "url": "https://..",                                   │
│        "title": "Curso Python - 50% OFF"                     │
│      }    })           }                                       │
│                                                                 │
│  [Conteúdo da página]                                         │
│  [Seção 1]  ──┐                                               │
│  [Seção 2]  ──┤→ Usuário está lendo                           │
│  [Seção 3]  ──┤→ 2 minutos na página                          │
│  [CTA: COMPRAR AGORA]                                         │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
         │
         │ Seu servidor recebe:
         ▼
┌─────────────────────────────────────────────────────────────────┐
│  SEU SERVIDOR — SALVA PAGEVIEW                                │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  POST /api/v1/track/pageview                                 │
│                                                                 │
│  Body:                                                         │
│  {                                                             │
│    "url": "https://cursos-abc.com/python",                   │
│    "title": "Curso Python - 50% OFF",                        │
│    "referrer": "google.com",                                 │
│    "ip": "201.48.123.45",                                    │
│    "userAgent": "Mozilla/5.0..."                             │
│  }                                                             │
│                                                                 │
│  INSERT INTO pageviews VALUES (                              │
│    id='pageview-uuid-abc',                                   │
│    tenant_id='cursos-abc-2026',                              │
│    url='https://cursos-abc.com/python',                      │
│    title='Curso Python - 50% OFF',                           │
│    referrer='google.com',                                    │
│    ip='201.48.123.45',                                       │
│    created_at='2026-03-02T14:32:30Z'                         │
│  )                                                            │
│                                                                 │
│  ✅ Pageview salva                                            │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────────┐
│  DASHBOARD DO CLIENTE                                          │
├─────────────────────────────────────────────────────────────────┤
│  Pageviews de hoje: 127                                       │
│  Último: [14:32] cursos-abc.com/python                       │
└─────────────────────────────────────────────────────────────────┘

```

---

## 3. Usuário Inicia Checkout

```
┌─────────────────────────────────────────────────────────────────┐
│  USUÁRIO CLICA EM "COMPRAR AGORA"                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  [CTA: COMPRAR AGORA] ← CLIQUE                                 │
│                                                                 │
│  Página de carrinho aparece:                                  │
│                                                                 │
│  ┌─────────────────────────────────┐                          │
│  │ Seu Carrinho                     │                          │
│  ├─────────────────────────────────┤                          │
│  │ Produto: Curso Python            │                          │
│  │ Quantidade: 1                    │                          │
│  │ Preço: R$ 299,90                │                          │
│  │ Desconto (50%): -R$ 149,95      │                          │
│  │ ─────────────────────────────    │                          │
│  │ TOTAL: R$ 149,95                │                          │
│  │                                  │                          │
│  │ [CONFIRMAR PAGAMENTO]            │                          │
│  └─────────────────────────────────┘                          │
│                                                                 │
│  JavaScript executa:                                          │
│                                                                 │
│  fetch("/api/v1/track/initiate_checkout", {                  │
│    body: {                                                    │
│      "cartValue": 149.95,                                    │
│      "currency": "BRL",                                      │
│      "cartItems": [                                          │
│        {                                                      │
│          "productId": "python-course-001",                   │
│          "productName": "Curso Python - Do Zero ao Hero",    │
│          "quantity": 1,                                      │
│          "unitPrice": 149.95                                 │
│        }                                                      │
│      ]                                                        │
│    }                                                          │
│  })                                                           │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
         │
         │ Seu servidor recebe:
         ▼
┌─────────────────────────────────────────────────────────────────┐
│  SEU SERVIDOR — SALVA CHECKOUT                                │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  POST /api/v1/track/initiate_checkout                         │
│                                                                 │
│  INSERT INTO checkouts VALUES (                              │
│    id='checkout-uuid-def',                                   │
│    tenant_id='cursos-abc-2026',                              │
│    cart_value=149.95,                                        │
│    currency='BRL',                                           │
│    cart_items=JSON [{                                        │
│      productId: "python-course-001",                         │
│      productName: "Curso Python...",                         │
│      quantity: 1,                                            │
│      unitPrice: 149.95                                       │
│    }],                                                       │
│    created_at='2026-03-02T14:35:00Z'                         │
│  )                                                            │
│                                                                 │
│  ✅ Checkout registrado                                       │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────────┐
│  DASHBOARD DO CLIENTE                                          │
├─────────────────────────────────────────────────────────────────┤
│  Checkouts iniciados: 12                                      │
│  Valor médio do carrinho: R$ 187,45                           │
│  Taxa checkout/clique: 12/47 = 25,5%                         │
└─────────────────────────────────────────────────────────────────┘

```

---

## 4. Usuário Paga (Gateway PerfectPay)

```
┌─────────────────────────────────────────────────────────────────┐
│  USUÁRIO CONFIRMA PAGAMENTO                                   │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  [CONFIRMAR PAGAMENTO]  ← CLIQUE                               │
│                                                                 │
│  Redireciona para PerfectPay (gateway):                       │
│  https://perfectpay.com/checkout?session=...                 │
│                                                                 │
│  [PerfectPay cobra do cartão de crédito do usuário]          │
│                                                                 │
│  ✅ Pagamento aprovado! (ou ❌ Pagamento recusado)             │
│                                                                 │
│  PerfectPay sabe:                                            │
│    - Pedido foi para cursos-abc.com                          │
│    - Email do cliente: joao@email.com                        │
│    - Telefone: (11) 99999-8888                               │
│    - Valor: R$ 149,95                                        │
│    - ID do pedido: ORDER-2026-03-02-12345                   │
│                                                                 │
│  Agora PerfectPay precisa avisar seu sistema...              │
│  Envia um WEBHOOK para:                                       │
│                                                                 │
│  POST https://seu-api.com/api/v1/webhooks/perfectpay/       │
│          cursos-abc-2026                                     │
│                                                                 │
│  Headers:                                                      │
│    x-perfectpay-signature: hash(secret + body)  ← HMAC-SHA256 │
│                                                                 │
│  Body:                                                         │
│  {                                                             │
│    "eventId": "ORDER-2026-03-02-12345",                      │
│    "eventType": "payment.approved",                           │
│    "email": "joao@email.com",                                │
│    "phone": "(11) 99999-8888",                               │
│    "amount": "149.95",                                       │
│    "currency": "BRL",                                        │
│    "timestamp": "2026-03-02T14:36:30Z",                      │
│    "metadata": {                                              │
│      "product": "Curso Python",                              │
│      "sourceUrl": "cursos-abc.com/python"                    │
│    }                                                          │
│  }                                                             │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
         │
         │ PerfectPay envia POST com HMAC-SHA256
         ▼
┌─────────────────────────────────────────────────────────────────┐
│  SEU SERVIDOR — VALIDA E SALVA CONVERSÃO                      │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  POST /api/v1/webhooks/perfectpay/cursos-abc-2026            │
│                                                                 │
│  1. VALIDAR HMAC-SHA256:                                      │
│     header_signature = "abc123def456..."                      │
│     nossa_signature = HMAC-SHA256(                            │
│       key=webhook_secret,                                     │
│       msg=raw_body                                            │
│     )                                                         │
│                                                                 │
│     Comparação timing-safe:                                   │
│     if (timingSafeEqual(header, nossa)) {                     │
│       ✅ Webhook é legítimo! Vem mesmo de PerfectPay         │
│     } else {                                                  │
│       ❌ Falsa! Rejeita.                                      │
│     }                                                         │
│                                                                 │
│  2. HASH EMAIL E TELEFONE (LGPD):                             │
│     email_hash = SHA-256("joao@email.com") = "a1b2c3d4..."   │
│     phone_hash = SHA-256("(11)99999-8888") = "x9y8z7w6..."   │
│                                                                 │
│     Salvamos hashes, não texto plano ✅                        │
│                                                                 │
│  3. VERIFICAR DUPLICATA:                                      │
│     SELECT * FROM conversions                                 │
│     WHERE event_id = "ORDER-2026-03-02-12345"                │
│                                                                 │
│     ✅ Não existe → pode salvar                               │
│     (Se já existe, retornamos 200 OK silenciosamente)        │
│                                                                 │
│  4. SALVAR CONVERSÃO:                                         │
│     INSERT INTO conversions VALUES (                          │
│       id='conversion-uuid-ghi',                               │
│       tenant_id='cursos-abc-2026',                            │
│       event_id='ORDER-2026-03-02-12345',                      │
│       gateway='perfectpay',                                   │
│       email_hash='a1b2c3d4...',                              │
│       phone_hash='x9y8z7w6...',                              │
│       amount=149.95,                                         │
│       currency='BRL',                                        │
│       status='approved',                                     │
│       created_at='2026-03-02T14:36:30Z'                      │
│     )                                                         │
│                                                                 │
│  5. ENQUEUE PARA MATCH ENGINE:                               │
│     SQS queue "match-events" recebe:                          │
│     {                                                         │
│       "conversationId": "conversion-uuid-ghi",                │
│       "tenantId": "cursos-abc-2026",                          │
│       "type": "perfectpay_conversion"                         │
│     }                                                         │
│                                                                 │
│  6. RETORNAR 200 OK:                                          │
│     { "ok": true, "id": "conversion-uuid-ghi" }              │
│                                                                 │
│  ⏱️ Tudo levou 89ms                                            │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
         │
         │ Resposta volta a PerfectPay
         ▼
PerfectPay registra: "Webhook entregue ✅ 200 OK"

```

---

## 5. Match Engine Conecta Tudo

```
┌─────────────────────────────────────────────────────────────────┐
│  BACKGROUND WORKER — MATCH ENGINE                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  SQS Queue recebe mensagem:                                   │
│  {                                                             │
│    "conversationId": "conversion-uuid-ghi",                   │
│    "tenantId": "cursos-abc-2026",                             │
│    "type": "perfectpay_conversion"                            │
│  }                                                             │
│                                                                 │
│  1. BUSCA CONVERSÃO:                                           │
│     SELECT * FROM conversions                                 │
│     WHERE id = "conversion-uuid-ghi"                          │
│                                                                 │
│     Encontra:                                                 │
│     {                                                         │
│       id: "conversion-uuid-ghi",                              │
│       email_hash: "a1b2c3d4...",                             │
│       phone_hash: "x9y8z7w6...",                             │
│       amount: 149.95,                                        │
│       timestamp: 2026-03-02T14:36:30Z                         │
│     }                                                         │
│                                                                 │
│  2. PROCURA CLIQUES RECENTES DO TENANT:                       │
│     SELECT * FROM clicks                                      │
│     WHERE tenant_id = "cursos-abc-2026"                       │
│       AND created_at > NOW() - INTERVAL 7 DAYS               │
│       AND created_at < conversión_time                        │
│                                                                 │
│     Encontra:                                                 │
│     [                                                         │
│       {                                                       │
│         id: "click-uuid-xyz",                                 │
│         fbclid: "IwAR3n5H2x8L9K1m4Q7r0...",                  │
│         created_at: 2026-03-02T14:30:00Z,  ← 6 minutos atrás │
│         ip: "201.48.123.45"                                   │
│       }                                                       │
│     ]                                                         │
│                                                                 │
│  3. PROCURA PAGEVIEWS DO MESMO IP:                            │
│     SELECT * FROM pageviews                                   │
│     WHERE tenant_id = "cursos-abc-2026"                       │
│       AND ip = "201.48.123.45"                                │
│       AND created_at BETWEEN (click_time AND conversion_time) │
│                                                                 │
│     Encontra:                                                 │
│     {                                                         │
│       id: "pageview-uuid-abc",                               │
│       created_at: 2026-03-02T14:32:30Z  ← Viu a página       │
│     }                                                         │
│                                                                 │
│  4. CALCULA SCORE DE CONFIANÇA:                               │
│                                                                 │
│     Regra 1: fbclid no clique?                               │
│       ✅ SIM → +0.40  (forte indicativo de origem correta)   │
│                                                                 │
│     Regra 2: pageview entre clique e conversão?              │
│       ✅ SIM → +0.25  (usuário viu a landing page)           │
│                                                                 │
│     Regra 3: Próximo temporal? (clique → conversão)          │
│       ✅ SIM (6 min) → +0.15  (conversão logo após)          │
│                                                                 │
│     Regra 4: IP coincide?                                    │
│       ✅ SIM → +0.05  (mesmo dispositivo)                     │
│                                                                 │
│     SCORE TOTAL: 0.40 + 0.25 + 0.15 + 0.05 = 0.85 ✅         │
│                                                                 │
│     Threshold: 0.85 >= 0.85 → AUTO-MATCH APPROVED            │
│                                                                 │
│  5. CRIA MATCH:                                               │
│     INSERT INTO matches VALUES (                              │
│       id='match-uuid-jkl',                                    │
│       conversion_id='conversion-uuid-ghi',                    │
│       click_id='click-uuid-xyz',                              │
│       confidence_score=0.85,                                  │
│       rule_applied=[                                          │
│         'fbclid_exact_match',                                │
│         'pageview_observed',                                 │
│         'temporal_proximity',                                │
│         'ip_match'                                           │
│       ],                                                     │
│       matched_at='2026-03-02T14:37:00Z'                      │
│     )                                                         │
│                                                                 │
│     ✅ Match salvo com confiança 85%                         │
│                                                                 │
│  6. ENQUEUE PARA DISPATCH:                                    │
│     SQS queue "capi-dispatch" recebe:                         │
│     {                                                         │
│       "conversionId": "conversion-uuid-ghi",                  │
│       "matchId": "match-uuid-jkl",                           │
│       "action": "send_to_capi"                               │
│     }                                                         │
│                                                                 │
│  ⏱️ Match engine levou 230ms                                  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
         │
         │ Pronto para dispatch!
         ▼
┌─────────────────────────────────────────────────────────────────┐
│  DASHBOARD DO CLIENTE                                          │
├─────────────────────────────────────────────────────────────────┤
│  Status:                                                      │
│  ┌─────────────────────────────────────────────┐             │
│  │ ✅ Conversão detectada: R$ 149,95           │             │
│  │ ✅ Match realizado (confiança: 85%)         │             │
│  │ 🔄 Enviando para Meta...                    │             │
│  └─────────────────────────────────────────────┘             │
└─────────────────────────────────────────────────────────────────┘

```

---

## 6. Dispatch ao Meta CAPI

```
┌─────────────────────────────────────────────────────────────────┐
│  DISPATCH WORKER                                               │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  SQS Queue recebe:                                             │
│  {                                                             │
│    "conversionId": "conversion-uuid-ghi",                      │
│    "matchId": "match-uuid-jkl",                               │
│    "action": "send_to_capi"                                   │
│  }                                                             │
│                                                                 │
│  1. BUSCA CONVERSÃO:                                           │
│     SELECT * FROM conversions WHERE id = "conversion-uuid-ghi"│
│     Resultado:                                                │
│     {                                                         │
│       id: "conversion-uuid-ghi",                              │
│       email_hash: "a1b2c3d4...",                             │
│       phone_hash: "x9y8z7w6...",                             │
│       amount: 149.95,                                        │
│       currency: "BRL"                                        │
│     }                                                         │
│                                                                 │
│  2. BUSCA CREDENCIAIS META CAPI:                              │
│     SELECT * FROM tenants WHERE id = "cursos-abc-2026"        │
│     Resultado:                                                │
│     {                                                         │
│       meta_access_token: "EABsxxx...",  (do AWS Secrets)     │
│       meta_pixel_id: "1234567890",                            │
│       meta_conversion_api_version: "v21"                      │
│     }                                                         │
│                                                                 │
│  3. GERA EVENT_ID (DEDUPLICAÇÃO):                             │
│     event_id = SHA-256(                                       │
│       tenant_id + order_id + event_name + value              │
│     )                                                         │
│     event_id = SHA-256(                                       │
│       "cursos-abc-2026" +                                     │
│       "ORDER-2026-03-02-12345" +                              │
│       "Purchase" +                                            │
│       "149.95"                                                │
│     )                                                         │
│     = "f7a9c2b1e3d5g4h6i8j0..."                             │
│                                                                 │
│  4. VERIFICA DUPLICATA:                                       │
│     SELECT * FROM dedupe_registry                             │
│     WHERE tenant_id = "cursos-abc-2026"                       │
│       AND event_id = "f7a9c2b1e3d5g4h6i8j0..."               │
│                                                                 │
│     ❌ Não encontra → pode enviar novo                        │
│     (Se encontrar, pula o envio = idempotência)              │
│                                                                 │
│  5. MONTA PAYLOAD META CAPI:                                  │
│     {                                                         │
│       "data": [                                               │
│         {                                                     │
│           "event_name": "Purchase",                           │
│           "event_id": "f7a9c2b1e3d5g4h6i8j0...",             │
│           "event_time": 1740998190,  (timestamp em segundos)  │
│           "action_source": "website",                         │
│           "currency": "BRL",                                  │
│           "value": "149.95",                                  │
│           "user_data": {                                      │
│             "em": "a1b2c3d4...",  (email hasheado)           │
│             "ph": "x9y8z7w6...",  (phone hasheado)           │
│             "client_ip_address": "201.48.123.45",            │
│             "client_user_agent": "Mozilla/5.0..."            │
│           },                                                  │
│           "custom_data": {                                    │
│             "content_name": "Curso Python",                   │
│             "content_type": "online_course",                  │
│             "content_category": "education"                   │
│           },                                                  │
│           "custom_properties": {                              │
│             "origin_match_confidence": 0.85,                 │
│             "original_gateway": "perfectpay"                  │
│           }                                                  │
│         }                                                     │
│       ],                                                      │
│       "test_event_code": null,  (null em produção)           │
│       "partner_agent": "hub-tracking-v1"                     │
│     }                                                         │
│                                                                 │
│  6. ENVIA PARA META CAPI:                                     │
│     POST https://graph.instagram.com/v21.0/                  │
│             {pixel_id}/events                                │
│                                                                 │
│     Headers:                                                  │
│       Authorization: Bearer EABsxxx...                        │
│       Content-Type: application/json                          │
│                                                                 │
│     Body: (payload acima)                                     │
│                                                                 │
│     Resposta Meta CAPI:                                       │
│     {                                                         │
│       "events_received": 1,                                   │
│       "fbp_events_received": 0,                               │
│       "events_processed": 1,                                  │
│       "is_test": false,                                       │
│       "trace_id": "abc123xyz"                                │
│     }                                                         │
│                                                                 │
│     ✅ Meta recebeu!                                          │
│                                                                 │
│  7. REGISTRA ENVIO:                                           │
│     INSERT INTO dispatch_attempts VALUES (                    │
│       id='dispatch-attempt-mno',                              │
│       conversion_id='conversion-uuid-ghi',                    │
│       event_id='f7a9c2b1e3d5g4h6i8j0...',                    │
│       attempt_number=1,                                      │
│       status='success',                                      │
│       http_status_code=200,                                  │
│       meta_response={...},                                   │
│       created_at='2026-03-02T14:37:30Z'                      │
│     )                                                         │
│                                                                 │
│  8. MARCA DEDUPE:                                             │
│     INSERT INTO dedupe_registry VALUES (                      │
│       id='dedupe-pqr',                                        │
│       tenant_id='cursos-abc-2026',                            │
│       event_id='f7a9c2b1e3d5g4h6i8j0...',                    │
│       source='perfectpay_webhook',                            │
│       first_seen_at='2026-03-02T14:37:30Z',                  │
│       expires_at='2026-03-04T14:37:30Z'  (48h protection)    │
│     )                                                         │
│                                                                 │
│  ⏱️ Tudo levou 156ms (< 200ms target)                         │
│                                                                 │
│  RESUMO:                                                       │
│  ✅ Clique rastreado em 147ms                                 │
│  ✅ Pageview registrado                                       │
│  ✅ Conversão recebida em 89ms                                │
│  ✅ Match realizado em 230ms                                  │
│  ✅ Enviado ao Meta em 156ms                                  │
│  ────────────────────────────────────                         │
│  Total end-to-end: 622ms (dentro do p95 < 60s ✅)           │
│                                                                 │
│  Meta agora sabe:                                            │
│  "Este anúncio de 'Curso Python' gerou uma venda de R$ 150" │
│                                                                 │
│  Próximos 30 dias:                                            │
│  Meta vai otimizar para MAIS vendas como essa! 🎯             │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
         │
         │ Resposta volta de Meta
         ▼
┌─────────────────────────────────────────────────────────────────┐
│  DASHBOARD DO CLIENTE                                          │
├─────────────────────────────────────────────────────────────────┤
│  Status:                                                      │
│  ┌─────────────────────────────────────────────┐             │
│  │ ✅ Conversão detectada: R$ 149,95           │             │
│  │ ✅ Match realizado (confiança: 85%)         │             │
│  │ ✅ Enviado para Meta CAPI                   │             │
│  │ Timestamp: 14:37:30                         │             │
│  │ Trace ID Meta: abc123xyz                    │             │
│  └─────────────────────────────────────────────┘             │
│                                                               │
│  Analytics em tempo real:                                   │
│  ├─ Cliques hoje: 47                                         │
│  ├─ Conversões: 8                                            │
│  ├─ Taxa: 17%                                               │
│  ├─ ROI estimado: +240%                                     │
│  └─ Receita: R$ 1.199,60                                    │
│                                                               │
└─────────────────────────────────────────────────────────────────┘

```

---

## Resumo do Fluxo Completo

```
TEMPO TOTAL: Clique do usuário → Dados chegam ao Meta = 622ms ✅

Etapa 1: Clique em anúncio Facebook           (0ms)
Etapa 2: Seu servidor recebe clique          (147ms)
Etapa 3: Usuário vê landing page              (2 min)
Etapa 4: Pageview registrado                  (2 min 20 seg)
Etapa 5: Usuário clica em "Comprar"           (3 min)
Etapa 6: Checkout registrado                  (3 min 5 seg)
Etapa 7: PerfectPay processa pagamento        (3 min 30 seg)
Etapa 8: Webhook do PerfectPay chega          (3 min 36 seg) → +89ms
Etapa 9: Match Engine conecta tudo            (3 min 37 seg) → +230ms
Etapa 10: Dispatch envia ao Meta               (3 min 37 seg) → +156ms
──────────────────────────────────────────────────────────────
TOTAL END-TO-END: ~6 minutos 37 segundos
TOTAL TÉCNICO (etapas 2-10): 622ms (bem < 60s target)

Meta recebe conversão com:
  ✅ Clique ID original (fbclid)
  ✅ Email do comprador (hasheado)
  ✅ Valor e moeda
  ✅ Confiança do match (85%)
  ✅ IP e user-agent
  ✅ Deduplicação garantida

Resultado prático:
  Meta otimiza seu anúncio nos próximos 30 dias
  Mais pessoas como esse comprador verão o anúncio
  ROI sobe (você vende mais com mesmo orçamento)
  Seu cliente fica feliz
  Você cobra pelo tracking
  $ $ $
```

---

## Conclusão

Este é o fluxo real do seu sistema. Um usuário clica em um anúncio, e em 622ms (enquanto o navegador ainda está carregando), seu servidor:

1. ✅ Registra o clique
2. ✅ Registra a visita à página
3. ✅ Registra o checkout
4. ✅ Recebe notificação de pagamento
5. ✅ Conecta tudo via match engine
6. ✅ Envia ao Meta de forma segura e deduplicada

Tudo isso é **seu código**, **seu servidor**, **seu controle**. Muito melhor que depender do Stape.

---

*Documento criado em: 2026-03-02*
*Última atualização: story-track-ai-006 implementada*
