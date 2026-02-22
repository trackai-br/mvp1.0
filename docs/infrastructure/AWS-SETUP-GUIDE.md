# AWS Infrastructure Setup Guide

## Overview

Este guia configura a infraestrutura AWS necessária para rodar o backend `hub-server-side-tracking-api` em produção.

**Arquitetura:**
- **ECR** → Armazena imagem Docker do backend
- **ECS Fargate** → Roda container do backend (sem gerenciar servidores)
- **RDS PostgreSQL** → Banco de dados relacional (Prisma)
- **ElastiCache Redis** → Cache distribuído
- **Security Groups** → Firewall entre componentes
- **IAM Roles** → Permissões para ECS acessar ECR, RDS, Redis

**Timeline:** ~30-45 minutos (com AWS credentials prontos)

---

## Pré-Requisitos

### 1. Ter AWS Account Ativo
- AWS Account ID (12 dígitos)
- User IAM com permissão `AdministratorAccess` (ou política customizada abaixo)

### 2. Ferramentas Instaladas Localmente
```bash
# AWS CLI v2
aws --version  # >= 2.13.0

# Terraform (opcional mas recomendado)
terraform --version  # >= 1.0

# GitHub CLI (para configurar secrets)
gh --version
```

### 3. Credenciais AWS Configuradas
```bash
aws configure
# Vai pedir:
# AWS Access Key ID: [seu access key]
# AWS Secret Access Key: [seu secret key]
# Default region: us-east-1
# Default output format: json
```

---

## Opção A: Setup Automático com Terraform ⭐ RECOMENDADO

### 1. Criar Terraform Directory
```bash
cd /Users/guilhermesimas/Documents/hub-server-side-tracking
mkdir -p infrastructure/terraform
cd infrastructure/terraform
```

### 2. Copiar Terraform Templates
Os arquivos `main.tf`, `variables.tf`, `outputs.tf` estão em `docs/infrastructure/terraform/`.

### 3. Configurar Variables
```bash
# Copiar exemplo
cp terraform.tfvars.example terraform.tfvars

# Editar valores
cat terraform.tfvars
```

Expected content:
```hcl
aws_region            = "us-east-1"
aws_account_id        = "123456789012"  # SUA ACCOUNT ID
app_name              = "hub-server-side-tracking"
environment           = "production"
rds_instance_class    = "db.t4g.micro"    # 1 vCPU, 1GB RAM, ~$0.06/h
rds_allocated_storage = 20                 # 20 GB storage
redis_node_type       = "cache.t4g.micro"  # 1 vCPU, 0.5GB RAM, ~$0.015/h
```

### 4. Validar Terraform
```bash
terraform init
terraform plan
# Revise o output para confirmar que vai criar:
# - 1x ECR repository
# - 1x ECS cluster
# - 1x ECS service
# - 1x RDS PostgreSQL database
# - 1x ElastiCache Redis cluster
# - Security groups, IAM roles, etc.
```

### 5. Aplicar Terraform
```bash
terraform apply
# Digitar 'yes' quando pedir confirmação
# Vai levar ~10-15 minutos
# Output mostrará:
# - ECR repository URL
# - RDS endpoint
# - Redis endpoint
# - ECS cluster name
```

### 6. Copiar Outputs
```bash
terraform output -json > outputs.json
# Guardar esses valores para próxima etapa
```

---

## Opção B: Setup Manual via AWS Console

Se preferir não usar Terraform (mais lento, mais steps):

### 1. Criar ECR Repository
```bash
aws ecr create-repository \
  --repository-name hub-server-side-tracking-api \
  --region us-east-1

# Output incluirá:
# repositoryUri: 123456789012.dkr.ecr.us-east-1.amazonaws.com/hub-server-side-tracking-api
# Guardar esse valor
```

### 2. Criar RDS PostgreSQL
```bash
aws rds create-db-instance \
  --db-instance-identifier hub-api-db \
  --db-instance-class db.t4g.micro \
  --engine postgres \
  --engine-version 16.1 \
  --master-username postgres \
  --master-user-password "GERA_SENHA_FORTE_AQUI_32_CHARS" \
  --allocated-storage 20 \
  --storage-type gp3 \
  --backup-retention-period 7 \
  --multi-az false \
  --publicly-accessible false \
  --region us-east-1

# Vai levar ~5-10 minutos
# Quando pronto, pegar endpoint:
aws rds describe-db-instances \
  --db-instance-identifier hub-api-db \
  --region us-east-1 \
  --query 'DBInstances[0].Endpoint.Address'
```

