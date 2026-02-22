# Backend Deployment — Status & Next Steps

**Status:** ✅ **INFRASTRUCTURE CODE READY**
**Date:** 2026-02-22
**Prepared by:** Claude Code (@devops)

---

## Current State

| Component | Status | Note |
|-----------|--------|------|
| Frontend (Next.js) | ✅ Deployed | Running on Vercel: https://web-five-eta-14.vercel.app |
| Backend (Fastify) | 📦 Ready for Deployment | Code in `apps/api/`, Docker image configured |
| GitHub Actions CI/CD | ✅ Configured | Workflow in `.github/workflows/ci-cd-deploy.yml` |
| AWS Infrastructure | 🛠️ **CODE READY** | Terraform templates in `docs/infrastructure/terraform/` |
| GitHub Secrets | ⏳ Awaiting Setup | Will configure after AWS infrastructure is created |

---

## What's Been Prepared

### ✅ Complete AWS Infrastructure as Code (Terraform)
All files ready in `docs/infrastructure/terraform/`:

1. **`main.tf`** — Complete infrastructure definition
   - VPC with public/private subnets
   - ECS Fargate cluster and service
   - RDS PostgreSQL database
   - ElastiCache Redis cluster
   - Application Load Balancer (ALB)
   - Security groups and IAM roles
   - CloudWatch logging and alarms

2. **`variables.tf`** — All configurable parameters
   - AWS region, account ID, environment
   - ECS task size (CPU/memory)
   - RDS instance type and storage
   - Redis node type and configuration
   - Health check settings
   - Monitoring and tagging

3. **`outputs.tf`** — Critical values exposed
   - ECR repository URL (for Docker push)
   - ECS cluster/service/task definition names
   - RDS endpoint and database name
   - Redis endpoint and auth token
   - ALB DNS name (for Route 53)
   - All values needed for GitHub Secrets

4. **`terraform.tfvars.example`** — Configuration template
   - Copy → `terraform.tfvars`
   - Fill in AWS account ID and RDS password
   - Adjust instance types if needed (cost optimization)

### ✅ Comprehensive Documentation
- **`docs/infrastructure/README.md`** — Architecture overview & quick start
- **`docs/infrastructure/AWS-SETUP-GUIDE.md`** — Detailed step-by-step AWS setup (Terraform + manual)
- **`docs/infrastructure/GITHUB-SECRETS-CHECKLIST.md`** — GitHub Secrets configuration

### ✅ GitHub Actions CI/CD Pipeline
- Already configured in `.github/workflows/ci-cd-deploy.yml`
- Quality gates (lint, typecheck, tests)
- Docker build & ECR push
- ECS Fargate deployment
- Slack notifications (optional)

---

## What You Need to Do

### Phase 1: AWS Infrastructure Setup (30-45 mins)

#### Step 1: Gather Prerequisites
- [ ] AWS Account ID (12 digits) — Find in AWS Console → Account
- [ ] AWS Access Key ID & Secret Key — Create in AWS IAM
- [ ] Generate RDS password: `openssl rand -base64 32` (copy output)

#### Step 2: Configure Terraform
```bash
cd /Users/guilhermesimas/Documents/hub-server-side-tracking/docs/infrastructure/terraform
cp terraform.tfvars.example terraform.tfvars
nano terraform.tfvars  # Fill in 3 values:
# - aws_account_id = "YOUR_ACCOUNT_ID"
# - rds_master_password = "PASTE_GENERATED_PASSWORD"
# - Keep other defaults or adjust for cost
```

#### Step 3: Deploy AWS Infrastructure
```bash
terraform init    # ~20 seconds
terraform plan    # Review resources to be created
terraform apply   # Type 'yes' when prompted
# ⏱️ Takes ~15 minutes (mostly RDS + Redis provisioning)

# Save outputs for next step
terraform output -json > outputs.json
cat outputs.json  # Keep this file open for copy-paste
```

