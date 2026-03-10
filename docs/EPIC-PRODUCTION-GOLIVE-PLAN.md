# 🚀 EPIC: Full Production Go-Live with Complete E2E Testing
**Status:** PLANNING
**Target Duration:** 8 hours
**Approach:** Opção 3 — Máximo Controle com Documentação Completa

---

## 📋 OBJETIVO GERAL

Levar o Hub Server-Side Tracking para **PRODUÇÃO TOTAL** com:
- ✅ API deployada em AWS (ECS/RDS/SQS)
- ✅ Frontend deployado em AWS (CloudFront/S3)
- ✅ Teste E2E completo (4 passos do wizard + webhook)
- ✅ Integração PerfectPay real (sandbox)
- ✅ Documentação de runbook
- ✅ Materiais de treinamento
- ✅ Plano de monitoramento

---

## 📊 FASES DO PROJETO (8 horas)

### **FASE 1: Preparação & Arquitetura (1.5 horas)**
**Objetivo:** Planejar infraestrutura, validar credenciais AWS, preparar checklist

**Stories:**
- [ ] Story 1.1 — Validar AWS Account & Infraestrutura Existente
- [ ] Story 1.2 — Preparar Environment Variables & Secrets
- [ ] Story 1.3 — Criar Infraestrutura as Code (Terraform/CloudFormation)
- [ ] Story 1.4 — Checklist de Pré-Deploy

**Entregáveis:**
- ✅ `docs/PRODUCTION-INFRASTRUCTURE.md` — Diagrama e config
- ✅ `infra/terraform/` — IaC pronto
- ✅ `docs/DEPLOYMENT-CHECKLIST.md` — Verificação antes de deploy

---

### **FASE 2: Deploy Backend em Produção (1.5 horas)**
**Objetivo:** API + Database + Message Queue rodando em produção

**Stories:**
- [ ] Story 2.1 — Build & Push Docker Image para ECR
- [ ] Story 2.2 — Deploy ECS Service com DB Connection
- [ ] Story 2.3 — Validar Health Checks & Logs CloudWatch
- [ ] Story 2.4 — Configurar SQS para Meta CAPI Dispatch

**Entregáveis:**
- ✅ API rodando em: `https://api-prod.track-ai.com`
- ✅ Logs em CloudWatch
- ✅ Database conectado

---

### **FASE 3: Deploy Frontend em Produção (1 hora)**
**Objetivo:** Frontend Next.js rodando em CloudFront + S3

**Stories:**
- [ ] Story 3.1 — Build Next.js para Produção
- [ ] Story 3.2 — Deploy em S3 + CloudFront
- [ ] Story 3.3 — Validar CORS & API Endpoints

**Entregáveis:**
- ✅ Frontend rodando em: `https://onboard.track-ai.com`
- ✅ Conectado à API de produção

---

### **FASE 4: Teste E2E Completo com Wizard (2 horas)**
**Objetivo:** Executar manualmente os 4 passos do wizard + webhook

**Stories:**
- [ ] Story 4.1 — PASSO 1: Instalar Script (GTM ou Manual)
- [ ] Story 4.2 — PASSO 2: Conectar Meta Pixel
- [ ] Story 4.3 — PASSO 3: Configurar PerfectPay Gateway
- [ ] Story 4.4 — PASSO 4: Receber Webhook & Verificar Match

**Entregáveis:**
- ✅ `docs/WIZARD-E2E-TEST-RESULTS.md` — Resultados completos
- ✅ Screenshots de cada passo
- ✅ Curl commands usados

---

### **FASE 5: Documentação & Runbook (1.5 horas)**
**Objetivo:** Criar documentação passo-a-passo para futuras onboardings

**Stories:**
- [ ] Story 5.1 — Criar RUNBOOK-DEPLOYMENT.md
- [ ] Story 5.2 — Criar RUNBOOK-TROUBLESHOOTING.md
- [ ] Story 5.3 — Criar TRAINING-MATERIALS.md
- [ ] Story 5.4 — Criar ARCHITECTURE-DIAGRAMS.md

**Entregáveis:**
- ✅ `docs/RUNBOOK-DEPLOYMENT.md` — Passo-a-passo de deploy
- ✅ `docs/RUNBOOK-TROUBLESHOOTING.md` — Soluções de problemas
- ✅ `docs/TRAINING-GUIDE.md` — Material de treinamento
- ✅ `docs/ARCHITECTURE-PROD.md` — Diagrama visual

---

### **FASE 6: Validação Final & Monitoramento (0.5 horas)**
**Objetivo:** Setup de alertas, verificação final, sign-off

**Stories:**
- [ ] Story 6.1 — Configurar CloudWatch Alarms
- [ ] Story 6.2 — Setup PagerDuty Alerts
- [ ] Story 6.3 — Verificação Final (Smoke Test)
- [ ] Story 6.4 — Go-Live Sign-Off

**Entregáveis:**
- ✅ Alertas configurados
- ✅ Smoke test passando
- ✅ Sign-off documentado

---

## 🎯 SUCESSO = TODOS OS CRITÉRIOS ABAIXO

### ✅ Backend em Produção
- [ ] API respondendo em `https://api-prod.track-ai.com/api/v1/health`
- [ ] Database conectado (Supabase Production)
- [ ] SQS configurado para Meta CAPI
- [ ] CloudWatch logs capturando eventos

### ✅ Frontend em Produção
- [ ] Wizard carregando em `https://onboard.track-ai.com`
- [ ] Conectado à API de produção
- [ ] SSL/TLS válido
- [ ] Performance < 3s load time

### ✅ Teste E2E Completo
- [ ] Passo 1: Script instalado (GTM ou manual)
- [ ] Passo 2: Meta Pixel conectado
- [ ] Passo 3: PerfectPay configurado
- [ ] Passo 4: Webhook testado com sucesso
- [ ] Match log criado (click → conversion)
- [ ] Dispatch para Meta CAPI iniciado

### ✅ Documentação Completa
- [ ] Runbook de deployment
- [ ] Guia de troubleshooting
- [ ] Materiais de treinamento
- [ ] Diagramas de arquitetura

### ✅ Monitoramento em Lugar
- [ ] CloudWatch alarms configurados
- [ ] PagerDuty integrado
- [ ] Smoke test automatizado
- [ ] Logs centralizados

---

## 📅 TIMELINE ESTIMADA

| Fase | Duração | Agente Responsável | Status |
|------|---------|-------------------|--------|
| 1. Preparação | 1.5h | @architect + @devops | Pendente |
| 2. Backend Deploy | 1.5h | @devops | Pendente |
| 3. Frontend Deploy | 1h | @devops | Pendente |
| 4. Teste E2E | 2h | @qa + Usuário | Pendente |
| 5. Documentação | 1.5h | @pm + Documentação | Pendente |
| 6. Validação Final | 0.5h | @devops + @qa | Pendente |
| **TOTAL** | **8h** | Multi-agent | **Ready** |

---

## 🚀 PRÓXIMOS PASSOS

1. **Sua Aprovação:** Você aprova este plano?
2. **Início:** Começamos pela FASE 1 (Preparação)
3. **Execução:** Cada story será executada sequencialmente
4. **Validação:** Após cada fase, validamos antes de continuar

---

**Status:** Aguardando sua aprovação para iniciar!

