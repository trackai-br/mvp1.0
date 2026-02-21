# ECS Fargate Deployment — CAPI Dispatch Worker

## Overview

Deploy SQS-to-Meta CAPI dispatcher as containerized Fargate service. Consumes messages from `capi-dispatch` queue, sends to Meta Conversions API with circuit breaker protection.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│ AWS ECS Fargate                                                  │
│                                                                   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ capi-dispatch-worker Task (1+ replicas)                   │   │
│  │                                                             │   │
│  │  Container:                                                │   │
│  │  - Image: hub-tracking/api:latest                         │   │
│  │  - Port: 3001 (Node.js)                                   │   │
│  │  - CPU: 256m, Memory: 512MB                               │   │
│  │  - Log Group: /ecs/capi-dispatch-worker                  │   │
│  │                                                             │   │
│  │  Environment:                                              │   │
│  │  - NODE_ENV=production                                    │   │
│  │  - SQS_QUEUE_URL=...                                      │   │
│  │  - SQS_DLQ_URL=...                                        │   │
│  │  - META_CAPI_SECRET_NAME=meta-capi-credentials           │   │
│  │  - AWS_REGION=us-east-1                                  │   │
│  │                                                             │   │
│  │  Health Check:                                             │   │
│  │  - Type: CMD-SHELL                                         │   │
│  │  - Command: node -e "require('http')..."                 │   │
│  │  - Interval: 30s, Timeout: 5s, Retries: 3               │   │
│  └──────────────────────────────────────────────────────────┘   │
│                        ↓                                          │
│                        ↓                                          │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ AWS Secrets Manager                                       │   │
│  │ meta-capi-credentials (rotated every 90 days)            │   │
│  └──────────────────────────────────────────────────────────┘   │
│                        ↓                                          │
│                        ↓                                          │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ Auto Scaling Group                                        │   │
│  │ - Min: 2 replicas (high availability)                    │   │
│  │ - Max: 10 replicas                                       │   │
│  │ - Target CPU: 70%                                        │   │
│  │ - Scale-up threshold: p99 latency > 5s                  │   │
│  │ - Scale-down threshold: p50 latency < 1s                │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
           ↓              ↓              ↓
        SQS Queue     Meta CAPI      CloudWatch
    (capi-dispatch)   /v21/events     Metrics
```

## Prerequisites

- AWS Account with ECS + Fargate access
- ECR repository: `hub-tracking/api` (Docker image)
- SQS queues created (Phase 2): `capi-dispatch`, `capi-dispatch-dlq`
- Secrets Manager secret: `meta-capi-credentials`
- IAM role with SQS + Secrets Manager + CloudWatch permissions
- VPC + subnets configured
- CloudWatch Log Group: `/ecs/capi-dispatch-worker`

## Step 1: Build & Push Docker Image

```bash
# Build image
docker build -t hub-tracking/api:latest -f apps/api/Dockerfile apps/api/

# Tag for ECR
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin 571944667101.dkr.ecr.us-east-1.amazonaws.com

docker tag hub-tracking/api:latest 571944667101.dkr.ecr.us-east-1.amazonaws.com/hub-tracking/api:latest

# Push to ECR
docker push 571944667101.dkr.ecr.us-east-1.amazonaws.com/hub-tracking/api:latest
```

## Step 2: Create IAM Role

### Task Execution Role (ecsTaskExecutionRole)

Allows Fargate to pull image and write logs:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "ecr:GetAuthorizationToken",
        "ecr:BatchGetImage",
        "ecr:GetDownloadUrlForLayer"
      ],
      "Resource": "*"
    },
    {
      "Effect": "Allow",
      "Action": [
        "logs:CreateLogStream",
        "logs:PutLogEvents"
      ],
      "Resource": "arn:aws:logs:us-east-1:571944667101:log-group:/ecs/capi-dispatch-worker:*"
    }
  ]
}
```

### Task Role (ecsTaskRole)

Allows container to access SQS, Secrets Manager, CloudWatch:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "sqs:ReceiveMessage",
        "sqs:DeleteMessage",
        "sqs:SendMessage",
        "sqs:GetQueueAttributes"
      ],
      "Resource": [
        "arn:aws:sqs:us-east-1:571944667101:capi-dispatch",
        "arn:aws:sqs:us-east-1:571944667101:capi-dispatch-dlq"
      ]
    },
    {
      "Effect": "Allow",
      "Action": [
        "secretsmanager:GetSecretValue"
      ],
      "Resource": "arn:aws:secretsmanager:us-east-1:571944667101:secret:meta-capi-credentials*"
    },
    {
      "Effect": "Allow",
      "Action": [
        "cloudwatch:PutMetricData"
      ],
      "Resource": "*"
    }
  ]
}
```

## Step 3: Create CloudWatch Log Group

```bash
aws logs create-log-group \
  --log-group-name /ecs/capi-dispatch-worker \
  --region us-east-1