**Expected Outputs** (from `terraform output setup_summary`):
```json
{
  "ecr_repository": "hub-server-side-tracking-api",
  "ecs_cluster": "hub-server-side-tracking-cluster",
  "ecs_service": "hub-server-side-tracking-service",
  "ecs_task_definition": "hub-server-side-tracking",
  "rds_endpoint": "hub-api-db.xxxxxx.rds.amazonaws.com",
  "redis_endpoint": "hub-api-redis.xxxxxx.cache.amazonaws.com",
  "alb_dns_name": "hub-xxxxxxxx-123456789.us-east-1.elb.amazonaws.com"
}
```

### Phase 2: Configure GitHub Secrets (5 mins)

#### Option A: Using GitHub CLI (Recommended)
```bash
cd /Users/guilhermesimas/Documents/hub-server-side-tracking

# Configure secrets
gh secret set AWS_ACCESS_KEY_ID --body "AKIA..."
gh secret set AWS_SECRET_ACCESS_KEY --body "wJal..."
gh secret set AWS_REGION --body "us-east-1"

# From Terraform outputs:
gh secret set ECR_REPOSITORY --body "hub-server-side-tracking-api"
gh secret set ECS_CLUSTER --body "hub-server-side-tracking-cluster"
gh secret set ECS_SERVICE --body "hub-server-side-tracking-service"
gh secret set ECS_TASK_DEFINITION --body "hub-server-side-tracking"

# Verify
gh secret list
```

#### Option B: Using GitHub Web UI
- Go to: GitHub → Repository → Settings → Secrets and variables → Actions
- Click "New repository secret"
- Add each secret manually (see list above)

### Phase 3: Test Deployment (5 mins)

After secrets are configured:

```bash
# Trigger CI/CD pipeline
git add .
git commit -m "chore: configure AWS infrastructure"
git push origin main

# Monitor deployment
# GitHub → Actions → Watch "CI/CD - Build & Deploy to ECS Fargate" workflow

# Expected steps:
# 1. ✅ Quality gates (lint, typecheck, tests)
# 2. ✅ Build Docker image + push to ECR
# 3. ✅ Deploy to ECS Fargate
# 4. ✅ Wait for service to stabilize (~2 mins)
# 5. 📬 Slack notification (if configured)
```

### Phase 4: Verify Backend is Running (2 mins)

After deployment completes:

```bash
# Get ALB DNS name from Terraform output
ALB_DNS=$(terraform output -raw alb_dns_name)

# Test API health endpoint
curl http://$ALB_DNS/api/v1/health

# Expected response:
# {"status":"healthy","timestamp":"2026-02-22T10:30:00Z"}

# Test setup wizard endpoint
curl -X POST http://$ALB_DNS/api/v1/setup/sessions \
  -H "Content-Type: application/json" \
  -d '{"businessName":"Test"}'

# Should return: {"sessionId":"...", "...": "..."}
```

### Phase 5: Configure Domain (Optional but Recommended)

```bash
# Get ALB DNS name
ALB_DNS=$(terraform output -raw alb_dns_name)

# In Route 53 (or your DNS provider):
# Create A record pointing to ALB DNS
# Example: api.yourdomain.com → ALB DNS name
# Or use CNAME: CNAME api.yourdomain.com → ALB DNS name
```

---

## Estimated Timeline

| Phase | Duration | Blocker |
|-------|----------|---------|
| Phase 1: AWS Infrastructure | 30-45 mins | 🔴 AWS credentials |
| Phase 2: GitHub Secrets | 5 mins | — |
| Phase 3: Test Deployment | 5-10 mins | — |
| Phase 4: Verify Backend | 2 mins | — |
| Phase 5: Configure Domain | 10 mins | Optional |
| **Total** | **~1 hour** | **AWS credentials only** |

---

## Files You'll Need

### Before Starting
- AWS Account ID (12-digit number)
- AWS Access Key ID & Secret Key (from IAM)
- Generated RDS password (from `openssl rand -base64 32`)

### During Setup
- `docs/infrastructure/terraform/` directory
- AWS CLI (installed via `brew install awscli`)
- GitHub CLI (installed via `brew install gh`)

