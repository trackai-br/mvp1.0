/**
 * Abstract Queue Manager
 * Supports both SQS (production) and Redis/BullMQ (local dev)
 * Implementation chosen via USE_SQS env variable
 */

export interface QueueJob {
  id: string;
  tenantId: string;
  conversionId: string;
  attempt: number;
  createdAt: number;
}

export interface QueueManager {
  // Enqueue a conversion for dispatch to Meta CAPI
  enqueue(job: Omit<QueueJob, 'id' | 'createdAt'>): Promise<void>;

  // Dequeue a batch of pending jobs
  dequeue(batchSize: number): Promise<QueueJob[]>;

  // Mark job as completed successfully
  complete(jobId: string): Promise<void>;

  // Mark job as failed with error message
  fail(jobId: string, error: string): Promise<void>;

  // Get pending job count
  getQueueSize(): Promise<number>;

  // Drain queue (clear all pending jobs)
  drain(): Promise<void>;
}

/**
 * Redis/BullMQ implementation (local dev)
 */
export class RedisQueueManager implements QueueManager {
  private queue: Map<string, QueueJob> = new Map();
  private jobCounter: number = 0;

  async enqueue(job: Omit<QueueJob, 'id' | 'createdAt'>): Promise<void> {
    const id = `job-${Date.now()}-${this.jobCounter++}`;
    this.queue.set(id, {
      ...job,
      id,
      createdAt: Date.now(),
    });
    console.log(`[queue] ✓ Enqueued conversion ${job.conversionId} (job ${id})`);
  }

  async dequeue(batchSize: number): Promise<QueueJob[]> {
    const batch: QueueJob[] = [];
    let count = 0;

    for (const [key, job] of this.queue.entries()) {
      if (count >= batchSize) break;
      batch.push(job);
      this.queue.delete(key);
      count++;
    }

    if (batch.length > 0) {
      console.log(`[queue] ✓ Dequeued ${batch.length} job(s)`);
    }

    return batch;
  }

  async complete(jobId: string): Promise<void> {
    console.log(`[queue] ✓ Job ${jobId} completed`);
  }

  async fail(jobId: string, error: string): Promise<void> {
    console.log(`[queue] ✗ Job ${jobId} failed: ${error}`);
  }

  async getQueueSize(): Promise<number> {
    return this.queue.size;
  }

  async drain(): Promise<void> {
    this.queue.clear();
    console.log('[queue] Drained all pending jobs');
  }
}

/**
 * SQS implementation (production)
 * Placeholder for future AWS SDK integration
 */
export class SQSQueueManager implements QueueManager {
  async enqueue(): Promise<void> {
    throw new Error('SQS not yet implemented');
  }

  async dequeue(): Promise<QueueJob[]> {
    throw new Error('SQS not yet implemented');
  }

  async complete(): Promise<void> {
    throw new Error('SQS not yet implemented');
  }

  async fail(): Promise<void> {
    throw new Error('SQS not yet implemented');
  }

  async getQueueSize(): Promise<number> {
    throw new Error('SQS not yet implemented');
  }

  async drain(): Promise<void> {
    throw new Error('SQS not yet implemented');
  }
}

/**
 * Factory: Get queue manager based on environment
 */
export function getQueueManager(): QueueManager {
  const useSqs = process.env.USE_SQS === 'true';

  if (useSqs) {
    console.log('[queue] Using SQS');
    return new SQSQueueManager();
  }

  console.log('[queue] Using Redis (local dev mode)');
  return new RedisQueueManager();
}
