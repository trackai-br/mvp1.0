import type { ErrorType } from '@prisma/client';

/**
 * Error Classifier — Categorize dispatch failures for intelligent retry
 */

export interface ClassifiedError {
  errorType: ErrorType;
  isRetryable: boolean;
  nextRetryDelayMs: number;
  shouldMaxOutRetries: boolean;
}

/**
 * Classify error based on HTTP status or error type
 * 5xx = Server error → RETRY
 * 4xx = Client error → DON'T RETRY
 * null/network = Timeout → RETRY
 */
export function classifyError(
  httpStatusCode: number | null | undefined,
  errorMessage: string
): ErrorType {
  if (!httpStatusCode) {
    // No status code = network error (timeout, connection refused, etc.)
    if (errorMessage.includes('timeout') || errorMessage.includes('ECONNREFUSED')) {
      return 'timeout' as ErrorType;
    }
    return 'timeout' as ErrorType; // Default to timeout for network errors
  }

  if (httpStatusCode >= 500) {
    return 'http_5xx' as ErrorType;
  }

  if (httpStatusCode >= 400) {
    return 'http_4xx' as ErrorType;
  }

  return 'unknown' as ErrorType;
}

/**
 * Determine if error is retryable based on type and attempt count
 * Rules:
 * - http_5xx: RETRY (server error, might recover)
 * - timeout: RETRY (network might recover)
 * - http_4xx: DON'T RETRY (client error, user's fault)
 * - Max 3 attempts total
 */
export function isRetryable(errorType: ErrorType, attemptNumber: number): boolean {
  // Max 3 attempts (1st, 2nd, 3rd)
  if (attemptNumber >= 3) {
    return false;
  }

  // Only retry 5xx and timeouts
  return errorType === 'http_5xx' || errorType === 'timeout';
}

/**
 * Calculate next retry time using exponential backoff
 * Attempt 1 (failed): retry in 1s
 * Attempt 2 (failed): retry in 2s
 * Attempt 3 (failed): no more retries
 *
 * Adds small jitter (±10%) to prevent thundering herd
 */
export function calculateNextRetryTime(attemptNumber: number): Date {
  if (attemptNumber >= 3) {
    return new Date(0); // Never
  }

  // Exponential: 1s, 2s, 4s
  const baseDelayMs = Math.pow(2, attemptNumber - 1) * 1000;

  // Add jitter: ±10%
  const jitterMs = baseDelayMs * 0.1 * (Math.random() * 2 - 1);
  const delayMs = baseDelayMs + jitterMs;

  return new Date(Date.now() + delayMs);
}

/**
 * Comprehensive error classification with retry metadata
 */
export function analyzeError(
  httpStatusCode: number | null | undefined,
  errorMessage: string,
  attemptNumber: number
): ClassifiedError {
  const errorType = classifyError(httpStatusCode, errorMessage);
  const retryable = isRetryable(errorType, attemptNumber);
  const nextRetryTime = retryable ? calculateNextRetryTime(attemptNumber) : new Date(0);

  return {
    errorType,
    isRetryable: retryable,
    nextRetryDelayMs: Math.max(0, nextRetryTime.getTime() - Date.now()),
    shouldMaxOutRetries: attemptNumber >= 3 && retryable,
  };
}

/**
 * Human-readable error description
 */
export function getErrorDescription(errorType: ErrorType): string {
  switch (errorType) {
    case 'http_5xx':
      return 'Server error (5xx) — Meta CAPI is having issues. Will retry.';
    case 'http_4xx':
      return 'Client error (4xx) — Invalid request. Will NOT retry.';
    case 'timeout':
      return 'Network timeout — Connection issue. Will retry.';
    case 'unknown':
      return 'Unknown error. Will attempt retry.';
    default:
      return 'Error';
  }
}
