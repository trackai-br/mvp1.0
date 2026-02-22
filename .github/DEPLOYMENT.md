# Deployment Configuration

Este arquivo documenta como configurar o GitHub Actions para deploy automático.

## 🔐 GitHub Secrets Required

Vá para `Settings → Secrets and Variables → Actions` e configure:

### AWS Credentials
- **`AWS_ACCESS_KEY_ID`** — AWS IAM user access key
- **`AWS_SECRET_ACCESS_KEY`** — AWS IAM user secret key
- **`AWS_REGION`** — AWS region (ex: `us-east-1`)

### ECR Configuration
- **`ECR_REPOSITORY`** — ECR repository name (ex: `hub-server-side-tracking-api`)

### ECS Configuration
- **`ECS_CLUSTER`** — ECS cluster name (ex: `hub-cluster`)
- **`ECS_SERVICE`** — ECS service name (ex: `hub-api-service`)
- **`ECS_TASK_DEFINITION`** — ECS task definition name (ex: `hub-api-task`)

### Optional: Vercel Frontend Deployment
- **`VERCEL_TOKEN`** — Vercel API token
- **`VERCEL_ORG_ID`** — Vercel organization ID
- **`VERCEL_PROJECT_ID`** — Vercel project ID

### Optional: Slack Notifications
- **`SLACK_WEBHOOK_URL`** — Slack incoming webhook URL

## 🔄 GitHub Variables (Optional)

Configure variáveis de ambiente em `Settings → Secrets and Variables → Variables`:

- **`SLACK_WEBHOOK_URL`** — Se quiser notificações no Slack

## 📋 Workflow Steps

O workflow executa os seguintes passos automaticamente ao fazer push para `main`:

### 1. Quality Gates (sempre)
```
- ESLint check
- TypeScript type checking
- Unit tests (Vitest)
```

### 2. Build (se quality passou)
```
- Build JavaScript/TypeScript
- Build Docker image
- Push para ECR (apenas em main)
```

### 3. Deploy (se build passou e é push em main)
```
- Fetch current ECS task definition
- Update task definition com nova imagem
- Register nova task definition
- Update ECS service com nova task definition
- Wait for service to stabilize
```

### 4. Frontend Deploy (Vercel, opcional)
```
- Deploy apps/web para Vercel Production
```

### 5. Notifications
```
- Envia notificação no Slack (opcional)
```

## 🚀 How to Trigger Deployment

### Automatic (on push to main)
```bash
git push origin main
```
O workflow dispara automaticamente e faz todo o processo: test → build → deploy

### Manual Workflow Dispatch (opcional)
No GitHub, vá para Actions e clique "Run workflow" no workflow desejado.

## 📊 Monitoring

Vá para `Actions` tab no GitHub para:
- Ver status em tempo real de cada job
- Ver logs completos de cada step
- Rerun jobs se necessário
- Ver histórico de deployments

## ✅ Checklist para Setup

- [ ] Criar usuário IAM na AWS com permissões para ECR e ECS
- [ ] Gerar access key e secret key do IAM user
- [ ] Criar ECR repository
- [ ] Criar ECS cluster e service
- [ ] Criar ECS task definition com container name `hub-api`
- [ ] Configurar AWS_REGION, ECR_REPOSITORY, ECS_CLUSTER, ECS_SERVICE secrets
- [ ] Testar workflow disparando um push para main
- [ ] (Opcional) Configurar Vercel se usando Next.js frontend
- [ ] (Opcional) Configurar Slack webhook para notificações

## 🔒 Security Best Practices

1. **IAM Permissions:** Use principle of least privilege
   ```json
   {
     "Version": "2012-10-17",
     "Statement": [
       {
         "Effect": "Allow",
         "Action": [
           "ecr:GetAuthorizationToken",
           "ecr:BatchCheckLayerAvailability",
           "ecr:GetDownloadUrlForLayer",
           "ecr:PutImage",
           "ecr:InitiateLayerUpload",
           "ecr:UploadLayerPart",
           "ecr:CompleteLayerUpload"
         ],
         "Resource": "arn:aws:ecr:*:*:repository/hub-*"
       },
       {
         "Effect": "Allow",
         "Action": [
           "ecs:UpdateService",
           "ecs:DescribeServices",
           "ecs:DescribeTaskDefinition",
           "ecs:DescribeTask",
           "ecs:ListTasks",
           "ecs:RegisterTaskDefinition"
         ],
         "Resource": "*"
       }
     ]
   }
   ```

2. **Secrets Rotation:** Rotate AWS keys periodically (monthly recommended)

3. **Branch Protection:** Configure main branch to require:
   - Pull request review before merge
   - Status checks passing (quality gates)
   - Dismiss stale PR approvals

## 📝 Environment Variables in ECS

Certifique-se de que o ECS task definition tem as variáveis de ambiente necessárias:

```json
{
  "name": "hub-api",
  "image": "...",
  "environment": [
    { "name": "NODE_ENV", "value": "production" },
    { "name": "DATABASE_URL", "value": "..." },
    { "name": "REDIS_URL", "value": "..." },
    { "name": "META_GRAPH_API_BASE", "value": "..." }
  ],
  "secrets": [
    { "name": "META_BUSINESS_ACCOUNT_ID", "valueFrom": "arn:aws:secretsmanager:..." },
    { "name": "PERFECTPAY_API_KEY", "valueFrom": "arn:aws:secretsmanager:..." }
  ]
}
```

## 🐛 Troubleshooting

### Workflow fails at "Build and push Docker image"
- Verificar AWS credentials na secrets
- Verificar que ECR repository existe em AWS
- Verificar que IAM user tem permissões para ECR

### Workflow fails at "Update ECS service"
- Verificar que ECS cluster existe
- Verificar que ECS service existe no cluster
- Verificar que task definition existe
- Verificar AWS permissions para ECS

### Vercel deployment fails
- Verificar VERCEL_TOKEN é válido
- Verificar VERCEL_ORG_ID e VERCEL_PROJECT_ID corretos
- Verificar que projeto no Vercel está linked com repositório

### Slack notification doesn't send
- Verificar SLACK_WEBHOOK_URL é válido
- Verificar que webhook está ativo no Slack workspace
- Webhook URL é sensível, não compartilhar publicamente

## 📚 References

- [GitHub Actions Documentation](https://docs.github.com/actions)
- [AWS ECR Push Action](https://github.com/aws-actions/amazon-ecr-login)
- [Amazon ECS Render Task Definition](https://github.com/aws-actions/amazon-ecs-render-task-definition)
- [Vercel GitHub Action](https://github.com/vercel/action)
