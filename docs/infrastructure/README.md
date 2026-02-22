# AWS Infrastructure Setup

Complete guide to deploy Hub Server-Side Tracking backend to AWS ECS Fargate with RDS PostgreSQL and Redis.

## 📋 Overview

This infrastructure enables **high-availability, scalable backend deployment** on AWS:

```
GitHub Actions (CI/CD)
    ↓
ECR (Docker images)
    ↓
ECS Fargate (containers)
    ↓
ALB (load balancer)
    ↓
Internet
```

**Backend Services:**
- **ECS Fargate** — Serverless container runtime (no server management)
- **RDS PostgreSQL** — Managed relational database (backups, replication)
- **ElastiCache Redis** — In-memory caching for sessions/queues
- **Application Load Balancer** — Distributes traffic to ECS tasks
- **CloudWatch** — Centralized logging and monitoring

## 🚀 Quick Start (5 Steps)

### Step 1: Prerequisites
```bash
# Install tools
brew install terraform aws-cli github-cli

# Configure AWS credentials
aws configure
# Provide: Access Key, Secret Key, Region (us-east-1), Output (json)

# Verify authentication
aws sts get-caller-identity
gh auth status
```

### Step 2: Generate RDS Password
```bash
# Generate strong 32-character password
openssl rand -base64 32
# Copy output → save for next step
```

### Step 3: Configure Terraform Variables
```bash
cd docs/infrastructure/terraform

# Copy example configuration
cp terraform.tfvars.example terraform.tfvars

# Edit with your values
nano terraform.tfvars
# Replace:
# - aws_account_id = "123456789012"
# - rds_master_password = "PASTE_GENERATED_PASSWORD"
```

### Step 4: Deploy Infrastructure
```bash
# Validate configuration
terraform init
terraform plan

# Review plan output carefully, then apply
terraform apply
# Type 'yes' when prompted
# ⏱️ Takes ~15 minutes

# Save outputs for next step
terraform output -json > outputs.json
```

### Step 5: Configure GitHub Secrets
```bash
# Extract values from Terraform output
source setup-github-secrets.sh outputs.json

# Or manually add secrets (see GITHUB-SECRETS-CHECKLIST.md)
gh secret set AWS_ACCESS_KEY_ID --body "AKIA..."
gh secret set AWS_SECRET_ACCESS_KEY --body "..."
gh secret set AWS_REGION --body "us-east-1"
gh secret set ECR_REPOSITORY --body "hub-server-side-tracking-api"
gh secret set ECS_CLUSTER --body "hub-cluster"
gh secret set ECS_SERVICE --body "hub-api-service"
gh secret set ECS_TASK_DEFINITION --body "hub-api-task"
```

**Done!** 🎉

Next push to `main` triggers automatic deployment:
```bash
git push origin main
# Watch: GitHub → Actions → CI/CD workflow
```

---

## 📁 File Structure

```
docs/infrastructure/
├── README.md                          # This file
├── AWS-SETUP-GUIDE.md                 # Detailed AWS setup (Terraform + manual)
├── GITHUB-SECRETS-CHECKLIST.md        # GitHub Secrets configuration
├── ecs-task-definition.json           # ECS task template (optional for manual setup)
├── iam-trust-policy.json              # IAM trust policy template
├── iam-policy-ecs.json                # IAM permissions policy
│
└── terraform/                         # Infrastructure as Code
    ├── main.tf                        # VPC, ECS, RDS, Redis, ALB, IAM
    ├── variables.tf                   # Input variables with defaults
    ├── outputs.tf                     # Output values (endpoints, IDs)
    ├── terraform.tfvars.example       # Configuration template
    └── setup-github-secrets.sh        # Script to configure GitHub Secrets (optional)
```

