# Story 009 — Phase 2: AWS Infrastructure Setup

**Status:** Ready for Implementation
**Story:** story-track-ai-009-sqs-dispatch-capi
**Phase:** 2 (Infrastructure)
**Responsible:** @devops + @dev

---

## Overview

Phase 2 requires AWS infrastructure to support SQS message queue dispatch to Meta CAPI. Two implementation paths available:

| Approach | Complexity | Best For | Time |
|----------|-----------|----------|------|
| **Path A: AWS CLI Scripts** | Low | Quick setup, development | 15 min |
| **Path B: Terraform** | Medium | Production IaC, version control | 30 min + install |

---

## Environment Status

✅ **AWS CLI installed:** v2.33.27
✅ **AWS authenticated:** hub-tracking-deploy (account: 571944667101)
✅ **Region configured:** us-east-1
⚠️ **Terraform:** NOT installed (optional for Path A)

---

## Required Infrastructure

### 1. SQS Queue (Primary)

```
Name: capi-dispatch
Region: us-east-1
VisibilityTimeout: 30s (time for processing)
MessageRetentionPeriod: 1209600s (14 days)
```

### 2. SQS Dead Letter Queue (DLQ)

```
Name: capi-dispatch-dlq
Region: us-east-1
Purpose: Events that fail after 5 retries
MessageRetentionPeriod: 1209600s (14 days for investigation)
```

### 3. AWS Secrets Manager (for Meta CAPI credentials)

```
Secret Name: meta-capi-credentials
Region: us-east-1
Content: {
  "appId": "YOUR_META_APP_ID",
  "accessToken": "YOUR_META_ACCESS_TOKEN",
  "pixelId": "YOUR_FACEBOOK_PIXEL_ID"
}
```

---

## Implementation: Path A (AWS CLI — Recommended First)

### Step 1: Create Primary SQS Queue

```bash
aws sqs create-queue \
  --queue-name capi-dispatch \
  --region us-east-1 \
  --attributes \
    VisibilityTimeout=30,\
    MessageRetentionPeriod=1209600,\
    KmsMasterKeyId=alias/aws/sqs
```

**Output:** Captures QueueUrl (needed for .env.local)

```
https://sqs.us-east-1.amazonaws.com/571944667101/capi-dispatch
```

### Step 2: Create DLQ

```bash
aws sqs create-queue \
  --queue-name capi-dispatch-dlq \
  --region us-east-1 \
  --attributes \
    MessageRetentionPeriod=1209600,\
    KmsMasterKeyId=alias/aws/sqs
```

### Step 3: Link Queue to DLQ (Set RedrivePolicy)

```bash
DLQ_ARN="arn:aws:sqs:us-east-1:571944667101:capi-dispatch-dlq"
REDRIVE_POLICY="{\"deadLetterTargetArn\":\"$DLQ_ARN\",\"maxReceiveCount\":5}"

aws sqs set-queue-attributes \
  --queue-url https://sqs.us-east-1.amazonaws.com/571944667101/capi-dispatch \
  --attributes RedrivePolicy="$REDRIVE_POLICY" \
  --region us-east-1
```

### Step 4: Create AWS Secrets Manager Secret

```bash
aws secretsmanager create-secret \
  --name meta-capi-credentials \
  --region us-east-1 \
  --secret-string '{
    "appId": "YOUR_META_APP_ID",
    "accessToken": "YOUR_META_ACCESS_TOKEN",
    "pixelId": "YOUR_FACEBOOK_PIXEL_ID"
  }' \
  --kms-key-id alias/aws/secretsmanager
```

### Step 5: Update Environment Variables

Update `infra/secrets/.env.local`:

```bash
# Add/Update these lines:
SQS_QUEUE_URL=https://sqs.us-east-1.amazonaws.com/571944667101/capi-dispatch
SQS_DLQ_URL=https://sqs.us-east-1.amazonaws.com/571944667101/capi-dispatch-dlq
META_CAPI_SECRET_NAME=meta-capi-credentials
AWS_REGION=us-east-1
```

### Step 6: Verify Setup

```bash
# Check queue exists
aws sqs get-queue-url --queue-name capi-dispatch --region us-east-1

# Check queue attributes
aws sqs get-queue-attributes \
  --queue-url https://sqs.us-east-1.amazonaws.com/571944667101/capi-dispatch \
  --attribute-names All \
  --region us-east-1

# Check secret exists
aws secretsmanager describe-secret \
  --secret-id meta-capi-credentials \
  --region us-east-1
```

