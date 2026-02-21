import { describe, it, expect, beforeEach, vi } from 'vitest'; // vi used for mocking
import { CircuitBreaker, CircuitState } from './circuit-breaker';

describe('CircuitBreaker', () => {
  let breaker: CircuitBreaker;

  beforeEach(() => {
    breaker = new CircuitBreaker({
      failureThreshold: 3,
      successThreshold: 2,
      resetTimeoutMs: 100, // Short timeout for testing
    });
  });

  describe('CLOSED state', () => {
    it('should start in CLOSED state', () => {
      expect(breaker.getState()).toBe(CircuitState.CLOSED);
    });

    it('should execute successful function', async () => {
      const fn = vi.fn().mockResolvedValue('success');
      const result = await breaker.execute(fn);

      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should allow failures up to threshold', async () => {
      const fn = vi.fn().mockRejectedValue(new Error('fail'));

      // First 2 failures should be allowed
      try {
        await breaker.execute(fn);
      } catch {
        // Expected failure
      }
      expect(breaker.getState()).toBe(CircuitState.CLOSED);

      try {
        await breaker.execute(fn);
      } catch {
        // Expected failure
      }
      expect(breaker.getState()).toBe(CircuitState.CLOSED);

      // Third failure should open circuit
      try {
        await breaker.execute(fn);
      } catch {
        // Expected failure
      }
      expect(breaker.getState()).toBe(CircuitState.OPEN);
    });
  });

  describe('OPEN state', () => {
    it('should reject requests when OPEN', async () => {
      const fn = vi.fn().mockRejectedValue(new Error('fail'));

      // Open the circuit
      for (let i = 0; i < 3; i++) {
        try {
          await breaker.execute(fn);
        } catch {
          // Expected
        }
      }

      expect(breaker.getState()).toBe(CircuitState.OPEN);

      // Further calls should reject immediately
      await expect(breaker.execute(vi.fn())).rejects.toThrow('is OPEN');
    });

    it('should transition to HALF_OPEN after timeout', async () => {
      const fn = vi.fn().mockRejectedValue(new Error('fail'));

      // Open circuit
      for (let i = 0; i < 3; i++) {
        try {
          await breaker.execute(fn);
        } catch {
          // Expected
        }
      }

      expect(breaker.getState()).toBe(CircuitState.OPEN);

      // Wait for reset timeout
      await new Promise((resolve) => setTimeout(resolve, 150));

      // Next call should try (transition to HALF_OPEN)
      const testFn = vi.fn().mockRejectedValue(new Error('fail'));
      await expect(breaker.execute(testFn)).rejects.toThrow();

      expect(breaker.getState()).toBe(CircuitState.OPEN); // Re-opened
    });
  });

  describe('HALF_OPEN state', () => {
    it('should close after success threshold reached', async () => {
      // Open circuit
      const failFn = vi.fn().mockRejectedValue(new Error('fail'));
      for (let i = 0; i < 3; i++) {
        try {
          await breaker.execute(failFn);
        } catch {
          // Expected
        }
      }

      // Wait for reset
      await new Promise((resolve) => setTimeout(resolve, 150));

      // First success in HALF_OPEN
      const successFn = vi.fn().mockResolvedValue('ok');
      await breaker.execute(successFn);
      expect(breaker.getState()).toBe(CircuitState.HALF_OPEN);

      // Second success should close
      await breaker.execute(successFn);
      expect(breaker.getState()).toBe(CircuitState.CLOSED);
    });

    it('should reopen on failure during HALF_OPEN', async () => {
      // Open circuit
      const failFn = vi.fn().mockRejectedValue(new Error('fail'));
      for (let i = 0; i < 3; i++) {
        try {
          await breaker.execute(failFn);
        } catch {
          // Expected
        }
      }

      // Wait for reset
      await new Promise((resolve) => setTimeout(resolve, 150));

      // Failure in HALF_OPEN should reopen
      await expect(breaker.execute(failFn)).rejects.toThrow();
      expect(breaker.getState()).toBe(CircuitState.OPEN);
    });
  });

  describe('reset', () => {
    it('should reset to initial state', async () => {
      const fn = vi.fn().mockRejectedValue(new Error('fail'));

      // Open circuit
      for (let i = 0; i < 3; i++) {
        try {
          await breaker.execute(fn);
        } catch {
          // Expected
        }
      }

      expect(breaker.getState()).toBe(CircuitState.OPEN);

      // Reset
      breaker.reset();
      expect(breaker.getState()).toBe(CircuitState.CLOSED);
      expect(breaker.getMetrics().failureCount).toBe(0);
    });
  });

  describe('getMetrics', () => {
    it('should return metrics', async () => {
      const metrics = breaker.getMetrics();

      expect(metrics).toHaveProperty('state');
      expect(metrics).toHaveProperty('failureCount');
      expect(metrics).toHaveProperty('successCount');
      expect(metrics.state).toBe(CircuitState.CLOSED);
      expect(metrics.failureCount).toBe(0);
    });

    it('should include nextAttemptTime when OPEN', async () => {
      const fn = vi.fn().mockRejectedValue(new Error('fail'));

      // Open circuit
      for (let i = 0; i < 3; i++) {
        try {
          await breaker.execute(fn);
        } catch {
          // Expected
        }
      }

      const metrics = breaker.getMetrics();
      expect(metrics.state).toBe(CircuitState.OPEN);
      expect(metrics.nextAttemptTime).toBeDefined();
    });
  });
});