aws logs put-retention-policy \
  --log-group-name /ecs/capi-dispatch-worker \
  --retention-in-days 7 \
  --region us-east-1
```

## Step 4: Create ECS Task Definition

```bash
aws ecs register-task-definition \
  --family capi-dispatch-worker \
  --network-mode awsvpc \
  --requires-compatibilities FARGATE \
  --cpu 256 \
  --memory 512 \
  --task-role-arn arn:aws:iam::571944667101:role/ecsTaskRole \
  --execution-role-arn arn:aws:iam::571944667101:role/ecsTaskExecutionRole \
  --container-definitions '[
    {
      "name": "api",
      "image": "571944667101.dkr.ecr.us-east-1.amazonaws.com/hub-tracking/api:latest",
      "portMappings": [{"containerPort": 3001, "protocol": "tcp"}],
      "environment": [
        {"name": "NODE_ENV", "value": "production"},
        {"name": "SQS_QUEUE_URL", "value": "https://sqs.us-east-1.amazonaws.com/571944667101/capi-dispatch"},
        {"name": "SQS_DLQ_URL", "value": "https://sqs.us-east-1.amazonaws.com/571944667101/capi-dispatch-dlq"},
        {"name": "META_CAPI_SECRET_NAME", "value": "meta-capi-credentials"},
        {"name": "AWS_REGION", "value": "us-east-1"}
      ],
      "logConfiguration": {
        "logDriver": "awslogs",
        "options": {
          "awslogs-group": "/ecs/capi-dispatch-worker",
          "awslogs-region": "us-east-1",
          "awslogs-stream-prefix": "ecs"
        }
      },
      "healthCheck": {
        "command": ["CMD-SHELL", "node -e \"require('http').get('http://localhost:3001/health', (r) => {if(r.statusCode !== 200) throw new Error()})\" || exit 1"],
        "interval": 30,
        "timeout": 5,
        "retries": 3,
        "startPeriod": 60
      }
    }
  ]' \
  --region us-east-1
```

## Step 5: Create ECS Service

```bash
aws ecs create-service \
  --cluster hub-tracking-prod \
  --service-name capi-dispatch-worker \
  --task-definition capi-dispatch-worker:1 \
  --desired-count 2 \
  --launch-type FARGATE \
  --network-configuration "awsvpcConfiguration={subnets=[subnet-xxx,subnet-yyy],securityGroups=[sg-zzz],assignPublicIp=DISABLED}" \
  --load-balancers targetGroupArn=arn:aws:elasticloadbalancing:...,containerName=api,containerPort=3001 \
  --region us-east-1
```

## Step 6: Configure Auto Scaling

```bash
# Create Auto Scaling Target
aws application-autoscaling register-scalable-target \
  --service-namespace ecs \
  --scalable-dimension ecs:service:DesiredCount \
  --resource-id service/hub-tracking-prod/capi-dispatch-worker \
  --min-capacity 2 \
  --max-capacity 10 \
  --region us-east-1

# Scale by CPU
aws application-autoscaling put-scaling-policy \
  --policy-name capi-dispatch-worker-cpu-scaling \
  --service-namespace ecs \
  --scalable-dimension ecs:service:DesiredCount \
  --resource-id service/hub-tracking-prod/capi-dispatch-worker \
  --policy-type TargetTrackingScaling \
  --target-tracking-scaling-policy-configuration '{
    "TargetValue": 70.0,
    "PredefinedMetricSpecification": {
      "PredefinedMetricType": "ECSServiceAverageCPUUtilization"
    },
    "ScaleOutCooldown": 60,
    "ScaleInCooldown": 300
  }' \
  --region us-east-1

# Scale by SQS Queue Depth
aws application-autoscaling put-scaling-policy \
  --policy-name capi-dispatch-worker-queue-scaling \
  --service-namespace ecs \
  --scalable-dimension ecs:service:DesiredCount \
  --resource-id service/hub-tracking-prod/capi-dispatch-worker \
  --policy-type TargetTrackingScaling \
  --target-tracking-scaling-policy-configuration '{
    "TargetValue": 100.0,
    "CustomizedMetricSpecification": {
      "MetricName": "ApproximateNumberOfMessagesVisible",
      "Namespace": "AWS/SQS",
      "Statistic": "Average",
      "Unit": "Count"
    },
    "ScaleOutCooldown": 60,
    "ScaleInCooldown": 300
  }' \
  --region us-east-1