## 🏗️ Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                      AWS Account (us-east-1)                │
└─────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────┐
│       VPC (10.0.0.0/16)              │
│  ┌────────────────────────────────┐  │
│  │  Public Subnets (ALB)          │  │
│  │  - 10.0.101.0/24               │  │
│  │  - 10.0.102.0/24               │  │
│  └────────────────────────────────┘  │
│              ↓                        │
│  ┌────────────────────────────────┐  │
│  │  ALB (Load Balancer)           │  │
│  │  - Port 80 → ECS Tasks         │  │
│  └────────────────────────────────┘  │
│              ↓                        │
│  ┌────────────────────────────────┐  │
│  │  Private Subnets (ECS, DB)     │  │
│  │  - 10.0.1.0/24                 │  │
│  │  - 10.0.2.0/24                 │  │
│  ├────────────────────────────────┤  │
│  │ ┌──────────┐                   │  │
│  │ │ECS Tasks │→ RDS PostgreSQL   │  │
│  │ │(Fargate) │→ Redis            │  │
│  │ └──────────┘                   │  │
│  └────────────────────────────────┘  │
└──────────────────────────────────────┘

┌──────────────────────────────────────┐
│      AWS Services (Shared)           │
│  - ECR (Container Registry)          │
│  - CloudWatch (Logs & Monitoring)    │
│  - Secrets Manager (Credentials)     │
└──────────────────────────────────────┘
```

## 🔧 Deployment Methods

### Method 1: Terraform (Recommended) ⭐
Fully automated, Infrastructure as Code, version controlled.

**Pros:**
- Single command: `terraform apply`
- Reproducible across environments
- Easy to scale/modify
- State management

**Cons:**
- Learning curve for Terraform syntax

**Steps:**
1. `terraform init`
2. `terraform plan` (review)
3. `terraform apply`
4. Configure GitHub Secrets
5. Push to main → auto-deploy

### Method 2: AWS Console (Manual)
Point-and-click AWS UI, good for learning AWS.

**Pros:**
- Visual, easy to understand
- Good for learning
- Can follow step-by-step

**Cons:**
- Time-consuming (45+ mins)
- Error-prone (easy to misconfigure)
- Hard to reproduce
- Not version controlled

**See:** `AWS-SETUP-GUIDE.md` → Opção B for step-by-step instructions

### Method 3: AWS CLI Commands
Terminal-based commands, middle ground between Terraform and manual.

**Pros:**
- Fast, scriptable
- No learning curve for Terraform
- Can be version controlled

**Cons:**
- Requires understanding AWS service hierarchy
- Less robust error handling

**See:** `AWS-SETUP-GUIDE.md` → Opção B for AWS CLI commands

---

## 📊 Cost Estimation

### Development (db.t4g.micro + cache.t4g.micro)
| Service | Instance | Estimate |
|---------|----------|----------|
| ECS Fargate | 0.25 vCPU, 512MB | ~$3.33 |
| RDS PostgreSQL | t4g.micro, 20GB | ~$9.50 |
| ElastiCache | t4g.micro | ~$13.50 |
| NAT Gateway | — | ~$10-20 |
| **Total** | — | **~$36-46/month** |

### Production (db.t4g.small + Multi-AZ)
| Service | Configuration | Cost |
|---------|---|---|
| ECS Fargate | 1 vCPU, 2GB, 2x tasks | ~$50 |
| RDS PostgreSQL | t4g.small Multi-AZ | ~$40 |
| ElastiCache | t4g.small + replication | ~$45 |
| NAT Gateway | — | ~$30 |
| **Total** | — | **~$165-200/month** |

**Cost Optimization Tips:**
- Use `t4g.micro` for non-production (Graviton2 is cheaper)
- Use `db.t4g.micro` for RDS (1 vCPU, 1GB RAM)
- Use single NAT Gateway for dev/staging (per-region), multi for production
- Enable auto-scaling only when needed

---

## 🔐 Security

### Network Security
- ✅ Private subnets for ECS, RDS, Redis
- ✅ Security groups restrict traffic by port/source
- ✅ NACLs (Network ACLs) for additional layer
- ✅ No public IPs for databases

### Data Security
- ✅ RDS encrypted at rest (KMS)
- ✅ Redis encrypted in transit (TLS)
- ✅ RDS backups encrypted
- ✅ Secrets stored in AWS Secrets Manager

### Access Control
- ✅ IAM roles with least-privilege permissions
- ✅ ECS tasks assume IAM role (no hardcoded credentials)
- ✅ GitHub Actions authenticated via AWS STS
- ✅ Database passwords never in environment (except via secrets)

### Best Practices
- 🔄 Rotate IAM credentials every 90 days
- 🔐 Use strong passwords (32+ characters, random)
- 🚫 Never commit secrets to Git
- 📝 Enable CloudTrail for audit logging
- 🔔 Set up CloudWatch alarms for suspicious activity

---

## 📈 Monitoring & Observability

### CloudWatch Metrics
- **ECS CPU/Memory** — Task resource utilization
- **RDS CPU/Connections** — Database load
- **Redis CPU/MemoryUsage** — Cache hits/misses
- **ALB** — Request count, latency, errors

### CloudWatch Logs
- **ECS Logs** — Application output
- **RDS Logs** — Database errors/slow queries
- **ALB Logs** — HTTP request details

### Setup Monitoring
```bash
# Enable detailed CloudWatch metrics
aws monitoring put-metric-data \
  --metric-name APILatency \
  --value 123 \
  --namespace "HubTracking"

