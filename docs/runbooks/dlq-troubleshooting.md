# Runbook: DLQ Troubleshooting

**Purpose:** Diagnose and resolve Dead Letter Queue (DLQ) accumulation in production

**Alert Trigger:** CloudWatch alarm `capi-dispatch-dlq-depth > 100`

---

## Step 1: Assess the Situation (5 min)

```bash
# Check DLQ depth and age
aws sqs get-queue-attributes \
  --queue-url https://sqs.{AWS_REGION}.amazonaws.com/{ACCOUNT_ID}/capi-dispatch-dlq \
  --attribute-names ApproximateNumberOfMessages,ApproximateAgeOfOldestMessage

# Expected output:
# ApproximateNumberOfMessages: <count>
# ApproximateAgeOfOldestMessage: <seconds>
```

**If depth < 100:** False alarm. Check alarms configuration.
**If depth > 100 AND age < 1 hour:** Recent spike. Proceed to Step 2.
**If depth > 100 AND age > 24 hours:** Chronic issue. Proceed to Step 3.

---

## Step 2: Investigate Root Cause (10 min)

### 2a. Check Meta CAPI Status

```bash
# Query production logs for Meta API errors
aws logs filter-log-events \
  --log-group-name /ecs/track-ai-api \
  --filter-pattern "Meta CAPI" \
  --start-time $(($(date +%s) - 3600))000 \
  --query 'events[].message' | jq .

# Look for patterns:
# - "401": Token expired or invalid
# - "429": Rate limit hit
# - "5xx": Meta service outage
```

### 2b. Check Circuit Breaker Status

```bash
# Query CloudWatch for circuit breaker trips
aws cloudwatch get-metric-statistics \
  --namespace Track-AI \
  --metric-name CircuitBreakerOpen \
  --start-time $(date -u -d '1 hour ago' +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 60 \
  --statistics Maximum
```

**If CircuitBreakerOpen = 1:** Circuit breaker is open (Meta down). See Step 4.

---

## Step 3: Sample DLQ Messages

```bash
# Receive 10 messages from DLQ to understand the failure pattern
aws sqs receive-message \
  --queue-url https://sqs.{AWS_REGION}.amazonaws.com/{ACCOUNT_ID}/capi-dispatch-dlq \
  --max-number-of-messages 10 \
  --query 'Messages[].[MessageId, Body]' | jq .

# Analyze the Body field:
# - Check event_id
# - Check error reason
# - Identify common failure patterns
```

---

## Step 4: Mitigation Actions

### 4a: If Meta Token Expired

```bash
# Refresh Meta token in Secrets Manager
aws secretsmanager update-secret \
  --secret-id meta-capi-credentials \
  --secret-string '{
    "app_id": "YOUR_APP_ID",
    "app_secret": "YOUR_NEW_SECRET",
    "access_token": "YOUR_NEW_TOKEN"
  }'

# Restart ECS service to pick up new token
aws ecs update-service \
  --cluster prod \
  --service api \
  --force-new-deployment

# Wait 2-3 min for service to restart, then check DLQ depth
```

### 4b: If Meta Service Outage

```bash
# Check Meta status page: https://developers.facebook.com/status/
# If outage, wait for Meta to recover. DLQ will drain automatically.

# Set PagerDuty on-call to "known issue" status
# Monitor every 15 min for resolution
```

### 4c: If Rate Limited

```bash
# Reduce dispatch concurrency (temporary fix)
# Edit apps/api/src/capi-dispatch-worker.ts:
# Change: MAX_BATCH_SIZE = 20  →  MAX_BATCH_SIZE = 5

# Redeploy:
git add apps/api/src/capi-dispatch-worker.ts
git commit -m "fix: reduce dispatch concurrency to handle rate limits"
npm run build && docker push ...
aws ecs update-service --cluster prod --service api --force-new-deployment

# After rate limit window passes (usually 1 hour), revert change
```

---

## Step 5: Drain DLQ (if needed)

```bash
# Process messages manually (if safe):
# 1. Review each message in DLQ (from Step 3)
# 2. Identify if safe to retry or delete

# Delete messages (if determined to be non-recoverable):
aws sqs purge-queue \
  --queue-url https://sqs.{AWS_REGION}.amazonaws.com/{ACCOUNT_ID}/capi-dispatch-dlq

# ⚠️ WARNING: PURGE_QUEUE DELETES ALL MESSAGES IN DLQ. USE WITH CAUTION.
# Prefer manual deletion or replay with fixes.
```

---

## Step 6: Post-Incident

1. Update ticket: "DLQ incident root cause: [cause]. Mitigated by [action]."
2. If systemic issue: Create ticket for permanent fix
3. Update on-call runbook with new findings
4. Send post-mortem to team Slack

---

## Escalation Criteria

Escalate to @devops if:
- DLQ depth > 1000 AND growing (production degradation)
- Meta CAPI outage confirmed AND persisting > 4 hours
- Unable to determine root cause after Step 3

Contact: @devops-oncall Slack channel
