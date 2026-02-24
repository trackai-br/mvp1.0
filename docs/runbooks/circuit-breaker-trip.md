# Runbook: Circuit Breaker Trip Recovery

**Purpose:** Recover from circuit breaker OPEN state (Meta CAPI dispatch halted)

**Alert Trigger:** CloudWatch alarm `CircuitBreakerOpen > 3 min` OR metric value = 1

---

## Step 1: Confirm Circuit Breaker State (2 min)

```bash
# Check last circuit breaker state change
aws logs filter-log-events \
  --log-group-name /ecs/track-ai-api \
  --filter-pattern "CircuitBreaker" \
  --start-time $(($(date +%s) - 300))000 \
  --query 'events[].[timestamp, message]' | jq .

# Look for: "CircuitBreaker OPEN" message
# Note the timestamp
```

---

## Step 2: Diagnose Why It Tripped

Circuit breaker opens after **5 consecutive failures** to Meta CAPI.

```bash
# Query logs for Meta CAPI errors in the last 10 min
aws logs filter-log-events \
  --log-group-name /ecs/track-ai-api \
  --filter-pattern "Meta CAPI error" \
  --start-time $(($(date +%s) - 600))000 \
  --query 'events[].message' | jq .

# Common causes:
# - Token expired → 401 Unauthorized
# - Rate limited → 429 Too Many Requests
# - Meta down → 502 Bad Gateway, 503 Service Unavailable
```

---

## Step 3: Manual Recovery (3 options)

### Option A: Wait for Automatic Recovery (60 sec)

```bash
# Circuit breaker auto-recovers after 60 seconds of no new requests
# Monitor queue depth during this time

aws sqs get-queue-attributes \
  --queue-url https://sqs.{AWS_REGION}.amazonaws.com/{ACCOUNT_ID}/capi-dispatch \
  --attribute-names ApproximateNumberOfMessages

# Expected: Queue depth should start decreasing after 60 sec
```

### Option B: Fix Root Cause (if identified)

```bash
# If token expired:
aws secretsmanager update-secret \
  --secret-id meta-capi-credentials \
  --secret-string '{...new token...}'

# If rate limited:
# Wait 15 min for rate limit window to pass, then proceed

# Then restart ECS to pick up new config:
aws ecs update-service --cluster prod --service api --force-new-deployment
```

### Option C: Force Circuit Breaker Reset (if waiting too long)

```bash
# Last resort: Restart the dispatch worker
aws ecs update-service \
  --cluster prod \
  --service capi-dispatch-worker \
  --force-new-deployment

# This resets circuit breaker state immediately
# ⚠️ May cause temporary burst to Meta if root cause not fixed
```

---

## Step 4: Monitor Recovery (5 min)

```bash
# Check dispatch queue is draining
aws sqs get-queue-attributes \
  --queue-url https://sqs.{AWS_REGION}.amazonaws.com/{ACCOUNT_ID}/capi-dispatch \
  --attribute-names ApproximateNumberOfMessages

# Check DLQ not accumulating
aws sqs get-queue-attributes \
  --queue-url https://sqs.{AWS_REGION}.amazonaws.com/{ACCOUNT_ID}/capi-dispatch-dlq \
  --attribute-names ApproximateNumberOfMessages

# Expected: Queue draining, DLQ stable or decreasing
```

---

## Step 5: Verify Meta Connectivity

```bash
# Send test event to Meta CAPI to confirm it's responsive
curl -X POST "https://graph.facebook.com/v21.0/{PIXEL_ID}/events" \
  -H "Content-Type: application/json" \
  -d '{
    "data": [{
      "event_name": "Purchase",
      "event_time": '$(date +%s)',
      "user_data": {
        "em": "test@example.com"
      }
    }],
    "access_token": "YOUR_ACCESS_TOKEN"
  }' | jq .

# Expected: "events_received": 1
```

---

## Escalation Criteria

Escalate to @devops if:
- Circuit breaker trips repeatedly (cycles open/closed)
- Root cause not identifiable after Step 2
- Queue depth growing despite fix attempts

Contact: @devops-oncall Slack channel

---

## Prevention

1. Monitor token expiration: AlertRule if `meta_token_expires_in < 24h`
2. Implement gradual backoff for rate limiting (done in v1)
3. Setup synthetic healthchecks to Meta API every 5 min
