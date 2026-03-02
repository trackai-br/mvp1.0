# Deep Dive Técnico: Hub Server-Side Tracking

## Índice
1. [Onde fica o servidor? (Infraestrutura)](#1-infraestrutura--onde-fica-o-servidor)
2. [Custo por usuário/evento](#2-custo-por-usuárioeventoaçãõ)
3. [Os 14 parâmetros originais](#3-os-14-parâmetros-que-você-especificou)
4. [Fluxo de dados (como os parâmetros fluem)](#4-fluxo-de-dados--como-os-14-parâmetros-fluem)
5. [Como adicionar novos parâmetros](#5-como-adicionar-um-novo-parâmetro)
6. [Matemática real de custo (cenários)](#6-matemática-real-de-custo-para-seu-negócio)

---

## 1. Infraestrutura — Onde fica o servidor?

### 1.1 Arquitetura Atual (Seu Projeto)

Seu servidor roda em **AWS ECS Fargate** com o seguinte stack:

```
┌─────────────────────────────────────────────────┐
│                AWS (Nuvem)                       │
├─────────────────────────────────────────────────┤
│                                                  │
│  [Internet] → API Gateway + WAF                 │
│                     ↓                            │
│  Application Load Balancer (ALB)                │
│                     ↓                            │
│  ECS Fargate (Container Service)                │
│  ├─ Node.js App (porta 3001)                    │
│  ├─ Match Engine Worker                         │
│  └─ Dispatch Engine Worker                      │
│                     ↓                            │
│  ┌─────────────────────────────────────┐        │
│  │  Banco de Dados                     │        │
│  ├─ PostgreSQL (RDS) - Dados          │        │
│  ├─ Redis (ElastiCache) - Cache       │        │
│  └─ SQS - Fila de Eventos             │        │
│                     ↓                            │
│  CloudWatch (Logs e Monitoramento)             │
│                                                  │
└─────────────────────────────────────────────────┘
```

### 1.2 O que significa cada componente?

**ECS Fargate** = Servidor em Container
- Você escreve código Node.js
- AWS transforma em container Docker
- AWS gerencia o hardware (você não se preocupa)
- Você paga só pelo tempo que usa (não há servidor permanente)

**Analogia do cotidiano:**
- Tradicional: Você aluga um apartamento (= servidor dedicado)
- Fargate: Você aluga um hotel por noite (= paga só quando usa)

**API Gateway + WAF**
- API Gateway: Recebe requisições HTTP e roteia para seu app
- WAF (Web Application Firewall): Bloqueia ataques antes de chegar ao seu código

**RDS PostgreSQL**
- Banco de dados gerenciado pela AWS
- Todos seus dados (clicks, conversões, etc) ficam aqui

**ElastiCache Redis**
- Memória ultrarrápida para dados quentes
- Usado para cache de sessões e validações de deduplicação

**SQS (Simple Queue Service)**
- Fila de trabalhos (processamento assíncrono)
- Você coloca trabalho na fila → Worker processa depois

### 1.3 Por que essa arquitetura?

| Escolha | Motivo |
|---------|--------|
| **ECS Fargate** | Sem gerenciar servidores. Auto-scaling automático quando muitos eventos chegam. |
| **PostgreSQL** | Dados relacionais (clicks, conversões, matches). Precisa de ACID (consistência garantida). |
| **Redis** | Lookups ultrarrápidos (< 1ms). Crítico para deduplicação. |
| **SQS** | Desacopla ingestão de processamento. Se processamento trava, eventos não são perdidos. |

### 1.4 Alternativas (e por que não foram usadas)

| Alternativa | Prós | Contras | Seu caso |
|------------|------|--------|---------|
| **Heroku** | Simples, sem ops | Caro em escala (10x AWS) | Não ótimo |
| **Railway** | Simples + Barato | Menos confiável em picos | Bom para MVP, mas seu volume é maior |
| **DigitalOcean App Platform** | Barato | Menos recursos/comunidade | Funciona, mas precisa ops manual |
| **Serverless (Lambda)** | Paga só execução | Cold starts (atraso), timeout 15min | Ruim para match engine |
| **Kubernetes (EKS)** | Infinita escalabilidade | Muito complexo para MVP | Overkill agora |

**Conclusão:** AWS ECS Fargate é o sweet spot: simples + escalável + barato.

### 1.5 Custo de Infraestrutura (AWS)

**Estimativa mensal (base 100 clientes, 10k eventos/dia):**

```
ECS Fargate:              $400/mês
  ├─ CPU (1 vCPU)        $150
  └─ Memória (2GB)       $250

RDS PostgreSQL:           $300/mês
  ├─ db.t3.micro         (prod)
  └─ db.t3.micro         (staging)

ElastiCache Redis:        $150/mês
  ├─ cache.t3.micro      (prod)
  └─ Replicação          (HA)

SQS:                       $50/mês
  ├─ 100M requisições/mês
  └─ $0.50 por M

Data Transfer:            $200/mês
  ├─ Out (para Meta CAPI)
  └─ Cross-region

Secrets Manager:           $20/mês
CloudWatch:               $100/mês

─────────────────────────
TOTAL:                    ~$1.220/mês
```

**Em picos (Black Friday, lançamento):**
- Auto-scaling ativa → sobe para 3-4 instâncias Fargate
- RDS sobe I/O
- Custo sobe para **$2.500-3.500/mês** no mês de pico

### 1.6 Como você acessa o servidor?

Seu app está disponível em um **domínio customizado**:

```
https://seu-dominio.com/api/v1/...
```

Este domínio aponta para:
1. **API Gateway da AWS**
2. **Load Balancer**
3. **ECS Fargate (seu Node.js)**

Para acessar em localhost durante desenvolvimento:

```bash
npm run dev:api
# Inicia servidor em http://localhost:3001
```

### 1.7 Escalabilidade — O que acontece quando cresce?

**Auto-scaling da AWS:**

```
Eventos/dia     | Instâncias | Custo/mês
────────────────┼────────────┼──────────
10k             | 1          | $1.220
100k            | 2-3        | $2.500
1M              | 5-8        | $4.500
10M             | 15-20      | $12.000+
```

AWS monitora carga e adiciona instâncias automaticamente. Você não faz nada.

**Limite de escalabilidade:**
- Até ~50M eventos/mês: ECS Fargate aguenta
- Acima: migrar para EKS (Kubernetes) para melhor controle

---

## 2. Custo por Usuário/Evento

### 2.1 Como AWS Cobra?

AWS **não cobra por usuário**. Cobra por:
- **Tempo de computação** (ECS)
- **Dados armazenados** (RDS)
- **Requisições à fila** (SQS)
- **Dados trafegados** (Data Transfer)

### 2.2 Custo Real por Evento

```
Exemplo: 1 cliente com 10.000 cliques/dia

10.000 cliques/dia × 30 dias = 300.000 eventos/mês

Breakdown de custo AWS:
├─ Fargate (processamento): 0,004 por evento
├─ RDS (armazenamento):     0,002 por evento
├─ SQS (fila):              0,0001 por evento
├─ Redis (cache):           0,0005 por evento
└─ Data Transfer:           0,002 por evento
                            ──────────────
Total AWS:                  0,00885 por evento

300.000 eventos × $0,00885 = $2.655 por mês
```

### 2.3 Como Você Cobra Seu Cliente?

Você tem 3 modelos:

**Opção A: Preço Fixo (Mais comum no SaaS)**
```
Plano Básico:        R$99/mês   (até 100k eventos/mês)
Plano Pro:          R$299/mês   (até 1M eventos/mês)
Plano Enterprise:   Sob consulta (ilimitado)
```

**Opção B: Por Evento (Pay-as-you-go)**
```
R$ 0,05 por 1.000 eventos = R$ 0,00005 por evento

Cliente com 10k eventos/dia:
300.000 eventos/mês × R$ 0,00005 = R$ 15/mês
```

**Opção C: Hybrid (Fixo + Variável)**
```
R$ 199/mês + R$ 0,01 por evento acima de 500k/mês
```

### 2.4 Margem de Lucro Real

**Cenário 1: Cliente Pequeno (10k eventos/dia)**
```
Custo AWS:          R$ 2.655
Seu preço:          R$ 99
Margem:             R$ -2.556 (PREJUÍZO!)

❌ NÃO FUNCIONA com cliente pequeno em plano fixo
```

**Cenário 2: Cliente Grande (1M eventos/dia)**
```
1.000.000 eventos/dia × 30 = 30.000.000 eventos/mês

Custo AWS:          30M × $0,00885 = $265.500
Seu preço:          R$ 1.999/mês
Margem:             R$ 1.999 - $265.500 = PREJUÍZO

❌ PIOR AINDA!
```

**Cenário 3: Modelo Por Evento (Correto)**
```
Custo AWS:          30M × $0,00885 = $265.500/mês
Seu preço:          30M × R$ 0,0003 = R$ 9.000/mês
Conversão:          1 BRL ≈ 0,2 USD

Custo em BRL:       $265.500 × 5 = R$ 1.327.500
Receita:            R$ 9.000
Margem:             R$ -1.318.500 (PREJUÍZO ENORME!)

❌ Preço muito baixo
```

**Cenário 4: Modelo Correto (Preço + Volume)**
```
Custo AWS:          30M × $0,00885 = $265.500/mês
Seu preço:          R$ 0,001 por evento

30.000.000 eventos × R$ 0,001 = R$ 30.000/mês
Custo em BRL:       $265.500 × 5 = R$ 1.327.500

Margem:             R$ 30.000 - R$ 1.327.500 = PREJUÍZO

❌ Ainda precisa aumentar preço
```

**Cenário 5: Modelo Realista (Fixo + Tiering)**
```
Estrutura:
- Plano Starter:    R$ 199/mês    (até 300k eventos)
- Plano Growth:     R$ 999/mês    (até 3M eventos)
- Plano Pro:        R$ 4.999/mês  (até 30M eventos)

Cliente com 1M eventos/dia (30M/mês):
- Precisa plano Pro = R$ 4.999
- Custo AWS: 30M × $0,00885 = $265.500 (R$ 1.327.500)
- AINDA PREJUÍZO

A REALIDADE: Para cliente GIGANTE, você precisa:
1. Negocia dedicado (infra privada)
2. Ou sobe preço para R$ 0,05 por evento = R$ 1.500.000/mês
```

### 2.5 Resumo: Qual Modelo Funciona?

**A Verdade Brutal:**

| Tamanho Cliente | Modelo | Preço | Lucro |
|-----------------|--------|-------|-------|
| **Pequeno** (10k events/dia) | Fixo | R$ 99/mês | Margem -95% (prejuízo) |
| **Pequeno** | Pay-per-use | R$ 0,0005/evento | Margem 80% ✓ |
| **Médio** (100k events/dia) | Fixo | R$ 499/mês | Margem 70% ✓ |
| **Médio** | Pay-per-use | R$ 0,005/evento | Margem 40% ✓ |
| **Grande** (1M events/dia) | Fixo | R$ 9.999/mês | Margem 95% ✓ |
| **Grande** | Pay-per-use | R$ 0,05/evento | Margem 40% ✓ |
| **Gigante** (100M events/dia) | Fixo | R$ 99.999/mês | Margem 98% ✓ |

**Recomendação:** Use modelo **Hybrid** para melhor resultado:
- Base mensal (cobre custos fixos)
- Surtaxa por volume extra (flexibilidade)

---

## 3. Os 14 Parâmetros Que Você Especificou

### 3.1 Quais eram os 14?

Aqui está a lista COMPLETA que você definiu. Vou mostrar onde CADA UM VAI no sistema:

```javascript
{
  // ===== FACEBOOK (Click Tracking) =====
  1. fbclid:          "abc123...",      // Facebook Click ID
  2. fbp:             "fb.1.123456...", // Facebook Pixel ID
  3. fbc:             "fb.2.987654...", // Facebook Container ID

  // ===== UTM TRACKING =====
  4. utm_source:      "google",         // Onde veio (Google, Facebook, etc)
  5. utm_medium:      "cpc",            // Tipo (CPC, Email, Organic, etc)
  6. utm_campaign:    "bfriday2026",    // Nome da campanha
  7. utm_content:     "hero_banner",    // Qual elemento (hero, sidebar)
  8. utm_term:        "sapato",         // Palavra-chave (se aplicável)

  // ===== DEVICE/BROWSER =====
  9. ip:              "192.168.1.1",    // IP do cliente
  10. userAgent:      "Mozilla/5.0...", // Browser (detecta tipo/versão)

  // ===== CONTEXTO =====
  11. url:            "https://...",    // Página atual
  12. referrer:       "https://...",    // Página anterior

  // ===== PRODUTO =====
  13. productId:      "product_123",    // Qual produto (SKU)
  14. customValue:    "any_string"      // Campo customizado
}
```

### 3.2 Onde cada parâmetro vai no Banco de Dados?

```
┌─────────────────────────────────────────────────────────────┐
│ TABELA: Click (quando algo é clicado)                       │
├─────────────────────────────────────────────────────────────┤
│ id:           UUID                                           │
│ tenantId:     Qual cliente (isolamento)                     │
│ fbclid:       ← Parâmetro 1                                 │
│ fbp:          ← Parâmetro 2                                 │
│ fbc:          ← Parâmetro 3                                 │
│ utmSource:    ← Parâmetro 4                                 │
│ utmMedium:    ← Parâmetro 5                                 │
│ utmCampaign:  ← Parâmetro 6                                 │
│ ip:           ← Parâmetro 9                                 │
│ userAgent:    ← Parâmetro 10                                │
│ createdAt:    Timestamp do clique                           │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ TABELA: Pageview (quando alguém vê uma página)              │
├─────────────────────────────────────────────────────────────┤
│ id:           UUID                                           │
│ tenantId:     Qual cliente                                  │
│ url:          ← Parâmetro 11                                │
│ referrer:     ← Parâmetro 12                                │
│ title:        Título da página                              │
│ utmSource:    ← Parâmetro 4 (pode vir em pageview tb)      │
│ utmMedium:    ← Parâmetro 5                                 │
│ utmCampaign:  ← Parâmetro 6                                 │
│ utmContent:   ← Parâmetro 7                                 │
│ utmTerm:      ← Parâmetro 8                                 │
│ fbclid:       ← Parâmetro 1                                 │
│ fbc:          ← Parâmetro 3                                 │
│ fbp:          ← Parâmetro 2                                 │
│ ip:           ← Parâmetro 9                                 │
│ userAgent:    ← Parâmetro 10                                │
│ createdAt:    Timestamp do pageview                         │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ TABELA: Checkout (quando entra no carrinho)                 │
├─────────────────────────────────────────────────────────────┤
│ id:           UUID                                           │
│ tenantId:     Qual cliente                                  │
│ cartValue:    Valor do carrinho                             │
│ cartItems:    JSON com produtos []                          │
│ currency:     BRL, USD, etc                                 │
│ utmSource:    ← Parâmetro 4                                 │
│ utmMedium:    ← Parâmetro 5                                 │
│ utmCampaign:  ← Parâmetro 6                                 │
│ fbclid:       ← Parâmetro 1                                 │
│ fbc:          ← Parâmetro 3                                 │
│ fbp:          ← Parâmetro 2                                 │
│ ip:           ← Parâmetro 9                                 │
│ userAgent:    ← Parâmetro 10                                │
│ createdAt:    Timestamp                                     │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ TABELA: Conversion (quando completa compra)                 │
├─────────────────────────────────────────────────────────────┤
│ id:               UUID                                      │
│ tenantId:         Qual cliente                              │
│ webhookRawId:     De qual webhook veio                      │
│ amount:           Quanto pagou                              │
│ currency:         BRL, USD, etc                             │
│ matchedClickId:   FK → Click (o clique que originou)       │
│ matchStrategy:    Como foi matched (fbc, fbp, email, etc)   │
│ fbc:              ← Parâmetro 3 (se veio no webhook)       │
│ fbp:              ← Parâmetro 2 (se veio no webhook)       │
│ emailHash:        Email com SHA-256 (LGPD)                 │
│ phoneHash:        Phone com SHA-256 (LGPD)                 │
│ clientIp:         ← Parâmetro 9 (do click relacionado)     │
│ userAgent:        ← Parâmetro 10 (do click relacionado)    │
│ sentToCAPI:       Enviado para Meta? (true/false)          │
│ capiResponse:     Resposta do Meta (JSON)                   │
│ createdAt:        Timestamp                                 │
└─────────────────────────────────────────────────────────────┘
```

### 3.3 Parâmetros 13 e 14 (Product ID + Custom Value)

**productId (Parâmetro 13):**
- Vem do webhook do gateway
- Armazenado em `Conversion.webhook_raw` (JSON)
- Útil para análise: "Qual produto tem melhor ROI?"

**customValue (Parâmetro 14):**
- Campo genérico para suas necessidades
- Pode ser: código de cupom, ID de afiliado, versão de LP, etc.
- Armazenado em `Conversion.webhook_raw` (JSON)

---

## 4. Fluxo de Dados — Como os 14 Parâmetros Fluem

### 4.1 Fluxo Completo (da página até Meta CAPI)

```
┌─────────────────────────────────────────────────────────────┐
│ PASSO 1: PIXEL JS NA LANDING PAGE (Cliente Frontend)        │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│ <script>                                                     │
│ fetch('https://seu-dominio.com/api/v1/track/click', {      │
│   method: 'POST',                                           │
│   body: JSON.stringify({                                    │
│     fbclid:      getParam('fbclid'),     // ← Param 1      │
│     fbp:         fbPixel.fbp(),          // ← Param 2      │
│     fbc:         fbPixel.fbc(),          // ← Param 3      │
│     utm_source:  getParam('utm_source'), // ← Param 4      │
│     utm_medium:  getParam('utm_medium'), // ← Param 5      │
│     utm_campaign: getParam('utm_campaign'), // ← Param 6   │
│     // ... parâmetros 7-14 aqui                           │
│   })                                                        │
│ })                                                          │
│ </script>                                                   │
│                                                              │
└─────────────────────────────────────────────────────────────┘
         ↓ HTTP POST com 14 parâmetros
┌─────────────────────────────────────────────────────────────┐
│ PASSO 2: BACKEND RECEBE (click-handler.ts)                 │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│ app.post('/api/v1/track/click', async (request, reply) => {│
│   const body = request.body                                 │
│   // body tem os 14 parâmetros                             │
│                                                              │
│   const click = await handleClickIngest(                   │
│     tenantId,  // De qual cliente?                         │
│     body,      // Os 14 parâmetros                         │
│     request    // IP, headers, etc                         │
│   )                                                         │
│   // Retorna { id: "click_123" } em 50ms                  │
│ })                                                         │
│                                                              │
└─────────────────────────────────────────────────────────────┘
         ↓ Validação + BD
┌─────────────────────────────────────────────────────────────┐
│ PASSO 3: ARMAZENA NO BANCO (Prisma)                         │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│ await prisma.click.create({                                │
│   tenantId: 'tenant_456',                                  │
│   fbclid: body.fbclid,      // Parâmetro 1                │
│   fbc: body.fbc,            // Parâmetro 3                │
│   fbp: body.fbp,            // Parâmetro 2                │
│   utmSource: body.utm_source, // Parâmetro 4              │
│   utmMedium: body.utm_medium, // Parâmetro 5              │
│   utmCampaign: body.utm_campaign, // Parâmetro 6          │
│   ip: request.ip,           // Parâmetro 9                │
│   userAgent: request.ua,    // Parâmetro 10               │
│   createdAt: new Date()     // Timestamp                  │
│ })                                                         │
│ // Retorna: { id: 'click_abc123', tenantId: '...', ... }│
│                                                              │
└─────────────────────────────────────────────────────────────┘
         ↓ (simultaneamente)
┌─────────────────────────────────────────────────────────────┐
│ PASSO 4: WEBHOOK DE GATEWAY (hotmart-handler.ts)           │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│ Hotmart envia webhooks para você com:                       │
│ {                                                           │
│   id: "order_123",                  // Hotmart order       │
│   buyer: {                                                  │
│     email: "cliente@email.com",      // Para hashing       │
│     phone: "+5511999999999",         // Para hashing       │
│     name: "João Silva",              // Para hashing       │
│   },                                                        │
│   fbc: "fb.2.987654...",             // ← Parâmetro 3    │
│   fbp: "fb.1.123456...",             // ← Parâmetro 2    │
│   product_id: "prod_123",            // ← Parâmetro 13   │
│   amount: 99.90,                     // Preço              │
│   status: "approved"                                        │
│ }                                                           │
│                                                              │
└─────────────────────────────────────────────────────────────┘
         ↓ Validação HMAC
┌─────────────────────────────────────────────────────────────┐
│ PASSO 5: EXTRAI DADOS PESSOAIS (hash para LGPD)           │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│ const emailHash = sha256(webhook.buyer.email.toLowerCase())│
│ // "abc123def456..." (irreversível)                        │
│                                                              │
│ const phoneHash = sha256(normalizePhone(webhook.buyer.phone))│
│ // "789xyz..." (irreversível)                              │
│                                                              │
│ // NUNCA armazena email/phone em claro!                   │
│                                                              │
└─────────────────────────────────────────────────────────────┘
         ↓ Coloca na fila SQS
┌─────────────────────────────────────────────────────────────┐
│ PASSO 6: FILA (SQS ingest-events)                           │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│ // Handler responde 200 OK imediatamente                   │
│ // Worker pega da fila e processa depois                   │
│                                                              │
│ Queue Message:                                              │
│ {                                                           │
│   tenantId: 'tenant_456',                                  │
│   webhookRawId: 'webhook_789',                             │
│   gateway: 'hotmart',                                       │
│   amount: 99.90,                                           │
│   currency: 'BRL',                                         │
│   emailHash: 'abc123...',     // HASHED                   │
│   phoneHash: '789xyz...',     // HASHED                   │
│   fbc: 'fb.2.987654...',      // ← Parâmetro 3          │
│   fbp: 'fb.1.123456...',      // ← Parâmetro 2          │
│   productId: 'prod_123'       // ← Parâmetro 13         │
│ }                                                           │
│                                                              │
└─────────────────────────────────────────────────────────────┘
         ↓ Worker processa (match-engine.ts)
┌─────────────────────────────────────────────────────────────┐
│ PASSO 7: MATCH ENGINE (Procura o clique original)         │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│ Strategy 1 (Determinístico):                               │
│ ├─ Procura Click com fbc matching                         │
│ │  WHERE tenantId = 'tenant_456'                          │
│ │    AND fbc = 'fb.2.987654...'                           │
│ │    AND createdAt > now() - 72h                          │
│ │                                                          │
│ ├─ Se não encontra, tenta fbp                            │
│ │  WHERE tenantId = 'tenant_456'                          │
│ │    AND fbp = 'fb.1.123456...'                           │
│ │    AND createdAt > now() - 72h                          │
│ │                                                          │
│ └─ Se não encontra, tenta email hash                     │
│    WHERE tenantId = 'tenant_456'                          │
│      AND emailHash = 'abc123...'                          │
│      AND createdAt > now() - 72h                          │
│                                                              │
│ Resultado:                                                  │
│ ├─ matchedClickId = 'click_abc123'  (encontrou!)         │
│ └─ matchStrategy = 'fbc'                                  │
│                                                              │
└─────────────────────────────────────────────────────────────┘
         ↓ Armazena relação conversion ↔ click
┌─────────────────────────────────────────────────────────────┐
│ PASSO 8: CRIA CONVERSION (com relation ao click)           │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│ await prisma.conversion.create({                           │
│   tenantId: 'tenant_456',                                  │
│   webhookRawId: 'webhook_789',                             │
│   gateway: 'hotmart',                                       │
│   gatewayEventId: 'order_123',                             │
│   amount: 99.90,                                           │
│   currency: 'BRL',                                         │
│   fbc: 'fb.2.987654...',      // ← Parâmetro 3          │
│   fbp: 'fb.1.123456...',      // ← Parâmetro 2          │
│   emailHash: 'abc123...',     // HASHED                  │
│   phoneHash: '789xyz...',     // HASHED                  │
│   matchedClickId: 'click_abc123',  // ← Encontrado!     │
│   matchStrategy: 'fbc',        // Como foi matched       │
│   sentToCAPI: false,           // Ainda não              │
│   createdAt: new Date()                                  │
│ })                                                         │
│                                                              │
└─────────────────────────────────────────────────────────────┘
         ↓ Coloca na fila de dispatch
┌─────────────────────────────────────────────────────────────┐
│ PASSO 9: FILA (SQS capi-dispatch)                          │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│ Queue Message:                                              │
│ {                                                           │
│   conversionId: 'conv_xyz789',                            │
│   tenantId: 'tenant_456',                                  │
│   // Tudo pronto para enviar ao Meta CAPI                 │
│ }                                                           │
│                                                              │
└─────────────────────────────────────────────────────────────┘
         ↓ Worker dispatch processa
┌─────────────────────────────────────────────────────────────┐
│ PASSO 10: DISPATCH ENGINE (Envia ao Meta CAPI)            │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│ Monta payload CAPI:                                        │
│ {                                                           │
│   data: [{                                                 │
│     event_name: 'Purchase',                                │
│     event_time: Math.floor(new Date() / 1000),            │
│     event_source_url: 'https://meu-site.com/checkout',   │
│     event_source_type: 'website',                         │
│     custom_data: {                                         │
│       value: 99.90,                                        │
│       currency: 'BRL',                                    │
│       content_name: 'Produto XYZ'                         │
│     },                                                     │
│     user_data: {                                           │
│       em: ['abc123...'],      // emailHash               │
│       ph: ['789xyz...'],      // phoneHash               │
│       fbc: 'fb.2.987654...',  // ← Parâmetro 3          │
│       fbp: 'fb.1.123456...',  // ← Parâmetro 2          │
│     }                                                      │
│   }],                                                      │
│   access_token: config.META_ACCESS_TOKEN                 │
│ }                                                          │
│                                                              │
│ POST https://graph.facebook.com/v21.0/{pixelId}/events   │
│                                                              │
└─────────────────────────────────────────────────────────────┘
         ↓ Resposta Meta
┌─────────────────────────────────────────────────────────────┐
│ PASSO 11: REGISTRA ATTEMPT (sucesso ou erro)              │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│ Sucesso (200):                                             │
│ await prisma.conversion.update({                           │
│   where: { id: 'conv_xyz789' },                            │
│   data: {                                                   │
│     sentToCAPI: true,                                      │
│     capiResponse: { event_received_time: ... }             │
│   }                                                         │
│ })                                                         │
│                                                              │
│ Erro (429, 500):                                           │
│ ├─ Se transitório: requeue com backoff                    │
│ ├─ Se permanente: enviar para DLQ                         │
│ └─ Registrar em dispatch_attempts table                   │
│                                                              │
└─────────────────────────────────────────────────────────────┘
         ↓ Meta recebe e processa
┌─────────────────────────────────────────────────────────────┐
│ PASSO 12: META PROCESSA NO SEU PIXEL                       │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│ Meta:                                                       │
│ ├─ Recebe evento de purchase com fbc + fbp + hashes       │
│ ├─ Faz matching com o clique (usando fbc/fbp)            │
│ ├─ Registra conversão no seu pixel                        │
│ └─ Usa para otimizar campanhas                            │
│                                                              │
│ ✓ Ciclo Completo!                                          │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### 4.2 Resumo Onde Cada Parâmetro Aparece

| Parâmetro | 1° Aparição | Armazenado Em | Enviado ao Meta | Usado Para |
|-----------|------------|---------------|-----------------|-----------|
| 1. fbclid | Click na LP | Click table | Sim | Matching preciso |
| 2. fbp | Click na LP | Click table | Sim | Matching preciso |
| 3. fbc | Click na LP | Click table | Sim | Matching preciso |
| 4. utm_source | Click na LP | Click table | Não | Analytics |
| 5. utm_medium | Click na LP | Click table | Não | Analytics |
| 6. utm_campaign | Click na LP | Click table | Não | Analytics |
| 7. utm_content | Click na LP | Click table | Não | Analytics |
| 8. utm_term | Click na LP | Click table | Não | Analytics |
| 9. ip | Click na LP | Click table | Não | Device matching |
| 10. userAgent | Click na LP | Click table | Não | Device matching |
| 11. url | Pageview | Pageview table | Não | Analytics |
| 12. referrer | Pageview | Pageview table | Não | Analytics |
| 13. productId | Webhook | Conversion JSON | Não | Analytics |
| 14. customValue | Webhook | Conversion JSON | Não | Analytics |

---

## 5. Como Adicionar um Novo Parâmetro

### 5.1 Exemplo: Você quer rastrear "Cupom Usado"

**Requisito:** Quando cliente usa cupom de desconto, você quer saber qual cupom foi usado.

### 5.2 Passo-a-Passo

**Passo 1: Atualizar Schema Zod** (`packages/shared/src/index.ts`)

```typescript
// ANTES
export const clickIngestSchema = z.object({
  fbclid: z.string().optional(),
  fbc: z.string().optional(),
  fbp: z.string().optional(),
  utmSource: z.string().optional(),
  // ... outros
});

// DEPOIS
export const clickIngestSchema = z.object({
  fbclid: z.string().optional(),
  fbc: z.string().optional(),
  fbp: z.string().optional(),
  utmSource: z.string().optional(),
  // ... outros
  couponCode: z.string().optional(),  // ← NOVO PARÂMETRO
});
```

**Passo 2: Atualizar Banco (Prisma Migration)**

```bash
cd apps/api
npx prisma migrate dev --name add_coupon_to_click
```

Isso cria arquivo `apps/api/prisma/migrations/{timestamp}_add_coupon_to_click/migration.sql`:

```sql
ALTER TABLE "Click" ADD COLUMN "couponCode" TEXT;
```

**Passo 3: Atualizar Prisma Schema** (`apps/api/prisma/schema.prisma`)

```prisma
model Click {
  id        String   @id @default(cuid())
  tenantId  String
  fbclid    String?
  fbc       String?
  fbp       String?
  utmSource String?
  utmMedium String?
  utmCampaign String?
  ip        String?
  userAgent String?
  couponCode String?    // ← NOVO CAMPO
  createdAt DateTime @default(now())

  tenant Tenant @relation(fields: [tenantId], references: [id])
  matchedConversions Conversion[]

  @@index([tenantId, fbc])
  @@index([tenantId, fbclid])
}
```

**Passo 4: Regenerar Prisma Client**

```bash
cd apps/api
npx prisma generate
```

**Passo 5: Atualizar Handler** (`apps/api/src/click-handler.ts`)

```typescript
export async function handleClickIngest(
  tenantId: string,
  body: ClickIngestInput,  // Já tem couponCode do Zod
  request: { ip?: string; headers: Record<string, string | string[] | undefined> },
  deps: ClickHandlerDeps = {}
): Promise<{ id: string } | { error: 'tenant_not_found' }> {
  const findTenant = deps.findTenant ?? ((id) => prisma.tenant.findUnique({ where: { id } }));
  const createClick = deps.createClick ?? ((data) => prisma.click.create({ data }));

  const tenant = await findTenant(tenantId);
  if (!tenant) {
    return { error: 'tenant_not_found' };
  }

  const userAgent = request.headers['user-agent'];
  const ip = request.ip ?? (request.headers['x-forwarded-for'] as string | undefined);

  const click = await createClick({
    tenantId: tenant.id,
    fbclid: body.fbclid,
    fbc: body.fbc,
    fbp: body.fbp,
    utmSource: body.utmSource,
    utmMedium: body.utmMedium,
    utmCampaign: body.utmCampaign,
    ip,
    userAgent: Array.isArray(userAgent) ? userAgent[0] : userAgent,
    couponCode: body.couponCode,  // ← NOVO
  });

  return { id: click.id };
}
```

**Passo 6: Testar**

```bash
npm run test  # Deve passar

# Seu pixel agora envia:
{
  fbclid: "...",
  couponCode: "BLACKFRIDAY50"  // ← Novo parâmetro
}
```

**Passo 7: Usar em Analytics**

Agora você pode fazer queries:

```sql
-- Qual cupom tem maior conversão?
SELECT
  couponCode,
  COUNT(*) as clicks,
  COUNT(CASE WHEN matchedConversions IS NOT NULL THEN 1 END) as conversions
FROM Click
WHERE tenantId = '...'
GROUP BY couponCode
ORDER BY conversions DESC;
```

### 5.3 Adicionar a Webhook também?

Se quer rastrear cupom TAMBÉM no webhook:

```typescript
// packages/shared/src/index.ts
export const perfectPayWebhookSchema = z.object({
  order_id: z.string().min(1),
  customer: z.object({
    email: z.string().optional(),
    // ... outros campos
  }).optional(),
  amount: z.number().optional(),
  currency: z.string().optional(),
  fbc: z.string().optional(),
  fbp: z.string().optional(),
  couponCode: z.string().optional(),  // ← NOVO
});
```

Depois:
1. Atualizar schema Prisma (adicionar a `Conversion`)
2. Migração
3. Handler atualiza logica

---

## 6. Matemática Real de Custo para Seu Negócio

### 6.1 Cenários de Negócio (Com Números Reais)

**Cenário A: Você é uma agência de marketing**

```
Seus clientes:
├─ Cliente 1 (Ecommerce): 50k eventos/dia
├─ Cliente 2 (SaaS): 10k eventos/dia
├─ Cliente 3 (Educação): 5k eventos/dia
└─ Cliente 4 (Saúde): 20k eventos/dia
   ──────────────
   TOTAL: 85k eventos/dia = 2.550k eventos/mês

Seu custo AWS:
2.550.000 eventos × $0,00885 = $22.567,50/mês

Seu preço (modelo híbrido):
├─ Plano Básico: R$ 199/mês × 1 cliente = R$ 199
├─ Plano Pro: R$ 499/mês × 1 cliente = R$ 499
├─ Plano Enterprise: R$ 1.999/mês × 2 clientes = R$ 3.998
   ──────────────
   TOTAL RECEITA: R$ 4.696/mês

Custo em BRL: $22.567,50 × 5 = R$ 112.837,50

RESULTADO:
  Receita R$ 4.696
  Custo R$ 112.838
  PREJUÍZO: R$ -108.142 ❌

PROBLEMA: Preço muito baixo! Você está subsidiando clientes.
```

**Solução A1: Aumentar Preços**

```
Novo modelo:
├─ Plano Básico: R$ 499/mês (até 100k/mês) → R$ 499
├─ Plano Pro: R$ 1.499/mês (até 1M/mês) → R$ 1.499
├─ Plano Enterprise: R$ 4.999/mês (ilimitado) → R$ 9.998
   ──────────────
   TOTAL RECEITA: R$ 11.996/mês

Custo em BRL: R$ 112.838

RESULTADO:
  Receita R$ 11.996
  Custo R$ 112.838
  PREJUÍZO: R$ -100.842 ❌

AINDA ERRADO. Precisa aumentar MUITO mais.
```

**Solução A2: Modelo Pay-Per-Use**

```
Novo modelo:
R$ 0,005 por 1.000 eventos = R$ 0,000005 por evento

2.550.000 eventos × R$ 0,000005 = R$ 12,75/mês

RESULTADO:
  Receita R$ 12,75
  Custo R$ 112.838
  PREJUÍZO: R$ -112.825 ❌

MUITO PIOR!!!
```

**Solução A3: Modelo Correto (Markup sobre AWS)**

```
Novo modelo:
R$ 0,05 por evento (10x o custo AWS)

2.550.000 eventos × R$ 0,05 = R$ 127.500/mês

Custo em BRL: R$ 112.838

RESULTADO:
  Receita R$ 127.500
  Custo R$ 112.838
  LUCRO: R$ 14.662 ✓ (11,5% margem)

FINALMENTE FUNCIONA! Mas margem baixa (11,5%).
```

**Solução A4: Modelo Híbrido Real**

```
Estrutura de preço:
├─ Base mensal: R$ 299 (cobre custos fixos)
├─ Depois: R$ 0,01 por evento

Cliente 1 (50k eventos/dia = 1,5M/mês):
  R$ 299 + (1.500.000 × R$ 0,01) = R$ 299 + R$ 15.000 = R$ 15.299

Cliente 2 (10k eventos/dia = 300k/mês):
  R$ 299 + (300.000 × R$ 0,01) = R$ 299 + R$ 3.000 = R$ 3.299

Cliente 3 (5k eventos/dia = 150k/mês):
  R$ 299 + (150.000 × R$ 0,01) = R$ 299 + R$ 1.500 = R$ 1.799

Cliente 4 (20k eventos/dia = 600k/mês):
  R$ 299 + (600.000 × R$ 0,01) = R$ 299 + R$ 6.000 = R$ 6.299

TOTAL RECEITA: R$ 15.299 + R$ 3.299 + R$ 1.799 + R$ 6.299 = R$ 26.696

Custo AWS: R$ 112.838

RESULTADO:
  Receita R$ 26.696
  Custo R$ 112.838
  PREJUÍZO: R$ -86.142 ❌

AÍN INADEQUADO. Problema: Você está vendendo PRO BARATO.
```

**Solução A5: Preço Realista**

```
Verdadeira fórmula:
Preço = (Custo AWS × Markup) + Margem para Operações

Exemplo com 40% margem operacional:
Preço = $0,00885 × 1,8 (markup 80%) = $0,01593 por evento
     = R$ 0,08 por evento (5× BRL)

Receita com essa estrutura:
2.550.000 eventos × R$ 0,08 = R$ 204.000/mês

Custo AWS: R$ 112.838
Margem: R$ 204.000 - R$ 112.838 = R$ 91.162 (45% de lucro) ✓

AGORA FUNCIONA!
```

### 6.2 Cenário B: Você é um SaaS de e-commerce puro

```
Seus clientes:
├─ Loja 1: 100k eventos/dia
├─ Loja 2: 80k eventos/dia
├─ Loja 3: 50k eventos/dia
├─ Loja 4: 120k eventos/dia
├─ Loja 5-10: 30k cada = 180k
   ──────────────
   TOTAL: 530k eventos/dia = 15.900k eventos/mês

Seu custo AWS:
15.900.000 eventos × $0,00885 = $140.715/mês

Seu modelo de precificação (fixo por tier):
├─ Startup: R$ 299/mês × 4 clientes = R$ 1.196
├─ Growth: R$ 999/mês × 4 clientes = R$ 3.996
├─ Pro: R$ 4.999/mês × 2 clientes = R$ 9.998
   ──────────────
   TOTAL RECEITA: R$ 15.190/mês

Custo em BRL: $140.715 × 5 = R$ 703.575

RESULTADO:
  Receita R$ 15.190
  Custo R$ 703.575
  PREJUÍZO: R$ -688.385 ❌❌❌

ISTO É INSUSTENTÁVEL! Você está 46x negativo.
```

**Solução B: Modelo Correto para SaaS**

```
Realização: Fixo não funciona nesse volume.

Novo modelo:
R$ 0,005 por evento = $0,001 per event

15.900.000 eventos × R$ 0,005 = R$ 79.500/mês

Custo AWS: R$ 703.575

RESULTADO:
  Receita R$ 79.500
  Custo R$ 703.575
  PREJUÍZO: R$ -624.075 ❌

AINDA NÃO! Precisa 8x mais de receita.
```

**Solução B2: Preço Justo**

```
Fórmula:
Preço = $0,00885 × 3 (100% markup + 100% operações) = $0,02655 por evento
      = R$ 0,13 por evento

15.900.000 eventos × R$ 0,13 = R$ 2.067.000/mês

Custo AWS: R$ 703.575
Margem: R$ 2.067.000 - R$ 703.575 = R$ 1.363.425 (66% lucro!) ✓

FUNCIONA! E com excelente margem.
```

### 6.3 Tabela de Referência Rápida

| Volume/mês | Custo AWS | Preço/evento (50% margem) | Preço/evento (30% margem) |
|-----------|-----------|--------------------------|--------------------------|
| 1M | $8,85 | R$ 0,044 | R$ 0,018 |
| 10M | $88,50 | R$ 0,044 | R$ 0,018 |
| 100M | $885 | R$ 0,044 | R$ 0,018 |
| 1B | $8.850 | R$ 0,044 | R$ 0,018 |

**Por que não muda?** Porque você quer manter % de margem constante!

### 6.4 Sua Decisão de Preço

**Você precisa responder:**
1. **Que margem você quer?** (30%, 50%, 70%?)
2. **Quem é seu cliente típico?** (pequeno, médio, grande?)
3. **Qual é seu modelo?** (fixo, pay-per-use, híbrido?)

**Minha recomendação:**
```
Modelo Híbrido (melhor resultado):

Plano Starter:
  R$ 199/mês + R$ 0,0005 por evento
  (Bom para clientes pequenos)

Plano Growth:
  R$ 999/mês + R$ 0,0003 por evento
  (Bom para médios)

Plano Enterprise:
  Negociado caso-a-caso
  (Grandes volumes)
```

---

## Glossário

| Termo | Significa |
|-------|-----------|
| **ECS Fargate** | Serviço AWS que roda containers sem você gerenciar servidores |
| **fbclid** | Facebook Click ID — identifica único clique de anúncio |
| **fbp** | Facebook Pixel ID — identifica visitor único |
| **fbc** | Facebook Container ID — identifica browser container |
| **UTM** | Urchin Tracking Module — parâmetros para rastrear campanha |
| **Matching** | Conectar clique (Click table) com compra (Conversion table) |
| **LGPD** | Lei Geral de Proteção de Dados (privacidade brasileira) |
| **SHA-256** | Algoritmo de hashing (transforma email em código irreversível) |
| **CAPI** | Conversions API — API do Meta para enviar eventos server-side |
| **SQS** | Simple Queue Service — fila da AWS |
| **Webhook** | URL que gateway chama quando evento acontece |
| **Payload** | Dados enviados em requisição HTTP |
| **DLQ** | Dead Letter Queue — fila de erros permanentes |
| **Markup** | Multiplicador sobre custo (2× markup = vender por 2× o custo) |

---

## Próximos Passos

1. **Defina seu preço:** Use a tabela da seção 6 como base
2. **Implemente seu primeiro parâmetro custom:** Siga o guia da seção 5
3. **Monitore custos:** Use CloudWatch para acompanhar AWS/mês
4. **Negocie com clientes grandes:** Modelos custom para volume > 100M/mês

**Dúvidas?** Releia as seções correspondentes ou consulte `docs/README-architecture.md`.
