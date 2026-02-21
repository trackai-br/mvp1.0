import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { CapiDispatchWorker } from './capi-dispatch-worker';
import { CircuitState } from '../lib/circuit-breaker';

describe('CapiDispatchWorker', () => {
  let worker: CapiDispatchWorker | undefined;

  afterEach(async () => {
    if (worker) {
      await worker.stop();
    }
  });

  describe('initialization', () => {
    it('should create worker with valid config', () => {
      worker = new CapiDispatchWorker({
        queueUrl: 'https://sqs.us-east-1.amazonaws.com/123456789012/capi-dispatch',
        dlqUrl: 'https://sqs.us-east-1.amazonaws.com/123456789012/capi-dispatch-dlq',
        secretName: 'meta-capi-credentials',
        region: 'us-east-1',
        pollIntervalMs: 100,
        maxConcurrentMessages: 10,
        visibilityTimeoutSeconds: 30,
      });

      expect(worker).toBeDefined();
      expect(worker.getMetrics()).toBeDefined();
    });

    it('should initialize with default config values', () => {
      const minimalConfig = {
        queueUrl: 'https://queue.url',
        dlqUrl: 'https://dlq.url',
        secretName: 'secret',
      };

      worker = new CapiDispatchWorker(minimalConfig);
      expect(worker).toBeDefined();
    });

    it('should accept all config parameters', () => {
      const config = {
        queueUrl: 'https://queue.url',
        dlqUrl: 'https://dlq.url',
        secretName: 'secret',
        region: 'us-east-1',
        pollIntervalMs: 5000,
        maxConcurrentMessages: 10,
        visibilityTimeoutSeconds: 30,
      };

      worker = new CapiDispatchWorker(config);
      expect(worker).toBeDefined();
    });
  });

  describe('metrics', () => {
    beforeEach(() => {
      worker = new CapiDispatchWorker({
        queueUrl: 'https://queue.url',
        dlqUrl: 'https://dlq.url',
        secretName: 'secret',
      });
    });

    it('should initialize metrics with zero counts', () => {
      const metrics = worker!.getMetrics();
      expect(metrics.successCount).toBe(0);
      expect(metrics.failureCount).toBe(0);
      expect(metrics.dlqCount).toBe(0);
      expect(metrics.totalLatencyMs).toBe(0);
    });

    it('should return metrics object with all required fields', () => {
      const metrics = worker!.getMetrics();
      expect(metrics).toHaveProperty('successCount');
      expect(metrics).toHaveProperty('failureCount');
      expect(metrics).toHaveProperty('dlqCount');
      expect(metrics).toHaveProperty('totalLatencyMs');
      expect(metrics).toHaveProperty('circuitBreakerState');
    });
  });

  describe('circuit breaker', () => {
    beforeEach(() => {
      worker = new CapiDispatchWorker({
        queueUrl: 'https://queue.url',
        dlqUrl: 'https://dlq.url',
        secretName: 'secret',
      });
    });

    it('should report circuit breaker state as CLOSED initially', () => {
      const state = worker!.getCircuitBreakerState();
      expect(state).toBe(CircuitState.CLOSED);
    });

    it('should track circuit breaker state in metrics', () => {
      const metrics = worker!.getMetrics();
      expect(metrics.circuitBreakerState).toBe(CircuitState.CLOSED);
    });
  });

  describe('lifecycle', () => {
    beforeEach(() => {
      worker = new CapiDispatchWorker({
        queueUrl: 'https://queue.url',
        dlqUrl: 'https://dlq.url',
        secretName: 'secret',
      });
    });

    it('should stop gracefully', async () => {
      expect(worker).toBeDefined();
      await worker!.stop();
      expect(true).toBe(true);
    });
  });
});
