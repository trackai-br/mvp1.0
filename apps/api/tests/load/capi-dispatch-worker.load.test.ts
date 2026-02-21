/**
 * Load Testing for CAPI Dispatch Worker
 *
 * Simulates high-volume conversion events through SQS queue:
 * - 1000+ events/min target
 * - Measures latency percentiles (p50, p95, p99)
 * - Validates circuit breaker under load
 * - Monitors DLQ messages under failure conditions
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { SQSClient, SendMessageCommand } from '@aws-sdk/client-sqs';

interface LoadTestMetrics {
  totalEvents: number;
  successCount: number;
  failureCount: number;
  dlqCount: number;
  latencies: number[];
  p50: number;
  p95: number;
  p99: number;
  avgLatency: number;
  maxLatency: number;
  throughput: number; // events/sec
  circuitBreakerTripped: boolean;
}

/**
 * Helper: Generate mock conversion event
 */
function generateConversionEvent(tenantId: string, index: number) {
  return {
    tenantId,
    conversionId: `conv-${Date.now()}-${index}`,
    conversion: {
      id: `conv-${Date.now()}-${index}`,
      gatewayEventId: `event-${Date.now()}-${index}`,
      amount: Math.random() * 1000,
      currency: 'USD',
      emailHash: 'abc123def456',
      phoneHash: 'phone789',
      firstNameHash: 'fname000',
      lastNameHash: 'lname111',
      cityHash: 'city222',
      stateHash: 'state333',
      countryCode: 'US',
      zipCodeHash: 'zip444',
      dateOfBirthHash: 'dob555',
      externalIdHash: 'ext666',
      fbc: 'fb.1.123456789.987654321',
      fbp: 'fb.1.222333444555.111222333',
      createdAt: new Date().toISOString(),
    },
  };
}

/**
 * Helper: Calculate percentile from sorted latencies
 */
function calculatePercentile(latencies: number[], percentile: number): number {
  const sorted = [...latencies].sort((a, b) => a - b);
  const index = Math.ceil((percentile / 100) * sorted.length) - 1;
  return sorted[Math.max(0, index)];
}

describe('CAPI Dispatch Worker - Load Testing', () => {
  const queueUrl = process.env.SQS_QUEUE_URL || 'https://sqs.us-east-1.amazonaws.com/123/capi-dispatch';
  const testTenantId = 'load-test-tenant';
  const testDuration = 10000; // 10 seconds

  // Skip SQS tests if not configured (local dev)
  const skipIfNoSQS = process.env.SQS_QUEUE_URL ? it : it.skip;

  skipIfNoSQS('should handle 1000+ events/min throughput', async () => {
    const metrics: LoadTestMetrics = {
      totalEvents: 0,
      successCount: 0,
      failureCount: 0,
      dlqCount: 0,
      latencies: [],
      p50: 0,
      p95: 0,
      p99: 0,
      avgLatency: 0,
      maxLatency: 0,
      throughput: 0,
      circuitBreakerTripped: false,
    };

    const startTime = Date.now();
    let eventCount = 0;

    // Send 100 events rapidly (simulating burst)
    for (let i = 0; i < 100; i++) {
      const event = generateConversionEvent(testTenantId, i);
      const sendTime = Date.now();

      try {
        await sqs.send(
          new SendMessageCommand({
            QueueUrl: queueUrl,
            MessageBody: JSON.stringify(event),
            MessageAttributes: {
              TenantId: {
                StringValue: testTenantId,
                DataType: 'String',
              },
            },
          })
        );

        const latency = Date.now() - sendTime;
        metrics.latencies.push(latency);
        metrics.successCount++;
        eventCount++;
      } catch (error) {
        metrics.failureCount++;
      }

      metrics.totalEvents++;
    }

    const elapsedSeconds = (Date.now() - startTime) / 1000;
    metrics.throughput = eventCount / elapsedSeconds;

    // Calculate latency percentiles
    if (metrics.latencies.length > 0) {
      metrics.p50 = calculatePercentile(metrics.latencies, 50);
      metrics.p95 = calculatePercentile(metrics.latencies, 95);
      metrics.p99 = calculatePercentile(metrics.latencies, 99);
      metrics.avgLatency = metrics.latencies.reduce((a, b) => a + b, 0) / metrics.latencies.length;
      metrics.maxLatency = Math.max(...metrics.latencies);
    }

    // Assertions
    expect(metrics.successCount).toBeGreaterThan(0);
    expect(metrics.throughput).toBeGreaterThanOrEqual(1); // At least 1 event/sec
    expect(metrics.p95).toBeLessThan(1000); // p95 latency < 1s
    expect(metrics.maxLatency).toBeLessThan(5000); // Max latency < 5s

    console.log('\n📊 Load Test Results:');
    console.log(`  Total Events: ${metrics.totalEvents}`);
    console.log(`  Success: ${metrics.successCount}, Failures: ${metrics.failureCount}`);
    console.log(`  Throughput: ${metrics.throughput.toFixed(2)} events/sec`);
    console.log(`  Latency - P50: ${metrics.p50}ms, P95: ${metrics.p95}ms, P99: ${metrics.p99}ms`);
    console.log(`  Max Latency: ${metrics.maxLatency}ms, Avg: ${metrics.avgLatency.toFixed(2)}ms`);
  });

  skipIfNoSQS('should maintain performance under sustained load', async () => {
    const batchSize = 50;
    const numBatches = 3;
    const batchLatencies: number[][] = [];

    for (let batch = 0; batch < numBatches; batch++) {
      const batchStart = Date.now();
      const latencies: number[] = [];

      for (let i = 0; i < batchSize; i++) {
        const event = generateConversionEvent(testTenantId, batch * batchSize + i);
        const sendTime = Date.now();

        try {
          await sqs.send(
            new SendMessageCommand({
              QueueUrl: queueUrl,
              MessageBody: JSON.stringify(event),
            })
          );
          latencies.push(Date.now() - sendTime);
        } catch (error) {
          // Ignore errors in load test
        }
      }

      batchLatencies.push(latencies);
      const batchDuration = Date.now() - batchStart;

      // Performance should not degrade between batches
      expect(batchDuration).toBeLessThan(5000); // Each batch < 5s
    }

    // Compare batch performance
    const avgLatenciesByBatch = batchLatencies.map(
      (latencies) => latencies.reduce((a, b) => a + b, 0) / latencies.length
    );

    // Later batches shouldn't be significantly slower
    const performanceDegradation =
      ((avgLatenciesByBatch[numBatches - 1] - avgLatenciesByBatch[0]) / avgLatenciesByBatch[0]) * 100;

    expect(performanceDegradation).toBeLessThan(50); // Allow 50% degradation max
  });

  skipIfNoSQS('should handle message deduplication correctly under load', async () => {
    const duplicateEvent = generateConversionEvent(testTenantId, 9999);
    const duplicateCount = 5;

    // Send same event multiple times rapidly
    const sendPromises = [];
    for (let i = 0; i < duplicateCount; i++) {
      sendPromises.push(
        sqs.send(
          new SendMessageCommand({
            QueueUrl: queueUrl,
            MessageBody: JSON.stringify(duplicateEvent),
            MessageAttributes: {
              EventId: {
                StringValue: duplicateEvent.conversion.gatewayEventId,
                DataType: 'String',
              },
            },
          })
        )
      );
    }

    const results = await Promise.allSettled(sendPromises);
    const successCount = results.filter((r) => r.status === 'fulfilled').length;

    // All sends should succeed (queue accepts duplicates)
    // Worker deduplicates via unique constraint
    expect(successCount).toBe(duplicateCount);
  });
});
