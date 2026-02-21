/**
 * Circuit Breaker pattern implementation
 *
 * States:
 * - CLOSED: Normal operation
 * - OPEN: Failing, reject new requests
 * - HALF_OPEN: Testing if service recovered
 */

export enum CircuitState {
  CLOSED = 'CLOSED',
  OPEN = 'OPEN',
  HALF_OPEN = 'HALF_OPEN',
}

export interface CircuitBreakerConfig {
  failureThreshold?: number; // Failures before opening (default: 5)
  successThreshold?: number; // Successes to close from half-open (default: 2)
  resetTimeoutMs?: number; // Time before half-open attempt (default: 60000)
  name?: string;
}

export class CircuitBreaker {
  private state: CircuitState = CircuitState.CLOSED;
  private failureCount = 0;
  private successCount = 0;
  private nextAttemptTime = 0;

  private failureThreshold: number;
  private successThreshold: number;
  private resetTimeoutMs: number;
  private name: string;

  constructor(config: CircuitBreakerConfig = {}) {
    this.failureThreshold = config.failureThreshold ?? 5;
    this.successThreshold = config.successThreshold ?? 2;
    this.resetTimeoutMs = config.resetTimeoutMs ?? 60000; // 60 seconds
    this.name = config.name ?? 'CircuitBreaker';
  }

  /**
   * Execute function with circuit breaker protection
   */
  async execute<R>(fn: () => Promise<R>): Promise<R> {
    // Check if should reject due to open circuit
    if (this.state === CircuitState.OPEN) {
      if (Date.now() < this.nextAttemptTime) {
        throw new Error(`${this.name} is OPEN. Cannot execute.`);
      }
      // Transition to HALF_OPEN for testing
      this.state = CircuitState.HALF_OPEN;
      this.successCount = 0;
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  /**
   * Handle successful execution
   */
  private onSuccess(): void {
    this.failureCount = 0;

    if (this.state === CircuitState.HALF_OPEN) {
      this.successCount++;
      if (this.successCount >= this.successThreshold) {
        this.close();
      }
    }
  }

  /**
   * Handle failed execution
   */
  private onFailure(): void {
    this.failureCount++;

    if (this.state === CircuitState.HALF_OPEN) {
      // Immediately reopen if failure during half-open
      this.open();
      return;
    }

    if (this.failureCount >= this.failureThreshold) {
      this.open();
    }
  }

  /**
   * Open circuit (reject requests)
   */
  private open(): void {
    this.state = CircuitState.OPEN;
    this.nextAttemptTime = Date.now() + this.resetTimeoutMs;
    console.log(
      `${this.name} opened. Will retry in ${this.resetTimeoutMs}ms (${new Date(
        this.nextAttemptTime
      ).toISOString()})`
    );
  }

  /**
   * Close circuit (accept requests)
   */
  private close(): void {
    this.state = CircuitState.CLOSED;
    this.failureCount = 0;
    this.successCount = 0;
    console.log(`${this.name} closed. Resume normal operation.`);
  }

  /**
   * Get current state
   */
  getState(): CircuitState {
    return this.state;
  }

  /**
   * Reset for testing
   */
  reset(): void {
    this.state = CircuitState.CLOSED;
    this.failureCount = 0;
    this.successCount = 0;
    this.nextAttemptTime = 0;
  }

  /**
   * Get metrics
   */
  getMetrics(): {
    state: CircuitState;
    failureCount: number;
    successCount: number;
    nextAttemptTime?: number;
  } {
    return {
      state: this.state,
      failureCount: this.failureCount,
      successCount: this.successCount,
      nextAttemptTime: this.state === CircuitState.OPEN ? this.nextAttemptTime : undefined,
    };
  }
}
