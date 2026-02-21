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

**Status:** 🔄 Em andamento

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

## 5. Conceitos Fundamentais

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

---

*Guia mantido automaticamente. Última atualização: Story 002 em andamento.*
