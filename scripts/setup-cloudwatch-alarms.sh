#!/bin/bash
# CloudWatch Alarms Setup for Hub Server-Side Tracking Production Monitoring
# Story 011g-c: Production Monitoring & Alerting

set -e

REGION="us-east-1"
ACCOUNT_ID="751702759697"

echo "🔧 Setting up CloudWatch Alarms for Hub Server-Side Tracking..."

# Alarm 1: DLQ Depth > 100 (30 min sustained)
echo "Creating alarm: DLQ Depth > 100"
aws cloudwatch put-metric-alarm \
  --alarm-name CAPIDispatchDLQDepth-CRITICAL \
  --alarm-description "SQS DLQ depth > 100 for 30 min (CRITICAL) - dispatched conversions stuck" \
  --metric-name ApproximateNumberOfMessagesVisible \
  --namespace AWS/SQS \
  --statistic Average \
  --period 300 \
  --evaluation-periods 6 \
  --threshold 100 \
  --comparison-operator GreaterThanThreshold \
  --treat-missing-data notBreaching \
  --region $REGION

# Alarm 2: Circuit Breaker OPEN > 3 min
echo "Creating alarm: Circuit Breaker OPEN"
aws cloudwatch put-metric-alarm \
  --alarm-name CAPIDispatchCircuitBreakerOpen-HIGH \
  --alarm-description "Meta CAPI circuit breaker OPEN > 3 min (HIGH) - service degraded" \
  --metric-name CircuitBreakerState \
  --namespace TrackAI/Dispatch \
  --statistic Average \
  --period 60 \
  --evaluation-periods 3 \
  --threshold 1 \
  --comparison-operator GreaterThanOrEqualToThreshold \
  --treat-missing-data notBreaching \
  --region $REGION

# Alarm 3: Webhook Success Rate < 95% (1h window)
echo "Creating alarm: Webhook Success Rate < 95%"
aws cloudwatch put-metric-alarm \
  --alarm-name WebhookSuccessRate-CRITICAL \
  --alarm-description "Webhook success rate < 95% in 1h window (CRITICAL)" \
  --metric-name SuccessRate \
  --namespace TrackAI/Webhooks \
  --statistic Average \
  --period 3600 \
  --evaluation-periods 1 \
  --threshold 95 \
  --comparison-operator LessThanThreshold \
  --treat-missing-data notBreaching \
  --region $REGION

# Alarm 4: ECS CPU > 80% (1 min)
echo "Creating alarm: ECS CPU > 80%"
aws cloudwatch put-metric-alarm \
  --alarm-name ECSCPUUtilization-MEDIUM \
  --alarm-description "ECS service CPU > 80% (MEDIUM)" \
  --metric-name CPUUtilization \
  --namespace AWS/ECS \
  --statistic Average \
  --period 60 \
  --evaluation-periods 1 \
  --threshold 80 \
  --comparison-operator GreaterThanThreshold \
  --treat-missing-data notBreaching \
  --dimensions Name=ServiceName,Value=hub-server-side-tracking-api Name=ClusterName,Value=hub-server-side-tracking \
  --region $REGION

# Alarm 5: Database Connections > 80% of pool
echo "Creating alarm: Database Connections > 80%"
aws cloudwatch put-metric-alarm \
  --alarm-name DatabaseConnectionPoolUtilization-HIGH \
  --alarm-description "RDS connection pool > 80% utilized (HIGH)" \
  --metric-name DatabaseConnections \
  --namespace AWS/RDS \
  --statistic Average \
  --period 300 \
  --evaluation-periods 2 \
  --threshold 80 \
  --comparison-operator GreaterThanThreshold \
  --treat-missing-data notBreaching \
  --region $REGION

# Alarm 6: API Latency p95 > 5s (1 min)
echo "Creating alarm: API Latency p95 > 5s"
aws cloudwatch put-metric-alarm \
  --alarm-name APILatencyP95-MEDIUM \
  --alarm-description "API latency p95 > 5000ms (MEDIUM)" \
  --metric-name Latency-p95 \
  --namespace TrackAI/API \
  --statistic Average \
  --period 60 \
  --evaluation-periods 1 \
  --threshold 5000 \
  --comparison-operator GreaterThanThreshold \
  --treat-missing-data notBreaching \
  --region $REGION

# Alarm 7: SQS Queue Depth > 1000
echo "Creating alarm: SQS Queue Depth > 1000"
aws cloudwatch put-metric-alarm \
  --alarm-name CAPIDispatchQueueDepth-HIGH \
  --alarm-description "SQS capi-dispatch queue depth > 1000 (HIGH)" \
  --metric-name ApproximateNumberOfMessagesVisible \
  --namespace AWS/SQS \
  --statistic Average \
  --period 60 \
  --evaluation-periods 2 \
  --threshold 1000 \
  --comparison-operator GreaterThanThreshold \
  --treat-missing-data notBreaching \
  --region $REGION

# Alarm 8: Meta Token Expires < 24h
echo "Creating alarm: Meta Token Expires < 24h"
aws cloudwatch put-metric-alarm \
  --alarm-name MetaTokenExpiry-HIGH \
  --alarm-description "Meta CAPI token expires in < 24h (HIGH)" \
  --metric-name TokenExpiryHours \
  --namespace TrackAI/Security \
  --statistic Minimum \
  --period 3600 \
  --evaluation-periods 1 \
  --threshold 24 \
  --comparison-operator LessThanThreshold \
  --treat-missing-data notBreaching \
  --region $REGION

echo "✅ All 8 CloudWatch alarms created successfully!"
echo ""
echo "Next steps:"
echo "1. Verify alarms in AWS CloudWatch console"
echo "2. Configure SNS → PagerDuty for CRITICAL alarms (manual setup)"
echo "3. Test each alarm with manual trigger"
echo "4. Update runbooks with actual queue URLs and endpoints"