### 3. Criar Redis ElastiCache
```bash
aws elasticache create-cache-cluster \
  --cache-cluster-id hub-api-redis \
  --cache-node-type cache.t4g.micro \
  --engine redis \
  --engine-version 7.0 \
  --num-cache-nodes 1 \
  --region us-east-1

# Vai levar ~3-5 minutos
# Quando pronto, pegar endpoint:
aws elasticache describe-cache-clusters \
  --cache-cluster-id hub-api-redis \
  --show-cache-node-info \
  --region us-east-1 \
  --query 'CacheClusters[0].CacheNodes[0].Endpoint'
```

### 4. Criar ECS Cluster
```bash
aws ecs create-cluster \
  --cluster-name hub-cluster \
  --region us-east-1
```

### 5. Criar IAM Role para ECS
Copiar policy abaixo em `docs/infrastructure/iam-policy-ecs.json` e aplicar:

```bash
aws iam create-role \
  --role-name ecsTaskRole \
  --assume-role-policy-document file://docs/infrastructure/iam-trust-policy.json

aws iam put-role-policy \
  --role-name ecsTaskRole \
  --policy-name ecs-task-policy \
  --policy-document file://docs/infrastructure/iam-policy-ecs.json
```

### 6. Criar ECS Task Definition
Usar template em `docs/infrastructure/ecs-task-definition.json` (próxima seção).

---

## Etapa 3: Configurar GitHub Secrets

Após ter AWS infrastructure pronta, configure secrets no GitHub:

```bash
# Entrar no diretório do projeto
cd /Users/guilhermesimas/Documents/hub-server-side-tracking

# Configurar secrets (vai pedir interativamente)
gh secret set AWS_ACCESS_KEY_ID --body "AKIA..."
gh secret set AWS_SECRET_ACCESS_KEY --body "wJal..."
gh secret set AWS_REGION --body "us-east-1"
gh secret set ECR_REPOSITORY --body "hub-server-side-tracking-api"
gh secret set ECS_CLUSTER --body "hub-cluster"
gh secret set ECS_SERVICE --body "hub-api-service"
gh secret set ECS_TASK_DEFINITION --body "hub-api-task"
```

Ou via GitHub UI:
1. Ir para: `Settings → Secrets and variables → Actions → New repository secret`
2. Adicionar cada secret manualmente

---

## Etapa 4: Criar ECS Task Definition

Usar template em `docs/infrastructure/ecs-task-definition.json`:

```bash
# Registrar task definition no ECS
aws ecs register-task-definition \
  --cli-input-json file://docs/infrastructure/ecs-task-definition.json \
  --region us-east-1

# Confirmar
aws ecs describe-task-definition \
  --task-definition hub-api-task \
  --region us-east-1
```

---

## Etapa 5: Criar ECS Service

```bash
aws ecs create-service \
  --cluster hub-cluster \
  --service-name hub-api-service \
  --task-definition hub-api-task:1 \
  --desired-count 1 \
  --launch-type FARGATE \
  --network-configuration "awsvpcConfiguration={subnets=[subnet-xxx,subnet-yyy],securityGroups=[sg-zzz],assignPublicIp=ENABLED}" \
  --region us-east-1

# Monitorar
aws ecs describe-services \
  --cluster hub-cluster \
  --services hub-api-service \
  --region us-east-1
```

---

## Etapa 6: Testar Deploy via GitHub Actions

Fazer push para `main` para disparar CI/CD:

```bash
git add .
git commit -m "Configure AWS infrastructure for ECS Fargate deployment"
git push origin main
```

GitHub Actions vai:
1. ✅ Rodar quality gates (lint, typecheck, tests)
2. ✅ Build Docker image
3. ✅ Push para ECR
4. ✅ Atualizar ECS service (nova versão)
5. ✅ Esperar service stabilize
6. ✅ Enviar notificação (Slack, se configurado)

