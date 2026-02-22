# GitHub Secrets Configuration Checklist

After AWS infrastructure is deployed via Terraform, configure GitHub Secrets for CI/CD to work.

## Prerequisite: Terraform Apply Completed ✅

Ensure you've run:
```bash
cd docs/infrastructure/terraform
terraform apply
terraform output -json > outputs.json
cat outputs.json
```

This generates values you'll need below. Keep `outputs.json` open for reference.

---

## Option A: Configure via GitHub CLI (Recommended)

Fastest method. Requires GitHub CLI authenticated:

```bash
gh auth status  # Verify authenticated
```

### 1. Navigate to Project
```bash
cd /Users/guilhermesimas/Documents/hub-server-side-tracking
```

### 2. Set AWS Credentials
```bash
# Your actual AWS credentials (from AWS IAM console or AWS CLI config)
gh secret set AWS_ACCESS_KEY_ID --body "AKIA..."
gh secret set AWS_SECRET_ACCESS_KEY --body "wJal..."
```

**Where to find these:**
- AWS Console → IAM → Users → Select user → Create access key
- Or: `cat ~/.aws/credentials` (if configured locally)

### 3. Set AWS Region
```bash
gh secret set AWS_REGION --body "us-east-1"
```

### 4. Set ECR Repository Name
```bash
# From Terraform output: setup_summary.github_secrets.ECR_REPOSITORY
gh secret set ECR_REPOSITORY --body "hub-server-side-tracking-api"
```

### 5. Set ECS Configuration
```bash
# From Terraform output: setup_summary.github_secrets.ECS_CLUSTER
gh secret set ECS_CLUSTER --body "hub-server-side-tracking-cluster"

# From Terraform output: setup_summary.github_secrets.ECS_SERVICE
gh secret set ECS_SERVICE --body "hub-server-side-tracking-service"

# From Terraform output: setup_summary.github_secrets.ECS_TASK_DEFINITION
gh secret set ECS_TASK_DEFINITION --body "hub-server-side-tracking"
```

### 6. Verify Secrets Set
```bash
gh secret list
```

Expected output:
```
ECR_REPOSITORY                    Updated 2026-02-22
ECS_CLUSTER                       Updated 2026-02-22
ECS_SERVICE                       Updated 2026-02-22
ECS_TASK_DEFINITION              Updated 2026-02-22
AWS_ACCESS_KEY_ID                Updated 2026-02-22
AWS_REGION                        Updated 2026-02-22
AWS_SECRET_ACCESS_KEY            Updated 2026-02-22
```

---

## Option B: Configure via GitHub UI (Manual)

If you prefer web UI:

### 1. Navigate to Secrets
- GitHub → Repository → Settings → Secrets and variables → Actions
- Click "New repository secret"

### 2. Add Each Secret

| Secret Name | Value | Source |
|-------------|-------|--------|
| `AWS_ACCESS_KEY_ID` | `AKIA...` | AWS IAM User |
| `AWS_SECRET_ACCESS_KEY` | `wJal...` | AWS IAM User |
| `AWS_REGION` | `us-east-1` | Fixed |
| `ECR_REPOSITORY` | From `terraform output` | `setup_summary.github_secrets.ECR_REPOSITORY` |
| `ECS_CLUSTER` | From `terraform output` | `setup_summary.github_secrets.ECS_CLUSTER` |
| `ECS_SERVICE` | From `terraform output` | `setup_summary.github_secrets.ECS_SERVICE` |
| `ECS_TASK_DEFINITION` | From `terraform output` | `setup_summary.github_secrets.ECS_TASK_DEFINITION` |

### 3. Repeat for Each Secret
1. Click "New repository secret"
2. Paste "Secret name" (e.g., `AWS_ACCESS_KEY_ID`)
3. Paste "Secret" value
4. Click "Add secret"

---

## Optional: Slack Notifications

If you want GitHub Actions to send Slack notifications:

### 1. Create Slack Webhook
- Slack Workspace → Apps & Integrations → Incoming Webhooks
- Create new webhook for a channel (e.g., #deployments)
- Copy webhook URL

### 2. Add Secret
```bash
gh secret set SLACK_WEBHOOK_URL --body "https://hooks.slack.com/services/T00000000/B00000000/..."
```

Or via UI:
- Settings → Secrets → New repository secret
- Name: `SLACK_WEBHOOK_URL`
- Value: Paste webhook URL

---

## Verification: Trigger CI/CD Pipeline

After secrets are configured, test the pipeline:

### 1. Push a Commit to Main
```bash
git add .
git commit -m "chore: configure AWS infrastructure [skip ci]"
git push origin main
```

### 2. Monitor GitHub Actions
- GitHub → Actions → Watch workflow run
- Expected jobs:
  1. ✅ Quality (lint, typecheck, tests)
  2. ✅ Build (Docker image)
  3. ✅ Deploy (ECS service)
  4. ⏭️ Deploy Vercel (optional)
  5. 📬 Notifications (optional)

### 3. Check Logs
If workflow fails:
```bash
# View job logs
gh run list --limit 1
gh run view {run_id} --log

# Or check GitHub UI
# GitHub → Actions → Click failed workflow → Click job
```

---

## Troubleshooting

### Secret Not Found Error in Workflow
- [ ] Verify secret is set: `gh secret list`
- [ ] Check secret name in workflow matches `.github/workflows/ci-cd-deploy.yml`
- [ ] Secrets are case-sensitive: `AWS_REGION` ≠ `aws_region`

### "Invalid credentials" Error
- [ ] Verify AWS Access Key ID and Secret Access Key are correct
- [ ] Check for trailing/leading whitespace
- [ ] Ensure user has ECR and ECS permissions in AWS

### ECS Update Fails
- [ ] Verify ECR repository exists: `aws ecr describe-repositories --region us-east-1`
- [ ] Verify ECS cluster exists: `aws ecs describe-clusters --region us-east-1`
- [ ] Verify task definition exists: `aws ecs describe-task-definition --task-definition hub-server-side-tracking --region us-east-1`

### Build Stalls / Timeout
- [ ] Docker image might be large — check `.dockerignore`
- [ ] ECR push might be slow — wait 5+ minutes
- [ ] Check GitHub Actions runner status: `gh run list --status in_progress`

---

## Security Best Practices

| ⚠️ DO | ❌ DON'T |
|------|---------|
| Use least-privilege IAM user | Use root AWS account credentials |
| Rotate credentials every 90 days | Commit secrets to git |
| Use AWS Secrets Manager for sensitive values | Hardcode secrets in code or config files |
| Enable MFA on AWS account | Share credentials via Slack/email |
| Audit secret access regularly | Use placeholder/test credentials in production |

---

## Next Steps

After CI/CD is working:

1. ✅ Push code to main
2. ✅ Watch GitHub Actions deploy to ECS
3. ✅ Verify API is running: `curl http://[ALB_DNS]/api/v1/health`
4. ✅ Configure Route 53 DNS pointing to ALB
5. ✅ Setup CloudWatch monitoring/alerts
6. ✅ Configure backup and disaster recovery

---

## Reference: Terraform Output Cheatsheet

```bash
# After terraform apply, extract key values:
aws_account_id=$(terraform output -raw aws_account_id)
ecr_repository=$(terraform output -raw ecr_repository_name)
ecs_cluster=$(terraform output -raw ecs_cluster_name)
ecs_service=$(terraform output -raw ecs_service_name)
ecs_task=$(terraform output -raw ecs_task_definition_family)

echo "ECR: $ecr_repository"
echo "ECS Cluster: $ecs_cluster"
echo "ECS Service: $ecs_service"
echo "Task Definition: $ecs_task"
```

Or more simply:
```bash
terraform output setup_summary
```

---

## Slack Notification Example

When CI/CD completes, Slack message looks like:

```
✅ DEPLOYMENT SUCCESSFUL

Repository: hub-server-side-tracking
Branch: main
Commit: 227dac7a3...
Author: @devops

[View Workflow]
```

Setup webhook in GitHub Actions workflow `.github/workflows/ci-cd-deploy.yml` (already configured).

---

*Last updated: 2026-02-22*
*AWS credentials must be kept secure and rotated regularly.*
