# CloudWatch Setup for Production Monitoring (Story 011g-c)

## Overview

This document provides step-by-step instructions for setting up CloudWatch monitoring for Hub Server-Side Tracking in production.

**Components:**
- 8 CloudWatch Alarms (critical, high, medium severity)
- 1 CloudWatch Dashboard (real-time KPIs + graphs)
- PagerDuty Integration (SNS → PagerDuty)
- 2 Runbooks (DLQ troubleshooting, circuit breaker trip)

---

## Step 1: Create CloudWatch Alarms

Execute the alarm setup script:

```bash
./scripts/setup-cloudwatch-alarms.sh
```

This creates 8 alarms:
1. ✅ DLQ Depth > 100 (CRITICAL) — dispatched conversions stuck
2. ✅ Circuit Breaker OPEN > 3 min (HIGH) — service degraded
3. ✅ Webhook Success Rate < 95% (CRITICAL) — too many failures
4. ✅ ECS CPU > 80% (MEDIUM) — resource constraint
5. ✅ Database Connections > 80% (HIGH) — pool exhaustion
6. ✅ API Latency p95 > 5s (MEDIUM) — performance degradation
7. ✅ SQS Queue Depth > 1000 (HIGH) — backlog building
8. ✅ Meta Token Expires < 24h (HIGH) — auth failure risk

**Verify:** Check AWS CloudWatch console → Alarms to confirm all 8 created.

---

## Step 2: Create CloudWatch Dashboard

Create dashboard in CloudWatch console or via AWS CLI:

```bash
# Create dashboard with KPIs + graphs (JSON template)
aws cloudwatch put-dashboard \
  --dashboard-name TrackAI-Production \
  --dashboard-body file://scripts/dashboard-config.json
```

**Dashboard structure:**
```
┌─────────────────────────────────────────┐
│ KPI Cards (6 metrics)                   │
├─ Throughput (events/sec)                │
├─ Success Rate (%)                       │
├─ Latency p95 (ms)                       │
├─ DLQ Depth                              │
├─ Match Rate (%)                         │
└─ Uptime (%)                             │

├─────────────────────────────────────────┤
│ Graphs (1h window)                      │
├─ Throughput Trend (line)                │
├─ Latency Percentiles p50/p95/p99 (line) │
├─ Success Rate Trend (area)              │
└─ DLQ Depth Over Time (bar)              │

├─────────────────────────────────────────┤
│ Alarms Status (active)                  │
└─ List of 8 alarms + current state       │
```

**Metrics to display:**
- TrackAI/Dispatch:Throughput (events/sec)
- TrackAI/Dispatch:SuccessRate (%)
- TrackAI/API:Latency-p95 (ms)
- AWS/SQS:ApproximateNumberOfMessagesVisible (DLQ queue)
- TrackAI/Webhooks:MatchRate (%)
- AWS/ECS:AvailabilityZoneSpread (uptime %)

---

## Step 3: PagerDuty Integration

### 3.1: Create SNS Topic for Alerts

```bash
# Create SNS topic
TOPIC_ARN=$(aws sns create-topic \
  --name track-ai-alerts \
  --region us-east-1 \
  --query 'TopicArn' --output text)

echo "SNS Topic ARN: $TOPIC_ARN"
```

### 3.2: Configure PagerDuty Integration

1. **In PagerDuty:**
   - Go to Services → Create Service (or select existing)
   - Integration: Select "AWS CloudWatch"
   - Generate Integration Key (API token)

2. **Subscribe SNS to PagerDuty:**
   ```bash
   aws sns subscribe \
     --topic-arn $TOPIC_ARN \
     --protocol https \
     --notification-endpoint https://events.pagerduty.com/v2/enqueue
   ```

3. **Update alarm actions to send to SNS:**
   ```bash
   aws cloudwatch put-metric-alarm-action \
     --alarm-names CAPIDispatchDLQDepth-CRITICAL \
     --alarm-actions $TOPIC_ARN
   ```

### 3.3: Test Alert Flow

```bash
# Publish test message to SNS
aws sns publish \
  --topic-arn $TOPIC_ARN \
  --subject "Test Alert" \
  --message '{"AlertType":"Test","Severity":"HIGH"}'

# Verify PagerDuty received incident
```

---

## Step 4: Test Alarms

### Test each alarm with manual trigger:

```bash
# Test DLQ alarm
aws cloudwatch set-alarm-state \
  --alarm-name CAPIDispatchDLQDepth-CRITICAL \
  --state-value ALARM \
  --state-reason "Testing alarm state"

# Verify alert in PagerDuty ✅
# Reset: set --state-value OK
```

**Repeat for all 8 alarms.**

---

## Step 5: Documentation

Runbooks already created:
- ✅ `docs/runbooks/dlq-troubleshooting.md` — DLQ emergency response
- ✅ `docs/runbooks/circuit-breaker-trip.md` — Circuit breaker recovery

Make sure team has access to:
- CloudWatch dashboard URL
- Runbooks (wiki/docs)
- PagerDuty escalation policy

---

## Step 6: Team Training

- [ ] Share dashboard URL with team
- [ ] Walk through each alarm (what triggers, what to do)
- [ ] Run mock incident drill (simulate DLQ backup)
- [ ] Verify on-call engineer can access runbooks
- [ ] Document escalation path (who to page)

---

## Monitoring Checklist

- [ ] All 8 alarms created and verified
- [ ] Dashboard created and populated with metrics
- [ ] SNS → PagerDuty integration tested
- [ ] Each alarm tested with manual trigger
- [ ] Team trained on runbooks
- [ ] On-call rotation configured in PagerDuty
- [ ] Documentation accessible to team

---

**Document Version:** 1.0 (2026-03-06)
**Last Updated:** @devops (Gage)
**Status:** Ready for Production Deployment
