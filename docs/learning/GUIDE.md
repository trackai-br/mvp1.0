# Guia de Aprendizado — Hub Server-Side Tracking

> **Para quem é este guia?**
> Para você, que está construindo este projeto e quer entender o que está sendo feito, por quê cada decisão foi tomada, e como tudo se conecta — mesmo que nunca tenha programado antes.

---

## Sumário

1. [O que é este projeto?](#1-o-que-é-este-projeto)
2. [Como o projeto está organizado?](#2-como-o-projeto-está-organizado)
3. [Story 001 — Setup Wizard](#3-story-001--setup-wizard)
4. [Story 002 — Secrets e API Gateway](#4-story-002--secrets-e-api-gateway)
5. [Conceitos Fundamentais](#5-conceitos-fundamentais)
6. [Glossário](#glossário)

---

## 1. O que é este projeto?

### Em linguagem simples

Imagine que você tem uma loja e quer saber exatamente de onde vêm seus clientes. O Meta Ads (Facebook/Instagram) mostra anúncios, as pessoas clicam, visitam sua página e compram. Mas como saber **qual anúncio gerou qual venda**?

O problema: quando alguém compra no seu site, o evento de "compra" precisa chegar ao Meta para ele otimizar seus anúncios. Só que fazer isso direto pelo navegador do cliente (o jeito antigo) tem falhas — bloqueadores de anúncio, privacidade do iOS, etc.

**Solução: Server-Side Tracking**

Em vez de depender do navegador do cliente, você cria um servidor que intercepta os eventos de compra e os envia diretamente ao Meta, de servidor para servidor. É mais confiável, mais privado, e gera um **match rate** (taxa de correspondência) muito maior.

```
JEITO ANTIGO (Client-Side):
Usuário → Navegador → Meta
              ❌ (bloqueado por iOS, ad blockers, etc.)

JEITO NOVO (Server-Side):
Usuário → Seu Servidor → Meta CAPI ✅
              ↑
         este projeto
```

### Para que serve cada parte?

| Componente | Analogia | Função real |
|------------|----------|-------------|
| API Gateway | Porteiro de hotel | Recebe todas as requisições e decide quem passa |
| WAF | Segurança na porta | Bloqueia tráfego malicioso e controla volume |
| Match Engine | Detetive | Casa o clique com a venda |
| Dispatch Engine | Carteiro | Envia os eventos confirmados ao Meta |
| SQS | Esteira de fábrica | Fila de eventos para processar sem perder nada |

**Fontes para aprofundar:**
- [Meta Conversions API — Documentação Oficial](https://developers.facebook.com/docs/marketing-api/conversions-api)
- [O que é Server-Side Tracking? — Artigo Stape.io](https://stape.io/blog/server-side-tracking)
- [Server-Side vs Client-Side Tracking — Explicação Visual](https://www.adswerve.com/blog/client-side-vs-server-side-tracking/)

---

## 2. Como o projeto está organizado?

### A estrutura de pastas (monorepo)

```
hub-server-side-tracking/
│
├── apps/
│   ├── api/          ← O servidor backend (recebe webhooks, processa eventos)
│   └── web/          ← O painel web (dashboard, configurações)
│
├── packages/
│   └── shared/       ← Código compartilhado entre api e web
│
├── infra/
│   └── secrets/      ← Chaves e senhas (NUNCA vão para o GitHub)
│       ├── .env.local          ← Suas senhas reais (ignorado pelo git)
│       └── .env.local.example  ← Template com os nomes (sem valores)
│
└── docs/
    ├── learning/     ← Este guia que você está lendo
    └── stories/      ← O que foi planejado e executado
```

**O que é um "monorepo"?**

> Um monorepo é quando você tem vários projetos/aplicativos dentro de uma única pasta principal. É como um apartamento com vários quartos — cada quarto tem sua função, mas todos compartilham a mesma estrutura, ferramentas e regras de convivência.

**Fontes:**
- [O que é Monorepo? — Turborepo Docs](https://turbo.build/repo/docs/handbook/what-is-a-monorepo)
- [Monorepo vs Multirepo — Comparação prática](https://semaphoreci.com/blog/what-is-monorepo)

---

## 3. Story 001 — Setup Wizard

**Status:** ✅ Concluída

### O que foi feito?

O Setup Wizard é o "assistente de instalação" que guia um novo cliente a configurar o tracking dele. Pensa como o setup inicial de um roteador Wi-Fi — você responde perguntas, ele configura automaticamente.

**Endpoints criados:**

```
POST /api/v1/setup/sessions           → Inicia uma sessão de configuração
POST /api/v1/setup/sessions/:id/chat  → Conversa com o assistente IA
GET  /api/v1/setup/sessions/:id/status → Verifica o progresso
```

### Arquivos principais

| Arquivo | O que faz |
|---------|-----------|
| `apps/api/src/server.ts` | Servidor principal — registra todas as rotas |
| `apps/api/src/validation.ts` | Valida os dados recebidos nas requisições |
| `apps/api/src/setup-store.ts` | Armazena o estado da sessão de setup |

---

## 4. Story 002 — Secrets e API Gateway

**Status:** ✅ Concluída (2026-02-21)

### O que são "secrets"?

> **Analogia:** São como as senhas do seu Wi-Fi. Você não escreve ela em um papel colado na parede do escritório, certo? Você guarda em lugar seguro. No código, as senhas (API keys, tokens, URLs de banco de dados) ficam em arquivos especiais que nunca vão para o GitHub.

**Os secrets deste projeto:**

| Variável | O que é | Para que serve |
|----------|---------|----------------|
| `DB_URL` | Endereço do banco de dados | Conectar ao Supabase (PostgreSQL) |
| `SUPABASE_API_KEY` | Senha do Supabase | Autenticar chamadas ao banco |
| `CF_API_TOKEN` | Token do Cloudflare | Gerenciar domínio e segurança |
| `PERFECTPAY_WEBHOOK_SECRET` | Senha do PerfectPay | Validar que o webhook veio mesmo do PerfectPay |
| `AWS_SECRET_NAME_FOR_DB` | Nome do secret na AWS | Localizar a senha do banco na AWS |

### O que já foi feito (✅)

1. **Arquivo `.env.local` atualizado** com todos os secrets necessários
2. **URL definitiva do banco** (`postgresql://...supabase.co:5432/postgres`) configurada
3. **Migração do banco aplicada** — `npx prisma migrate dev --name init` rodou com sucesso

**O que é uma migração de banco?**

> Imagine que o banco de dados é uma planilha do Excel. Quando você adiciona uma nova coluna, você está fazendo uma "migração". O Prisma registra cada mudança na estrutura da planilha e pode reproduzir exatamente essas mudanças em qualquer ambiente (local, staging, produção).

### O que está pendente (⏳)

#### Tarefa 1: Configurar API Gateway + WAF na AWS

**O que é API Gateway?**

```
SEM API GATEWAY:
Internet → Diretamente no seu servidor
           (exposto, sem filtro, sem controle)

COM API GATEWAY:
Internet → API Gateway → Seu servidor
           ↑
    - Autentica quem pode passar
    - Conta quantas requisições por segundo
    - Roteia para o serviço certo
```

**O que é WAF (Web Application Firewall)?**

> É o segurança da boate. Ele tem uma lista de regras: "se alguém tentar entrar 1000 vezes por minuto com o mesmo tenant_id, bota pra fora". Protege contra ataques automatizados e abuso.

**O que precisamos configurar:**
- Rate limiting por `tenant_id`: cada cliente (tenant) pode fazer no máximo X requisições por minuto
- Health check: verificação automática de "o servidor está vivo?"
- Rotas protegidas: apenas usuários autenticados acessam dados sensíveis

**Fontes:**
- [O que é AWS API Gateway? — Documentação AWS](https://docs.aws.amazon.com/apigateway/latest/developerguide/welcome.html)
- [O que é WAF? — Cloudflare explicando](https://www.cloudflare.com/learning/ddos/glossary/web-application-firewall-waf/)
- [Rate Limiting — Por que é importante](https://www.nginx.com/blog/rate-limiting-nginx/)

#### Tarefa 2: Replicar secrets no AWS Secrets Manager

**Por que não basta o `.env.local`?**

> O `.env.local` fica só na sua máquina. Quando o código for para o servidor de produção (AWS), ele não tem acesso à sua máquina. O **AWS Secrets Manager** é um cofre na nuvem onde você guarda os secrets com segurança — o servidor de produção acessa o cofre automaticamente.

```
LOCAL (sua máquina):
  .env.local → só você tem acesso ✅ (bom para dev)

PRODUÇÃO (servidor AWS):
  AWS Secrets Manager → servidor acessa o cofre ✅ (bom para prod)
```

**Fontes:**
- [AWS Secrets Manager — O que é e como usar](https://docs.aws.amazon.com/secretsmanager/latest/userguide/intro.html)
- [Boas práticas de gestão de secrets — OWASP](https://cheatsheetseries.owasp.org/cheatsheets/Secrets_Management_Cheat_Sheet.html)

#### Pré-requisito atual: instalar e configurar AWS CLI

O AWS CLI é a ferramenta de linha de comando para controlar a AWS pelo terminal. Para configurar:

```bash
# Passo 1: instalar
brew install awscli

# Passo 2: configurar (você precisará das credenciais IAM da console AWS)
aws configure

# Passo 3: verificar
aws sts get-caller-identity
```

---

## 5. Story 003 — Deploy em ECS Fargate + Observabilidade

**Status:** ✅ Concluída

### O que foi feito?

Deployar a aplicação em um servidor real (nuvem AWS) para que clientes possam acessá-la. Também configurar logs e monitoramento.

**O que é ECS Fargate?**

> É como alugar um quarto em um hotel em vez de comprar uma casa. Você não se preocupa com a infraestrutura (eletricidade, Wi-Fi, segurança) — o hotel cuida. Você só paga pelo quarto enquanto usa. No AWS, Fargate cuida dos servidores enquanto você coda.

**O que foi configurado:**
- Container Docker da aplicação
- Auto-scaling (aumenta/diminui recursos conforme a demanda)
- CloudWatch (logs + alertas)
- Health checks automáticos

---

## 6. Story 004 — Click Ingestion

**Status:** ✅ Concluída (2026-02-21)

### O que foi feito?

Criar o endpoint `POST /api/v1/track/click` que recebe **cliques em anúncios** e salva no banco de dados.

**Rota:** `POST /api/v1/track/click`

**Dados capturados:**
- `fbclid` — Facebook Click ID (identificador único do clique)
- `fbc` — Facebook Container ID
- `fbp` — Facebook Pixel ID
- `utmSource`, `utmMedium`, `utmCampaign` — parâmetros UTM (para rastrear qual anúncio)
- `ip` — IP do usuário (país, cidade)
- `userAgent` — navegador e dispositivo

**Exemplo de requisição:**
```bash
curl -X POST http://localhost:3001/api/v1/track/click \
  -H "x-tenant-id: meu-cliente-id" \
  -H "Content-Type: application/json" \
  -d '{
    "fbclid": "IwAR1234567890abcdefghijk",
    "utmSource": "instagram",
    "utmMedium": "paid",
    "utmCampaign": "verao-2026"
  }'
```

**Resposta (sucesso):**
```json
{
  "ok": true,
  "id": "click-uuid-12345"
}
```

**Validação:** O schema Zod `clickIngestSchema` garante que os dados fazem sentido antes de salvar.

**Testes:** 7 testes cobrindo casos normais, erros, e campos opcionais.

**QA Status:** ✅ PASS (7/7 checks) — pronto para produção.

**Fonte:** [Meta Conversions API — Click Events](https://developers.facebook.com/docs/marketing-api/conversions-api/parameters)

---

## 7. Story 005 — PerfectPay Webhook HMAC-SHA256

**Status:** ✅ Concluída (2026-02-21)

### O que foi feito?

Receber notificações (webhooks) do gateway de pagamento **PerfectPay** quando uma compra é aprovada.

**Rota:** `POST /api/v1/webhooks/perfectpay/:tenantId`

**Por que é importante?**

> Quando alguém compra no PerfectPay, precisamos ser avisados para conectar "essa compra vem do anúncio X". PerfectPay envia essa notificação via webhook — é como um SMS dizendo "compra aprovada! aqui os detalhes".

**Dados recebidos:**
- Identificador da compra (`eventId`)
- Dados do comprador (email, telefone — **hasheados para privacidade**)
- Valor da compra
- Data/hora

**Segurança — HMAC-SHA256:**

```
PerfectPay tem uma senha secreta: "my-webhook-secret"

Quando envia o webhook, ela calcula:
  HMAC = SHA256(secret, dados do evento)

Ela envia: dados + assinatura HMAC

Nossa verificação:
  1. Recebemos dados + assinatura
  2. Calculamos nosso HMAC com NOSSA senha (igual ao de PerfectPay)
  3. Comparamos de forma "timing-safe" (protege contra timing attacks)
  4. Se bater → é legítimo! ✅
  5. Se não bater → falsificação! ❌
```

**Por que "timing-safe"?**

> Um atacante pode medir quanto tempo levou a comparação e deduzir qual caractere está certo. Timing-safe compara sempre no mesmo tempo, independente.

**Validação:** Zod schema `perfectPayWebhookSchema`

**Testes:** 15 testes cobrindo webhook válido, inválido, deduplicação, etc.

**Bug corrigido em 2026-02-21:**
- **Antes:** comparação simples `===` (timing attack vulnerability)
- **Depois:** `crypto.timingSafeEqual()` (seguro contra timing attacks)

**QA Status:** ✅ PASS — pronto para deploy.

**Fontes:**
- [HMAC Explicado — Wikipedia](https://en.wikipedia.org/wiki/HMAC)
- [Timing Attacks — OWASP](https://owasp.org/www-community/attacks/Timing_attack)
- [Crypto Module Node.js](https://nodejs.org/api/crypto.html#crypto_crypto_timingsafeequal_a_b)

---

## 8. Story 006 — Pageview & Checkout Endpoints

**Status:** 🔄 Em validação (2026-02-21)

### O que foi feito?

Criar dois novos endpoints para rastrear a jornada do usuário:
1. `POST /api/v1/track/pageview` — quando usuário chega na página
2. `POST /api/v1/track/initiate_checkout` — quando clica em "Comprar"

**Por quê são importantes?**

```
Jornada do usuário:
  1. Vê anúncio no Instagram
  2. Clica (Story 004 — Click) ← Já rastreamos
  3. Chega na landing page (Story 006 — Pageview) ← NOVO
  4. Scrolleia, lê, se interessa
  5. Clica em "Comprar" (Story 006 — Checkout) ← NOVO
  6. Paga (Story 005 — PerfectPay webhook) ← Já rastreamos
```

Cada etapa nos dá contexto: quanto tempo entre clique e compra? Quantos visitam a página mas não compram?

### Endpoint 1: Pageview

**Rota:** `POST /api/v1/track/pageview`

**Dados capturados:**
- `url` — URL da página (obrigatório)
- `referrer` — de onde veio (Ex: Google, Direct, outro site)
- `title` — título da página
- `utmSource`, `utmMedium`, `utmCampaign`, `utmContent`, `utmTerm` — parâmetros UTM
- `fbclid`, `fbc`, `fbp` — Facebook IDs
- `ip` — IP (automático do servidor)
- `userAgent` — navegador (automático)

**Exemplo:**
```bash
curl -X POST http://localhost:3001/api/v1/track/pageview \
  -H "x-tenant-id: meu-cliente-id" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://exemplo.com/landing-verao",
    "title": "Promoção de Verão 2026",
    "referrer": "https://instagram.com",
    "utmSource": "instagram",
    "utmMedium": "organic"
  }'
```

**Resposta:**
```json
{
  "ok": true,
  "id": "pageview-uuid-54321"
}
```

### Endpoint 2: Checkout (Initiate)

**Rota:** `POST /api/v1/track/initiate_checkout`

**Dados capturados:**
- `cartValue` — valor do carrinho em reais (opcional)
- `currency` — moeda (padrão: BRL)
- `cartItems` — array com detalhes dos itens:
  ```json
  [
    {
      "productId": "shoe-001",
      "productName": "Sapato Azul",
      "quantity": 1,
      "unitPrice": 299.99
    }
  ]
  ```
- `utmSource`, `utmMedium`, `utmCampaign` — parâmetros UTM
- `fbclid`, `fbc`, `fbp` — Facebook IDs
- `ip` — IP (automático)
- `userAgent` — navegador (automático)

**Exemplo:**
```bash
curl -X POST http://localhost:3001/api/v1/track/initiate_checkout \
  -H "x-tenant-id: meu-cliente-id" \
  -H "Content-Type: application/json" \
  -d '{
    "cartValue": 299.99,
    "currency": "BRL",
    "cartItems": [
      {
        "productId": "shoe-001",
        "productName": "Sapato Azul",
        "quantity": 1,
        "unitPrice": 299.99
      }
    ],
    "utmSource": "instagram"
  }'
```

**Resposta:**
```json
{
  "ok": true,
  "id": "checkout-uuid-99999"
}
```

### Padrão Técnico: Dependency Injection

Os handlers (`pageview-handler.ts`, `checkout-handler.ts`) não importam Prisma diretamente. Em vez disso, recebem funções como argumentos:

```typescript
async function handlePageviewIngest(
  tenantId: string,
  body: any,
  ip: string | undefined,
  userAgent: string | undefined,
  deps: {
    findTenant?: (id) => Promise<Tenant | null>,
    createPageview?: (data) => Promise<{ id: string }>
  } = {}
)
```

**Por quê?** Facilita testes. Você pode "mockar" as funções sem tocar no banco real.

### Testes

- **Pageview:** 4 testes
  - Tenant válido + payload válido → 201 OK ✅
  - Tenant inválido → 404 ❌
  - Todos os campos opcionais → salva sem erro ✅
  - Campos mínimos → salva com `url` apenas ✅

- **Checkout:** 5 testes
  - Tenant válido + payload válido → 201 OK ✅
  - Tenant inválido → 404 ❌
  - Todos os campos (incluindo carrinho) → salva com itens ✅
  - Campos mínimos → salva com `currency` apenas ✅
  - Campo `currency` respeitado → USD salvo como USD ✅

**Total:** 9 testes, todos passando ✅

**QA Status:** 🔄 Awaiting @po validation (implementação concluída, pronto para validação de story).

---

## 9. Conceitos Fundamentais

### O que é um Webhook?

> É como uma campainha. Em vez de você ficar checando a cada minuto se chegou correspondência (polling), o carteiro aperta a campainha quando chega (push). No contexto do projeto: quando alguém compra no Hotmart, o Hotmart "aperta a campainha" no nosso servidor enviando os dados da compra.

```
SEM WEBHOOK (polling — ineficiente):
Seu servidor → "Hotmart, teve compra?" → Hotmart: "não"
Seu servidor → "Hotmart, teve compra?" → Hotmart: "não"
Seu servidor → "Hotmart, teve compra?" → Hotmart: "sim! aqui os dados"

COM WEBHOOK (push — eficiente):
Hotmart → "teve uma compra! aqui os dados" → Seu servidor
```

**Fontes:**
- [O que é Webhook? — Explicação do Zapier](https://zapier.com/blog/what-is-a-webhook/)
- [Webhooks vs APIs — Diferença explicada](https://www.redhat.com/pt-br/topics/automation/what-is-a-webhook)

### O que é Multi-tenant?

> É como um prédio de apartamentos. O prédio (seu servidor) é compartilhado, mas cada apartamento (tenant/cliente) tem sua própria chave, seus próprios dados, e não interfere nos outros.

No código, `tenant_id` é o número do apartamento. Toda vez que um dado é salvo, ele é marcado com o `tenant_id` para garantir que um cliente nunca veja os dados de outro.

### O que é SQS (fila de mensagens)?

> É uma esteira de fábrica. Quando chegam 1000 pedidos ao mesmo tempo, você não processa todos ao mesmo tempo (isso quebraria o sistema). Você coloca na esteira, e a esteira entrega um por vez para o processamento.

```
1000 webhooks chegam ao mesmo tempo
         ↓
    [SQS — fila]
         ↓
  Match Engine processa um por vez, sem travar
```

### O que é Dependency Injection?

> É como pedir comida no restaurante. Em vez de você ir para a cozinha e cozinhar (o código cuida), você pede ao garçom e ele traz. O garçom é a "injeção de dependência" — traz o que você precisa.

No código:
```typescript
// ❌ SEM injeção: função cuida de tudo
async function processCheckout() {
  const db = new Database(); // cria o banco aqui
  const user = db.getUser(); // usa o banco
}

// ✅ COM injeção: você recebe o que precisa
async function processCheckout(deps: { database }) {
  const user = deps.database.getUser(); // usa o banco recebido
}
```

**Benefícios:** Testes fica fácil — você "injeta" um banco fake em vez do real.

---

## Próximas Stories (Backlog)

### 📋 Story 007 — Generic Webhook Receiver
**O quê:** Receber webhooks de vários gateways (Hotmart, Kiwify, Stripe, PagSeguro).

### 📋 Story 008 — Match Engine
**O quê:** Conectar "quem comprou" com "qual anúncio viu antes de comprar".

### 📋 Story 009 — SQS Dispatch
**O quê:** Enviar eventos para Meta CAPI via fila AWS SQS (mais confiável que direct POST).

### 📋 Story 010 — Dashboard
**O quê:** Painel web para ver estatísticas (cliques, conversões, ROI).

---

## Glossário

| Termo | Significado simples |
|-------|---------------------|
| **API** | Interface que dois sistemas usam para se comunicar. Como um garçom entre você e a cozinha. |
| **API Gateway** | Portão de entrada centralizado para todas as chamadas de API. |
| **AWS** | Amazon Web Services — serviços de computação em nuvem da Amazon. |
| **CAPI** | Conversions API — o sistema do Meta para receber eventos de conversão pelo servidor. |
| **CLI** | Command Line Interface — programa que você controla digitando comandos no terminal. |
| **Deploy** | Colocar o código no servidor de produção (torná-lo disponível para usuários reais). |
| **ECS Fargate** | Serviço AWS que roda containers sem precisar gerenciar servidores. |
| **endpoint** | URL específica de uma API. Ex: `/api/v1/track/click` é um endpoint. |
| **ENV / .env** | Arquivo com variáveis de ambiente (configurações e senhas do sistema). |
| **IAM** | Identity and Access Management — sistema de permissões da AWS. |
| **Match Rate** | Taxa de correspondência entre cliques e conversões. Quanto maior, melhor. |
| **Migração (banco)** | Mudança controlada na estrutura do banco de dados, com histórico rastreável. |
| **Monorepo** | Repositório único contendo múltiplos projetos relacionados. |
| **Payload** | Os dados enviados em uma requisição. O conteúdo da "encomenda". |
| **Prisma** | Ferramenta que facilita comunicação com banco de dados em Node.js. |
| **Rate Limiting** | Limite de quantas requisições um cliente pode fazer por unidade de tempo. |
| **Redis** | Banco de dados ultra-rápido em memória, usado para cache e controle de acesso. |
| **Secret / API Key** | Senha ou chave de acesso a um serviço externo. |
| **Secrets Manager** | Cofre seguro na nuvem (AWS) para armazenar senhas e chaves. |
| **SQS** | Simple Queue Service — fila de mensagens da AWS. |
| **SSL/TLS** | Protocolo que criptografa a comunicação entre cliente e servidor (o "S" do HTTPS). |
| **Supabase** | Plataforma que fornece banco PostgreSQL hospedado + autenticação + storage. |
| **Tenant** | Um cliente do seu SaaS. Cada empresa/usuário é um tenant. |
| **TypeScript** | JavaScript com tipagem — ajuda a evitar bugs antes do código rodar. |
| **WAF** | Web Application Firewall — sistema que filtra tráfego malicioso. |
| **Webhook** | Notificação automática enviada de um sistema para outro quando algo acontece. |
| **Timing-Safe Comparison** | Comparação de strings que leva o mesmo tempo independente do resultado (protege contra timing attacks). |
| **Dependency Injection (DI)** | Padrão onde funções recebem dependências como argumentos em vez de criá-las dentro. |
| **Hash** | Resumo criptográfico de dados que não pode ser revertido. Ex: email → a1b2c3d4... |
| **LGPD** | Lei Geral de Proteção de Dados — lei brasileira de privacidade. Requer consent e cuidado com dados pessoais. |

---

## Como Contribuir

Se está trabalhando em uma nova story:
1. Complete a implementação e testes
2. Atualize a seção correspondente neste guia
3. Adicione exemplos `curl`
4. Adicione "Fontes" com links para docs oficiais
5. Commit com mensagem: `docs: update GUIDE.md for story-NNN`

---

## Recursos Rápidos

| Necessidade | Link |
|-------------|------|
| Documentação Prisma | https://www.prisma.io/docs/ |
| Documentação Fastify | https://www.fastify.io/docs/ |
| Validação Zod | https://zod.dev/ |
| Meta CAPI | https://developers.facebook.com/docs/marketing-api/conversions-api |
| AWS ECS | https://docs.aws.amazon.com/ecs/ |
| LGPD — Lei | https://www.gov.br/cidadania/pt-br/acesso-a-informacao/lgpd |

---

*Guia mantido pela equipe de desenvolvimento. Última atualização: 2026-02-21 (Story 006).*