Monitorar em: `GitHub → Actions → CI/CD - Build & Deploy to ECS Fargate`

---

## Etapa 7: Configurar Environment Variables no ECS

O ECS task definition precisa de variáveis de ambiente:

```json
"environment": [
  { "name": "NODE_ENV", "value": "production" },
  { "name": "DATABASE_URL", "value": "postgresql://postgres:SENHA@hub-api-db.xxxxxx.rds.amazonaws.com:5432/hub_db" },
  { "name": "REDIS_URL", "value": "redis://hub-api-redis.xxxxxx.cache.amazonaws.com:6379" },
  { "name": "META_GRAPH_API_BASE", "value": "https://graph.instagram.com/v18.0" },
  { "name": "KIWIFY_API_BASE", "value": "https://api.kiwify.com.br" },
  { "name": "HOTMART_API_BASE", "value": "https://api.sandbox.hotmart.com" },
  { "name": "PERFECTPAY_API_BASE", "value": "https://api-sandbox.perfectpay.com" }
],
"secrets": [
  { "name": "META_BUSINESS_ACCOUNT_ID", "valueFrom": "arn:aws:secretsmanager:us-east-1:123456789012:secret:hub/meta-business-id::" },
  { "name": "PERFECTPAY_API_KEY", "valueFrom": "arn:aws:secretsmanager:us-east-1:123456789012:secret:hub/perfectpay-api-key::" }
]
```

Para armazenar secrets com segurança, usar AWS Secrets Manager:

```bash
aws secretsmanager create-secret \
  --name hub/meta-business-id \
  --secret-string "123456789" \
  --region us-east-1

aws secretsmanager create-secret \
  --name hub/perfectpay-api-key \
  --secret-string "sk_live_xxx" \
  --region us-east-1
```

---

## Troubleshooting

### ECS Task não inicia
```bash
# Ver logs do task
aws ecs describe-tasks \
  --cluster hub-cluster \
  --tasks arn:aws:ecs:us-east-1:123456789012:task/hub-api-task/xxx \
  --region us-east-1

# Ver stopped reason
aws logs get-log-events \
  --log-group-name /ecs/hub-api-task \
  --log-stream-name ecs/hub-api-task/xxx \
  --region us-east-1
```

### RDS connection timeout
```bash
# Verificar security group
aws ec2 describe-security-groups \
  --group-ids sg-xxx \
  --region us-east-1

# Deve permitir port 5432 da ECS security group
```

### ECR push fails
```bash
# Verificar credentials
aws ecr get-login-password --region us-east-1 | \
  docker login --username AWS --password-stdin 123456789012.dkr.ecr.us-east-1.amazonaws.com
```

---

## Custos Estimados (Monthly)

| Service | Instance | Estimate |
|---------|----------|----------|
| ECS Fargate | 0.25 vCPU, 512MB RAM, 730h | ~$3.33 |
| RDS PostgreSQL | db.t4g.micro, 20GB storage | ~$9.50 |
| ElastiCache Redis | cache.t4g.micro | ~$13.50 |
| NAT Gateway | Data processed | ~$10-20 |
| **Total** | — | **~$36-46/month** |

Para production com redundancy (Multi-AZ): +50-100% no custo.

---

## Próximos Passos

1. ✅ Fornecer AWS credentials (Account ID, Access Key ID, Secret Key)
2. ✅ Rodar Terraform ou commands manuais (Opção A ou B)
3. ✅ Configurar GitHub Secrets
4. ✅ Fazer push para `main` (dispara GitHub Actions)
5. ✅ Monitorar ECS service até "RUNNING"
6. ✅ Testar API:
   ```bash
   curl https://[ALB_DNS]/api/v1/health
   ```
7. ✅ Configurar DNS (Route 53 ou seu registrador) → ALB DNS

---

## Referências

- [AWS ECS Fargate Documentation](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/launch_types.html#launch-type-fargate)
- [Terraform AWS Provider](https://registry.terraform.io/providers/hashicorp/aws/latest/docs)
- [GitHub Actions AWS Setup](https://github.com/aws-actions)