```

## Step 7: CloudWatch Alarms

```bash
# Alert on SQS Queue Depth > 1000
aws cloudwatch put-metric-alarm \
  --alarm-name capi-dispatch-queue-depth \
  --alarm-description "Alert if capi-dispatch queue depth exceeds 1000" \
  --metric-name ApproximateNumberOfMessagesVisible \
  --namespace AWS/SQS \
  --statistic Average \
  --period 300 \
  --threshold 1000 \
  --comparison-operator GreaterThanThreshold \
  --alarm-actions arn:aws:sns:us-east-1:571944667101:on-call-sns

# Alert on DLQ Messages > 100
aws cloudwatch put-metric-alarm \
  --alarm-name capi-dispatch-dlq-accumulation \
  --alarm-description "Alert if DLQ receives > 100 messages" \
  --metric-name ApproximateNumberOfMessagesVisible \
  --namespace AWS/SQS \
  --dimensions Name=QueueName,Value=capi-dispatch-dlq \
  --statistic Sum \
  --period 300 \
  --threshold 100 \
  --comparison-operator GreaterThanThreshold \
  --alarm-actions arn:aws:sns:us-east-1:571944667101:on-call-sns

# Alert on Task Failures
aws cloudwatch put-metric-alarm \
  --alarm-name capi-dispatch-worker-task-failures \
  --alarm-description "Alert if Fargate tasks fail" \
  --metric-name TaskCount \
  --namespace ECS/ContainerInsights \
  --dimensions Name=ServiceName,Value=capi-dispatch-worker Name=ClusterName,Value=hub-tracking-prod \
  --statistic Average \
  --period 60 \
  --threshold 2 \
  --comparison-operator LessThanThreshold \
  --alarm-actions arn:aws:sns:us-east-1:571944667101:on-call-sns
```

## Step 8: Monitor & Verify

### Check Service Status

```bash
aws ecs describe-services \
  --cluster hub-tracking-prod \
  --services capi-dispatch-worker \
  --region us-east-1
```

### View Task Logs

```bash
aws logs tail /ecs/capi-dispatch-worker --follow --region us-east-1
```

### Monitor CloudWatch Metrics

```bash
# Throughput (events/sec)
aws cloudwatch get-metric-statistics \
  --namespace Track-AI/CAPI \
  --metric-name DispatchSuccess \
  --start-time $(date -u -d '1 hour ago' +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 60 \
  --statistics Sum \
  --region us-east-1
```

## Rollback Procedure

If issues occur:

```bash
# Revert to previous task definition
aws ecs update-service \
  --cluster hub-tracking-prod \
  --service capi-dispatch-worker \
  --task-definition capi-dispatch-worker:0 \
  --region us-east-1

# Force new deployment
aws ecs update-service \
  --cluster hub-tracking-prod \
  --service capi-dispatch-worker \
  --force-new-deployment \
  --region us-east-1
```

## Maintenance

### Update Service

```bash
# Push new image to ECR
docker push 571944667101.dkr.ecr.us-east-1.amazonaws.com/hub-tracking/api:latest

# Register new task definition (auto picks latest image)
aws ecs register-task-definition --cli-input-json file://task-definition.json

# Update service
aws ecs update-service \
  --cluster hub-tracking-prod \
  --service capi-dispatch-worker \
  --task-definition capi-dispatch-worker:2 \
  --force-new-deployment \
  --region us-east-1
```

### Monitor Logs

```bash
# Real-time logs
aws logs tail /ecs/capi-dispatch-worker --follow

# Search for errors
aws logs filter-log-events \
  --log-group-name /ecs/capi-dispatch-worker \
  --filter-pattern "ERROR" \
  --region us-east-1
```

## Troubleshooting

| Issue | Diagnosis | Fix |
|-------|-----------|-----|
| Tasks failing to start | Check CloudWatch Logs for errors | Review container logs, verify IAM role permissions |
| High SQS queue depth | Worker throughput < ingestion rate | Scale up replicas, check Meta API latency |
| DLQ accumulating messages | Worker failures or invalid payloads | Check DispatchAttempt logs, validate conversion data |
| Meta API timeouts | Circuit breaker tripped | Verify Meta API health, check network connectivity |
| Memory/CPU throttling | Resource constraints | Increase task CPU/memory allocation |

## Performance Targets

- **Throughput**: 1000+ events/min (100+ events/sec with 10 replicas)
- **Latency**: p95 < 2s (SQS poll → Meta send → logged)
- **Success Rate**: 99%+ (DLQ < 1%)
- **Availability**: 99.9% (multi-AZ + health checks)

---

*Deployment ready. See Story 009 Phase 3 for E2E testing results.*
