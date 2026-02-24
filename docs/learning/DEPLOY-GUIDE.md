# 🚀 Deploy Guide — Story 011a (PerfectPay Webhook Production Deploy)

**Data:** 2026-02-24
**Commit:** `48a2a9a` (fix) + `d0a56d0` (story 011a)
**Status:** ✅ Workflow em execução

---

## 📋 Arquitetura de Deploy (CI/CD Pipeline)

### O que é?
Um **pipeline automatizado** que:
1. Testa seu código (lint, type-check, testes)
2. Compila e empacota em Docker
3. Envia para AWS ECR (registro de imagens)
4. Atualiza ECS Fargate para usar a nova versão

### Vantagem?
**Sem Docker local** — tudo roda na nuvem, reproduzível, auditável.

```
┌─────────────────────────────────────────────────────────┐
│                   GitHub (seu código)                    │
├─────────────────────────────────────────────────────────┤
│  ↓ git push origin main                                  │
├─────────────────────────────────────────────────────────┤
│         GitHub Actions (máquina virtual Ubuntu)          │
│  ┌───────────────────────────────────────────────────┐   │
│  │ 1️⃣  QUALITY (15 min)                              │   │
│  │    • npm run lint                                  │   │
│  │    • npm run typecheck                             │   │
│  │    • npm run test                                  │   │
│  └───────────────────────────────────────────────────┘   │
│                        ↓ (se passou)                      │
│  ┌───────────────────────────────────────────────────┐   │
│  │ 2️⃣  BUILD (20 min)                                │   │
│  │    • docker build (Dockerfile)                     │   │
│  │    • docker push → ECR                             │   │
│  │    • Tag: git SHA (ex: 48a2a9a) + latest          │   │
│  └───────────────────────────────────────────────────┘   │
│                        ↓ (se passou)                      │
│  ┌───────────────────────────────────────────────────┐   │
│  │ 3️⃣  DEPLOY (15 min)                               │   │
│  │    • AWS ECS: atualizar service                    │   │
│  │    • Rollout: trazer 2+ novas replicas             │   │
│  │    • Health Check: aguardar estabilizar            │   │
│  └───────────────────────────────────────────────────┘   │
├─────────────────────────────────────────────────────────┤
│ 🔔 Notificação: Slack (opcional)                         │
└─────────────────────────────────────────────────────────┘
         ↓
    🎯 LIVE em Produção
    https://api.hub-tracking.com/api/v1/webhooks/perfectpay
```

---

## 🎯 O que está acontecendo AGORA

### Passo 1: Test Fix (Story 008)
```
Commit: 48a2a9a "fix: correct async test assertion..."
Status: EXECUTANDO AGORA (Quality gates)

O teste estava retornando Promise sem await.
Corrigido para verificar typeof matchConversion == 'function'
Estimado: 15 min
```

### Passo 2: Deploy Story 011a (Depois)
```
Commit: d0a56d0 "feat: add story 011a..."
Status: AGUARDANDO (vai rodar após Step 1 passar)

Vai fazer deploy da correção de timing-safe HMAC
do webhook do PerfectPay.
Estimado: 50 min total
```

---

## 📊 Monitorar em Tempo Real

### Opção 1: GitHub Web UI
```
https://github.com/trackai-br/mvp1.0/actions
↓
Clique em "CI/CD - Build & Deploy to ECS Fargate"
↓
Veja o run mais recente (verde = passou, vermelho = falhou)
```

### Opção 2: Terminal (CLI)
```bash
# Listar últimos 3 runs
gh run list -R trackai-br/mvp1.0 --branch main -L 3

# Ver status detalhado de um run específico
gh run view {RUN_ID} -R trackai-br/mvp1.0

# Stream de logs em tempo real
gh run view {RUN_ID} -R trackai-br/mvp1.0 --log-failed
```

### Opção 3: Verificar Endpoint (Depois do Deploy)
```bash
# Teste o webhook em produção
curl -X POST https://api.hub-tracking.com/api/v1/webhooks/perfectpay/tenant-xxx \
  -H "x-perfectpay-signature: {HMAC_SHA256_HASH}" \
  -H "Content-Type: application/json" \
  -d '{...}'

# Esperado: 202 Accepted (< 200ms)
```