# View logs
aws logs tail /ecs/hub-server-side-tracking --follow
```

### Create Alarms
```bash
# High CPU alert
aws cloudwatch put-metric-alarm \
  --alarm-name ecs-cpu-high \
  --alarm-description "ECS CPU > 80%" \
  --metric-name CPUUtilization \
  --threshold 80 \
  --comparison-operator GreaterThanThreshold
```

---

## 🐛 Troubleshooting

### ECS Task Not Starting
```bash
# Check task logs
aws logs get-log-events \
  --log-group-name /ecs/hub-server-side-tracking \
  --log-stream-name ecs/hub-server-side-tracking/TASK_ID

# Check task status
aws ecs describe-tasks \
  --cluster hub-cluster \
  --tasks TASK_ARN \
  --query 'tasks[0].{lastStatus: lastStatus, stoppedReason: stoppedReason}'
```

### RDS Connection Timeout
```bash
# Check security group rules
aws ec2 describe-security-groups \
  --group-ids SG_ID \
  --query 'SecurityGroups[0].IpPermissions'

# Test connectivity (from ECS task)
psql postgresql://postgres@RDS_ENDPOINT/hub_db
```

### ECR Image Push Fails
```bash
# Login to ECR
aws ecr get-login-password --region us-east-1 | \
  docker login --username AWS --password-stdin ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com

# Push image
docker push ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com/hub-server-side-tracking-api:latest
```

See **AWS-SETUP-GUIDE.md** for detailed troubleshooting section.

---

## 🔄 Maintenance & Scaling

### Auto-Scaling
```bash
# Enable auto-scaling for ECS service
aws application-autoscaling register-scalable-target \
  --service-namespace ecs \
  --resource-id service/hub-cluster/hub-api-service \
  --scalable-dimension ecs:service:DesiredCount \
  --min-capacity 1 \
  --max-capacity 5
```

### Database Scaling
- **Vertical:** Upgrade instance class (downtime ~5-10 mins)
- **Horizontal:** Read replicas for read-heavy workloads
- **Auto-scaling:** Monitor CPU/connections, scale up/down automatically

### Backup & Recovery
```bash
# Create snapshot
aws rds create-db-snapshot \
  --db-instance-identifier hub-api-db \
  --db-snapshot-identifier hub-api-db-backup-2026-02-22

# List snapshots
aws rds describe-db-snapshots
```

---

## 📚 References

- [AWS ECS Fargate Documentation](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/launch_types.html#launch-type-fargate)
- [Terraform AWS Provider](https://registry.terraform.io/providers/hashicorp/aws/latest/docs)
- [PostgreSQL Performance Tuning](https://wiki.postgresql.org/wiki/Performance_Optimization)
- [Redis Best Practices](https://redis.io/topics/protocol-spec)
- [AWS Well-Architected Framework](https://aws.amazon.com/architecture/well-architected/)

---

## 🆘 Getting Help

### Common Issues
- See **TROUBLESHOOTING** section above
- See **AWS-SETUP-GUIDE.md** for detailed AWS setup issues
- See **GITHUB-SECRETS-CHECKLIST.md** for CI/CD issues

### AWS Support
- AWS Console → Support → Create case
- AWS Managed Service for Slack integration

### Documentation
- AWS ECS docs: https://docs.aws.amazon.com/ecs/
- RDS docs: https://docs.aws.amazon.com/rds/
- Terraform docs: https://www.terraform.io/docs/

---

**Last Updated:** 2026-02-22
**Maintained by:** DevOps Team
**Status:** ✅ Production Ready