### After Setup
- `terraform.tfstate` — Terraform state (auto-generated, keep safe)
- `outputs.json` — Terraform outputs (for reference)
- GitHub Secrets (configured in web UI or CLI)

---

## Cost Analysis

### What You'll Pay (Monthly)

**Development Setup (current):**
- ECS Fargate: $3.33
- RDS t4g.micro: $9.50
- Redis t4g.micro: $13.50
- NAT Gateway: $10-20
- **Total: ~$36-46/month** (cheapest possible)

**With Usage (realistic):**
- Data transfer out: +$5-20
- CloudWatch logs: +$1-5
- Storage snapshots: +$2
- **Estimated: ~$45-75/month**

**To Reduce Costs:**
- Use RDS free tier eligible instances (if within 12 months of signup)
- Use Graviton2 instances (`t4g.*`) — 20% cheaper
- Consolidate to single NAT Gateway
- Schedule downtime for non-production environments

### How to Monitor Costs
```bash
# AWS Console → Billing → Cost Explorer
# Or use AWS CLI:
aws ce get-cost-and-usage --time-period Start=2026-02-01,End=2026-02-28 \
  --granularity MONTHLY --metrics "UnblendedCost"
```

---

## Next Steps After Backend is Running

Once backend is deployed and verified:

### Immediate (Sprint 010)
- [ ] Test end-to-end flow: Frontend → API → Database
- [ ] Verify database migrations ran: `SELECT * FROM public.Tenant;`
- [ ] Check CloudWatch logs for errors: `aws logs tail /ecs/hub-server-side-tracking`
- [ ] Configure Route 53 DNS (if using custom domain)
- [ ] Set up CloudWatch alarms for CPU/memory/errors

### Next Stories (Sprint 011-014)
- [ ] Story 006: Pageview & Checkout endpoints
- [ ] Story 007: Generic webhook receiver
- [ ] Story 008: Match engine (click→conversion)
- [ ] Story 009: SQS dispatch to Meta CAPI

### Production Hardening
- [ ] Enable RDS Multi-AZ for high availability
- [ ] Configure RDS automated backups (daily)
- [ ] Set up CloudTrail for audit logging
- [ ] Enable AWS WAF on ALB
- [ ] Configure DDoS protection (Shield Standard is free)
- [ ] Implement monitoring/alerting for production metrics
- [ ] Set up incident response process

---

## Troubleshooting

### "AWS credentials not found"
```bash
aws configure
# Provide: Access Key, Secret Key, Region (us-east-1), Output format (json)
```

### "Terraform plan shows different resources"
- [ ] Verify `aws_account_id` in `terraform.tfvars`
- [ ] Verify AWS credentials: `aws sts get-caller-identity`
- [ ] Check for typos in variable names

### "ECS task won't start"
```bash
# Check task logs
aws logs get-log-events \
  --log-group-name /ecs/hub-server-side-tracking \
  --log-stream-name ecs/hub-server-side-tracking/TASK_ID

# Check task stopped reason
aws ecs describe-tasks --cluster hub-cluster --tasks TASK_ARN
```

See **docs/infrastructure/AWS-SETUP-GUIDE.md** → Troubleshooting for more help.

---

## Questions & Support

| Issue | Reference |
|-------|-----------|
| General AWS setup | `docs/infrastructure/AWS-SETUP-GUIDE.md` |
| GitHub Secrets config | `docs/infrastructure/GITHUB-SECRETS-CHECKLIST.md` |
| Infrastructure code | `docs/infrastructure/terraform/` |
| CI/CD pipeline | `.github/workflows/ci-cd-deploy.yml` |
| Deployment log | `docs/stories/story-track-ai-010-dashboard-analytics.md` |

---

## Summary

**Everything is prepared.** You only need:
1. AWS credentials (Access Key + Secret Key)
2. AWS Account ID
3. ~1 hour to run Terraform + configure GitHub Secrets

After that: **Push to main → automatic deployment to ECS Fargate** ✅

Ready to proceed?

---

**Prepared by:** Claude Code (DevOps Agent)
**Date:** 2026-02-22
**Status:** ✅ Waiting for AWS credentials