---

## 🔑 Conceitos-Chave

### HMAC-SHA256 (PerfectPay Security)
- **O que é:** Assinatura criptográfica da requisição
- **Para que serve:** Provar que a requisição veio do PerfectPay (autenticação + integridade)
- **Como:** PerfectPay gera `HMAC_SHA256(request_body, secret_key)` e envia no header
- **Nós validamos:** Regeneramos HMAC e comparamos (timing-safe para evitar timing attacks)

### Timing-Safe Comparison
```javascript
// ERRADO (vulnerável a timing attacks):
if (providedHmac === calculatedHmac) { ... }
// Tempo varia conforme primeiro byte diferente

// CORRETO (timing-safe):
crypto.timingSafeEqual(Buffer.from(providedHmac), Buffer.from(calculatedHmac))
// Tempo constante, não varia com a posição da diferença
```

### ECR (Elastic Container Registry)
- **O que é:** Registro de imagens Docker na AWS
- **URI do nosso ECR:** `571944667101.dkr.ecr.us-east-1.amazonaws.com/hub-server-side-tracking-api`
- **Como funciona:** GitHub Actions faz login → compila Docker → push → ECS usa a imagem

### ECS Fargate (Containers na Nuvem)
- **Cluster:** `hub-server-side-tracking-cluster`
- **Service:** `hub-server-side-tracking-service`
- **Task:** Define quantas replicas rodam (nosso: 2+ para alta disponibilidade)
- **Rollout:** Substituir replicas antigas por novas gradualmente (zero downtime)

---

## 📝 Glossário

| Termo | Significa | Exemplo |
|-------|-----------|---------|
| **commit** | Snapshot de código com mensagem | `48a2a9a` ou "feat: add story 011a" |
| **push** | Enviar commits para GitHub | `git push origin main` |
| **workflow** | Sequência automática de jobs | CI/CD pipeline |
| **job** | Etapa do workflow | "Quality", "Build", "Deploy" |
| **artifact** | Arquivo gerado (logs, binários, coverage) | test-results.zip |
| **task definition** | Configuração da aplicação em ECS | CPU, memória, env vars, portas |
| **rollout** | Processo de substituição de replicas | Antiga → Nova gradualmente |
| **DLQ** | Dead Letter Queue (fila de erros) | Mensagens que não conseguiram ser processadas |

---

## ✅ Próximos Passos (Automáticos)

```
[ 1 ] Quality gates passando
[ 2 ] Docker image buildada e enviada para ECR
[ 3 ] ECS service atualizado
[ 4 ] 2+ replicas novas ligadas
[ 5 ] Health checks passando
[ 6 ] Tráfego redirecionado para nova versão
[ 7 ] Replicas antigas desligadas
[ 8 ] ✅ LIVE EM PRODUÇÃO
```

---

## 🚨 Se algo der errado

### Cenário 1: Quality Gates Falham
```
Causa: Testes falhando, linting ou type-check
Ação: Volta para @dev, investigar erro, commitar fix
```

### Cenário 2: Build Falha
```
Causa: Dockerfile errando, dependência faltando
Ação: Checklar logs de "Build Docker Image" step
```

### Cenário 3: Deploy Falha
```
Causa: ECS service não conseguindo trocar replicas
Ação: Verificar CloudWatch logs, status do ECS
Rollback: aws ecs update-service ... com imagem anterior
```

---

## 🎓 Aprender Mais

### Documentação Oficial
- [GitHub Actions](https://docs.github.com/en/actions)
- [AWS ECS Fargate](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/)
- [Docker Best Practices](https://docs.docker.com/develop/dev-best-practices/)
- [HMAC-SHA256 Security](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html)

### Ferramentas
- `gh` — GitHub CLI (status de workflows, PRs, releases)
- `aws ecs` — AWS CLI para ECS
- `docker` — Build e push local (optional, não necessário para deploy)

---

**Última atualização:** 2026-02-24
**Próxima revisão:** Quando Story 011b (Hotmart webhook) começar
