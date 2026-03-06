# Runbook: DLQ Troubleshooting

**Issue:** SQS Dead Letter Queue backed up — `capi-dispatch-dlq` depth > 100

**Severity:** CRITICAL

**Detection:** CloudWatch alarm fires when depth > 100 sustained for 30 minutes

---

## Resolution Steps (5 steps)

### Step 1: Verify DLQ State
```bash
aws sqs get-queue-attributes \
  --queue-url https://sqs.us-east-1.amazonaws.com/ACCOUNT_ID/capi-dispatch-dlq \
  --attribute-names ApproximateNumberOfMessages
```

### Step 2: Identify Root Cause
```bash
aws sqs receive-message \
  --queue-url https://sqs.us-east-1.amazonaws.com/ACCOUNT_ID/capi-dispatch-dlq \
  --max-number-of-messages 1
```

**Common causes:** Meta CAPI token expired, service unavailable, circuit breaker open

### Step 3: Fix Root Cause
- Meta token expired → Rotate in Secrets Manager
- Service down → Wait for recovery
- Circuit breaker → Check ECS logs

### Step 4: Replay Messages
```bash
# Replay from DLQ to main queue
aws sqs send-message \
  --queue-url https://sqs.us-east-1.amazonaws.com/ACCOUNT_ID/capi-dispatch \
  --message-body "$MESSAGE_BODY"
```

### Step 5: Monitor
```bash
watch -n 60 'aws sqs get-queue-attributes \
  --queue-url https://sqs.us-east-1.amazonaws.com/ACCOUNT_ID/capi-dispatch-dlq \
  --attribute-names ApproximateNumberOfMessages'
```

---

**Document Version:** 1.0 (2026-03-06)
**Last Updated:** @devops