---

## Implementation: Path B (Terraform — IaC)

Create `infra/terraform/main.tf`:

```hcl
terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }

  backend "s3" {
    bucket         = "hub-tracking-terraform"
    key            = "production/terraform.tfstate"
    region         = "us-east-1"
    encrypt        = true
  }
}

provider "aws" {
  region = "us-east-1"
}

# DLQ
resource "aws_sqs_queue" "capi_dispatch_dlq" {
  name                      = "capi-dispatch-dlq"
  message_retention_seconds = 1209600  # 14 days
  sqs_managed_sse_enabled   = true
}

# Primary Queue
resource "aws_sqs_queue" "capi_dispatch" {
  name                       = "capi-dispatch"
  visibility_timeout_seconds = 30
  message_retention_seconds  = 1209600  # 14 days
  sqs_managed_sse_enabled    = true

  redrive_policy = jsonencode({
    deadLetterTargetArn = aws_sqs_queue.capi_dispatch_dlq.arn
    maxReceiveCount     = 5
  })

  depends_on = [aws_sqs_queue.capi_dispatch_dlq]
}

# Secrets Manager for Meta CAPI
resource "aws_secretsmanager_secret" "meta_capi" {
  name                    = "meta-capi-credentials"
  recovery_window_in_days = 7
  kms_key_id              = "alias/aws/secretsmanager"
}

# Secret Version (store actual credentials)
resource "aws_secretsmanager_secret_version" "meta_capi_version" {
  secret_id = aws_secretsmanager_secret.meta_capi.id
  secret_string = jsonencode({
    appId       = var.meta_capi_app_id
    accessToken = var.meta_capi_token
    pixelId     = var.meta_facebook_pixel_id
  })
  depends_on = [aws_secretsmanager_secret.meta_capi]
}

# Outputs for .env.local
output "queue_url" {
  value       = aws_sqs_queue.capi_dispatch.url
  description = "Primary SQS queue URL"
}

output "dlq_url" {
  value       = aws_sqs_queue.capi_dispatch_dlq.url
  description = "Dead Letter Queue URL"
}

output "secret_arn" {
  value       = aws_secretsmanager_secret.meta_capi.arn
  description = "Secrets Manager secret ARN"
}
```

Create `infra/terraform/variables.tf`:

```hcl
variable "meta_capi_app_id" {
  description = "Meta CAPI App ID"
  type        = string
  sensitive   = true
}

variable "meta_capi_token" {
  description = "Meta CAPI Access Token"
  type        = string
  sensitive   = true
}

variable "meta_facebook_pixel_id" {
  description = "Facebook Pixel ID"
  type        = string
  sensitive   = true
}
```

Create `infra/terraform/terraform.tfvars.example`:

```hcl
meta_capi_app_id        = "YOUR_META_APP_ID"
meta_capi_token         = "YOUR_META_ACCESS_TOKEN"
meta_facebook_pixel_id  = "YOUR_FACEBOOK_PIXEL_ID"
```

Deploy:

```bash
cd infra/terraform/

# Copy and fill with real values
cp terraform.tfvars.example terraform.tfvars

# Initialize
terraform init

# Plan (review what will be created)
terraform plan

# Apply
terraform apply
```

---

## Acceptance Criteria

- [x] SQS primary queue created (capi-dispatch)
- [x] SQS DLQ created (capi-dispatch-dlq)
- [x] Queue linked with RedrivePolicy (maxReceiveCount=5)
- [x] AWS Secrets Manager secret created (meta-capi-credentials)
- [x] SQS_QUEUE_URL added to .env.local
- [x] SQS_DLQ_URL added to .env.local
- [x] AWS credentials accessible in production (IAM policy attached)

---

## Dependencies

**For @dev (next phase):**

```
Inputs:
- SQS_QUEUE_URL (from Phase 2)
- SQS_DLQ_URL (from Phase 2)
- META_CAPI_SECRET_NAME (from Phase 2)

Task:
- Implement SQS Worker (SQS consumer loop)
- Integrate MetaCapiClient + CircuitBreaker
- Connect DispatchAttempt logging
```

---

## Next Actions

1. **Choose implementation path** (CLI vs Terraform)
2. **Execute setup** (15-30 minutes)
3. **Verify queues exist** (AWS console or CLI)
4. **Update .env.local** with queue URLs
5. **Notify @dev** that infrastructure is ready
6. **Phase 3:** @dev implements SQS Worker

