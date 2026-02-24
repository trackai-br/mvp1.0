# CloudWatch Alarms Configuration

**Story 011g-c: Production Monitoring**
**Date:** 2026-02-24

---

## 8 Critical Alarms

### 1. DLQ Depth Alarm

```bash
Alarm Name: capi-dispatch-dlq-depth-high
Metric: ApproximateNumberOfMessages (capi-dispatch-dlq queue)
Threshold: > 100
Duration: 30 minutes sustained
Action: Send to SNS → PagerDuty → Oncall
Runbook: docs/runbooks/dlq-troubleshooting.md
```

**Rationale:** DLQ accumulation indicates failed dispatch events that need investigation

---

### 2. Circuit Breaker Alarm

```bash
Alarm Name: capi-dispatch-circuit-breaker-open
Metric: CircuitBreakerOpen (Custom CloudWatch metric)
Threshold: = 1 (open state)
Duration: > 3 minutes
Action: Send to SNS → PagerDuty → Oncall
Runbook: docs/runbooks/circuit-breaker-trip.md
```

**Rationale:** Circuit breaker open = dispatch halted, likely Meta CAPI issue

---

### 3. Meta Token Expiration Alarm

```bash
Alarm Name: meta-token-expiring-soon
Metric: TokenExpiresIn (Custom metric, checked every hour)
Threshold: < 86400 seconds (24 hours)
Action: Send SNS → Team Slack (#track-ai-ops)
Severity: WARNING (not critical, but proactive)
```

**Rationale:** Prevent service degradation from expired tokens

---

### 4. Webhook Success Rate Alarm

```bash
Alarm Name: webhook-success-rate-low
Metric: SuccessfulWebhooks / (SuccessfulWebhooks + FailedWebhooks)
Threshold: < 0.95 (95%)
Duration: 1 hour
Action: Send to SNS → PagerDuty → Oncall
```

**Rationale:** Drop in webhook success indicates ingest pipeline issues

---

### 5. Database Connections Alarm

```bash
Alarm Name: db-connection-pool-high
Metric: DatabaseConnections (RDS metric)
Threshold: > 80% of pool size
Duration: 5 minutes
Action: Send to SNS → Team Slack (#track-ai-ops)
Severity: WARNING
```

**Rationale:** Connection pool exhaustion leads to request rejections

---

### 6. ECS CPU Alarm

```bash
Alarm Name: api-service-cpu-high
Metric: CPUUtilization (api service)
Threshold: > 80%
Duration: 1 minute
Action: Auto-scale ECS service (up to 10 replicas)
Notification: SNS → Team Slack
```

**Rationale:** High CPU triggers auto-scaling to maintain performance

---

### 7. SQS Queue Depth Alarm

```bash
Alarm Name: capi-dispatch-queue-depth-high
Metric: ApproximateNumberOfMessages (capi-dispatch primary queue)
Threshold: > 1000
Duration: 10 minutes
Action: Send to SNS → PagerDuty → Oncall
```

**Rationale:** Large queue depth = slow dispatch, likely throughput bottleneck

---

### 8. API Latency Alarm

```bash
Alarm Name: api-latency-p95-high
Metric: p95 Latency (custom metric from X-Ray)
Threshold: > 5 seconds
Duration: 5 minutes
Action: Send to SNS → Team Slack (#track-ai-ops)
Severity: WARNING
```

**Rationale:** High latency indicates performance degradation

---

## Implementation Commands

### Deploy Alarms to Production

```bash
# Using CloudFormation (recommended):
aws cloudformation deploy \
  --template-file infra/cloudwatch/alarms.yaml \
  --stack-name track-ai-alarms-prod \
  --parameter-overrides \
    Environment=prod \
    SNSTopicArn=arn:aws:sns:us-east-1:ACCOUNT:track-ai-alerts \
    PagerDutyIntegrationKey=${PAGERDUTY_KEY}

# Or using AWS CLI directly:
./scripts/deploy-alarms.sh production
```

### Create CloudWatch Dashboard

```bash
# Dashboard includes:
# - 6 KPI Cards (top)
# - 4 Graphs (1h window)
# - 8 Alarms Status

./scripts/create-dashboard.sh production
```

---

## Dashboard Layout

```
┌─ KPI CARDS (Real-time) ──────────────────────────────────────┐
│                                                                │
│  Throughput (evt/sec)  │  Success Rate (%)  │  Latency p95 (ms) │
│      5.2               │      99.8          │       145          │
│                                                                  │
│  DLQ Depth │  Match Rate (%) │  Uptime (%) │  API Health │
│     0      │       78        │    99.9     │    OK        │
│                                                                  │
└────────────────────────────────────────────────────────────────┘

┌─ GRAPHS (1 hour window) ───────────────────────────────────────┐
│                                                                 │
│  Throughput Trend        │  Latency Percentiles (p50/p95/p99) │
│  [Line chart]            │  [Line chart with multiple lines]  │
│                          │                                     │
│  Success Rate Trend      │  DLQ Depth Over Time              │
│  [Line chart]            │  [Line chart]                     │
│                          │                                     │
└─────────────────────────────────────────────────────────────────┘

┌─ ALARMS STATUS ────────────────────────────────────────────────┐
│                                                                 │
│  ✅ capi-dispatch-dlq-depth-high          [OK]                │
│  ✅ capi-dispatch-circuit-breaker-open    [OK]                │
│  ✅ meta-token-expiring-soon              [OK]                │
│  ✅ webhook-success-rate-low              [OK]                │
│  ✅ db-connection-pool-high               [OK]                │
│  ✅ api-service-cpu-high                  [OK]                │
│  ✅ capi-dispatch-queue-depth-high        [OK]                │
│  ✅ api-latency-p95-high                  [OK]                │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## PagerDuty Integration

```bash
# Create PagerDuty integration key (do this manually in PagerDuty UI)
# Then configure SNS to send to PagerDuty:

aws sns set-topic-attributes \
  --topic-arn arn:aws:sns:us-east-1:ACCOUNT:track-ai-alerts \
  --attribute-name PagerDutyIntegrationKey \
  --attribute-value ${PAGERDUTY_KEY}
```

---

## Testing Alarms

```bash
# Send test metric to trigger alarm
aws cloudwatch put-metric-data \
  --namespace Track-AI \
  --metric-name CircuitBreakerOpen \
  --value 1

# Verify alarm fires and notification reaches PagerDuty/Slack
# Expected: Notification arrives within 60 seconds
```

---

## Notes

- Alarms are in PRODUCTION and ACTIVE
- Oncall is responsible for monitoring and responding to alerts
- Update thresholds if false positive rate > 10% per month
- Review and document every alarm trigger in post-incident review
