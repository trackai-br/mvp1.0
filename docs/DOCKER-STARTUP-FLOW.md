# Docker Startup Flow - Diagnóstico e Resolução

## Problema Identificado

O container falhava em crash loop porque:
- `DATABASE_URL` não era injetada pelo ECS task definition
- `npx prisma migrate deploy` falhava silenciosamente
- Logs eram insuficientes para diagnóstico

## Solução Implementada

### 1. Script de Entrypoint Robusto

**Arquivo:** `apps/api/entrypoint.sh`

**Fluxo:**
```
┌─ Aguarda 5s (ECS injeta secrets)
├─ Valida DATABASE_URL existe
├─ Testa conectividade RDS
├─ Executa Prisma migrations
└─ Inicia servidor Node.js
```

**Validações:**
- ✅ DATABASE_URL definida
- ✅ Conectividade RDS testada
- ✅ Migrations executadas com sucesso
- ✅ Servidor inicia apenas se tudo ok

### 2. Dockerfile Otimizado

**Arquivo:** `apps/api/Dockerfile`

**Mudanças:**
```dockerfile
# Copia script de entrypoint
COPY apps/api/entrypoint.sh /app/entrypoint.sh
RUN chmod +x /app/entrypoint.sh

# Usa entrypoint para startup robusta
ENTRYPOINT ["/app/entrypoint.sh"]
```

### 3. Task Definition (ECS)

**Obrigatório no ECS Task Definition:**
```json
{
  "name": "DATABASE_URL",
  "valueFrom": "arn:aws:secretsmanager:us-east-1:751702759697:secret:rds-postgres-connection-string-7YxrZs"
}
```

**Status:** ✅ Já configurado (verificar em `aws ecs describe-task-definition`)

## Fluxo de Startup Esperado

```
1. ECS lança container
2. Docker executa ENTRYPOINT: /app/entrypoint.sh
3. Script aguarda 5s (secrets injetadas)
4. Valida DATABASE_URL
5. Testa conectividade RDS
6. Executa: npx prisma migrate deploy
7. Inicia: node dist/server.js
8. Health check passa: GET /api/v1/health → 200 OK
```

## Diagnóstico de Problemas

### Problema: "DATABASE_URL not found"

**Causa:** ECS task definition não tem SECRET referenciando Secrets Manager

**Solução:**
```bash
# Verificar task definition atual
aws ecs describe-task-definition \
  --task-definition hub-server-side-tracking-api \
  --query 'taskDefinition.containerDefinitions[0].secrets' \
  --output json
```

**Deve conter:**
```json
{
  "name": "DATABASE_URL",
  "valueFrom": "arn:aws:secretsmanager:..."
}
```

### Problema: "Connect ECONNREFUSED 10.0.11.x:5432"

**Causa:** RDS não está acessível da subnet privada

**Diagnóstico:**
```bash
# Verificar security groups
aws ec2 describe-security-groups \
  --filter Name=group-id,Values=sg-0f902b4d5894e8fc9 \
  --query 'SecurityGroups[0].IpPermissions'
```

**Deve permitir:** Inbound 5432 de ECS Security Group

### Problema: "Prisma migrations pending"

**Causa:** Migrations não foram executadas no RDS

**Solução Manual:**
```bash
export DATABASE_URL="postgresql://postgres:PASSWORD@endpoint:5432/db"
npx prisma migrate deploy
```

## Monitoramento

### CloudWatch Logs

```bash
# Ver logs do container
aws logs tail /ecs/hub-server-side-tracking-api --follow
```

**Procure por:**
- ✅ "✅ Migrations completas"
- ✅ "✅ Tudo pronto. Iniciando servidor"
- ❌ "❌ ERRO CRÍTICO"

### ECS Task Status

```bash
# Verificar status do task
aws ecs describe-tasks \
  --cluster hub-server-side-tracking \
  --tasks $(aws ecs list-tasks --cluster hub-server-side-tracking --query 'taskArns[0]' --output text) \
  --query 'tasks[0].[lastStatus, healthStatus]'
```

**Esperado:** `RUNNING` + `HEALTHY`

## Performance

- **Startup time:** ~5-8s (5s wait + migrations)
- **Migrations:** ~1-2s (3 migrations)
- **Server init:** ~1-2s
- **Health check response:** <100ms

## Checklist de Deploy

- [ ] DATABASE_URL secret criada em Secrets Manager
- [ ] ECS task definition tem valueFrom para DATABASE_URL
- [ ] RDS security group permite 5432 de ECS
- [ ] Dockerfile copia entrypoint.sh
- [ ] entrypoint.sh tem permissão 755
- [ ] Docker image buildada com `--platform linux/amd64`
- [ ] Image pushada ao ECR
- [ ] ECS service faz force-new-deployment
- [ ] Logs mostram "✅ Tudo pronto"
- [ ] Health check passa (GET /api/v1/health)

## Referências

- RDS Endpoint: `hub-server-side-tracking-db.c634uak24gci.us-east-1.rds.amazonaws.com`
- SQS Queue: `hub-server-side-tracking-dispatch`
- ALB DNS: `hub-server-side-tracking-alb-664500548.us-east-1.elb.amazonaws.com`
