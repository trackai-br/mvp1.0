# ⚠️ IAM Permission Blocker — Story 009 Phase 2

## Problem

The AWS IAM user `hub-tracking-deploy` (used for SQS + Secrets Manager operations) does NOT have the required permissions to create SQS queues or access Secrets Manager.

**Current status:**
```
User: arn:aws:iam::571944667101:user/hub-tracking-deploy
Groups: 0
Inline policies: 0
Managed policies: 0
```

**Error encountered:**
```
AccessDenied: User is not authorized to perform: sqs:createqueue
```

---

## Resolution

An **AWS Account Administrator** must attach the following policy to the `hub-tracking-deploy` user.

### Option 1: Create and Attach Inline Policy (Quick)

**Via AWS Console:**

1. Go to **IAM → Users → hub-tracking-deploy**
2. Click **Add inline policy**
3. Choose **JSON** editor
4. Paste the policy below
5. Click **Review and Create**
6. Name it: `SQS-SecretsManager-Policy`
7. Click **Create policy**

**Policy JSON:**

```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Sid": "SQSQueueManagement",
            "Effect": "Allow",
            "Action": [
                "sqs:CreateQueue",
                "sqs:DeleteQueue",
                "sqs:GetQueueAttributes",
                "sqs:SetQueueAttributes",
                "sqs:GetQueueUrl",
                "sqs:ListQueues",
                "sqs:SendMessage",
                "sqs:ReceiveMessage",
                "sqs:DeleteMessage",
                "sqs:ChangeMessageVisibility"
            ],
            "Resource": "arn:aws:sqs:us-east-1:571944667101:*"
        },
        {
            "Sid": "SecretsManagerAccess",
            "Effect": "Allow",
            "Action": [
                "secretsmanager:CreateSecret",
                "secretsmanager:UpdateSecret",
                "secretsmanager:DescribeSecret",
                "secretsmanager:GetSecretValue",
                "secretsmanager:PutSecretValue"
            ],
            "Resource": "arn:aws:secretsmanager:us-east-1:571944667101:secret:meta-capi-credentials-*"
        },
        {
            "Sid": "KmsAccess",
            "Effect": "Allow",
            "Action": [
                "kms:Decrypt",
                "kms:GenerateDataKey"
            ],
            "Resource": [
                "arn:aws:kms:us-east-1:571944667101:key/*"
            ],
            "Condition": {
                "StringEquals": {
                    "kms:ViaService": [
                        "sqs.us-east-1.amazonaws.com",
                        "secretsmanager.us-east-1.amazonaws.com"
                    ]
                }
            }
        }
    ]
}
```

### Option 2: Create Managed Policy (Production)

**Via AWS CLI:**

```bash
# 1. Create managed policy
POLICY_ARN=$(aws iam create-policy \
  --policy-name SQSSecretsManagerPolicy \
  --policy-document file://policy.json \
  --output text --query 'Policy.Arn')

# 2. Attach to user
aws iam attach-user-policy \
  --user-name hub-tracking-deploy \
  --policy-arn $POLICY_ARN
```

### Option 3: Use Existing Role (If Available)

If there's already an IAM role for deployments (e.g., `hub-tracking-deployer-role`), attach the policy to that role instead.

---

## Verification

After attaching the policy, verify permissions:

```bash
# Check if user has policy now
aws iam list-user-policies --user-name hub-tracking-deploy

# Test SQS access
aws sqs list-queues --region us-east-1

# Test Secrets Manager access
aws secretsmanager list-secrets --region us-east-1
```

---

## Next Steps

1. **Admin:** Attach policy to `hub-tracking-deploy` user
2. **Verify:** Run verification commands above
3. **Resume:** Run the SQS setup script again:
   ```bash
   bash infra/setup-sqs.sh
   ```

---

## Minimal Permission Set

If you want to restrict permissions further, here's the MINIMAL set needed:

```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Action": [
                "sqs:CreateQueue",
                "sqs:GetQueueUrl",
                "sqs:SetQueueAttributes"
            ],
            "Resource": [
                "arn:aws:sqs:us-east-1:571944667101:capi-dispatch",
                "arn:aws:sqs:us-east-1:571944667101:capi-dispatch-dlq"
            ]
        },
        {
            "Effect": "Allow",
            "Action": [
                "secretsmanager:CreateSecret",
                "secretsmanager:UpdateSecret"
            ],
            "Resource": "arn:aws:secretsmanager:us-east-1:571944667101:secret:meta-capi-credentials-*"
        }
    ]
}
```

---

## Blocker Status

**Status:** 🔴 **BLOCKED** — Waiting for IAM policy attachment

This must be resolved by an AWS Account Administrator before Phase 2 can proceed.

