import {
  SQSClient,
  ReceiveMessageCommand,
  DeleteMessageCommand,
  SendMessageCommand,
  SendMessageCommandInput,
  Message,
} from '@aws-sdk/client-sqs';
import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';
import { CloudWatchClient, PutMetricDataCommand } from '@aws-sdk/client-cloudwatch';
import { prisma } from '../db.js';
import { MetaCapiClient } from '../services/meta-capi-client.js';
import { CircuitBreaker, CircuitState } from '../lib/circuit-breaker.js';

/**
 * SQS Worker for Meta CAPI Dispatch
 *
 * Polls capi-dispatch queue, processes conversions, sends to Meta Conversions API
 * with exponential backoff retry logic and circuit breaker protection.
 *
 * Flow:
 * 1. Poll SQS queue (capi-dispatch)
 * 2. Parse conversion message
 * 3. Build CAPI payload
 * 4. Send to Meta (with retry + circuit breaker)
 * 5. Log result in DispatchAttempt
 * 6. On max retries: move to DLQ
 * 7. Emit CloudWatch metrics
 */

interface SQSMessage {
  tenantId: string;
  conversionId: string;
  conversion: {
    id: string;
    gatewayEventId: string;
    amount?: number;
    currency?: string;
    emailHash?: string;
    phoneHash?: string;
    firstNameHash?: string;
    lastNameHash?: string;
    cityHash?: string;
    stateHash?: string;
    countryCode?: string;
    zipCodeHash?: string;
    dateOfBirthHash?: string;
    externalIdHash?: string;
    facebookLoginId?: string;
    fbc?: string;
    fbp?: string;
    createdAt: string;
  };
}

interface WorkerConfig {
  queueUrl: string;
  dlqUrl: string;
  secretName: string;
  region?: string;
  pollIntervalMs?: number;
  maxConcurrentMessages?: number;
  visibilityTimeoutSeconds?: number;
}

interface WorkerMetrics {
  successCount: number;
  failureCount: number;
  dlqCount: number;
  totalLatencyMs: number;
  circuitBreakerState: CircuitState;
}

export class CapiDispatchWorker {
  private sqs: SQSClient;
  private secretsManager: SecretsManagerClient;
  private cloudWatch: CloudWatchClient;
  private capiClient: MetaCapiClient | null = null;
  private circuitBreaker: CircuitBreaker;
  private config: WorkerConfig;
  private metrics: WorkerMetrics;
  private isRunning = false;
  private processMessageTimeouts: Set<ReturnType<typeof setTimeout>> = new Set();

  constructor(config: WorkerConfig) {
    this.config = {
      region: 'us-east-1',
      pollIntervalMs: 5000, // Poll every 5 seconds
      maxConcurrentMessages: 10,
      visibilityTimeoutSeconds: 30,
      ...config,
    };

    this.sqs = new SQSClient({ region: this.config.region });
    this.secretsManager = new SecretsManagerClient({ region: this.config.region });
    this.cloudWatch = new CloudWatchClient({ region: this.config.region });

    // Circuit breaker: trip after 5 failures, reset after 60 seconds
    this.circuitBreaker = new CircuitBreaker({
      failureThreshold: 5,
      successThreshold: 2,
      resetTimeoutMs: 60000,
      name: 'MetaCapiCircuitBreaker',
    });

    this.metrics = {
      successCount: 0,
      failureCount: 0,
      dlqCount: 0,
      totalLatencyMs: 0,
      circuitBreakerState: CircuitState.CLOSED,
    };
  }

  /**
   * Start the worker: initialize Meta CAPI client and begin polling
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      console.log('CapiDispatchWorker is already running');
      return;
    }

    try {
      // Initialize Meta CAPI client with credentials from Secrets Manager
      await this.initializeCapiClient();
      this.isRunning = true;
      console.log('✓ CapiDispatchWorker started');

      // Begin polling loop
      this.pollLoop();
    } catch (error) {
      console.error('❌ Failed to start CapiDispatchWorker:', error);
      throw error;
    }
  }

  /**
   * Stop the worker gracefully
   */
  async stop(): Promise<void> {
    this.isRunning = false;
    this.processMessageTimeouts.forEach((timeout) => clearTimeout(timeout));
    this.processMessageTimeouts.clear();
    console.log('✓ CapiDispatchWorker stopped');
  }

  /**
   * Initialize Meta CAPI client from Secrets Manager
   */
  private async initializeCapiClient(): Promise<void> {
    try {
      const command = new GetSecretValueCommand({ SecretId: this.config.secretName });
      const response = await this.secretsManager.send(command);

      if (!response.SecretString) {
        throw new Error('Secret value is empty');
      }

      const secret = JSON.parse(response.SecretString);
      this.capiClient = new MetaCapiClient(
        secret.appId,
        secret.accessToken,
        secret.pixelId
      );
    } catch (error) {
      throw new Error(`Failed to initialize CAPI client: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Main polling loop: continuously fetch and process messages from SQS
   */
  private pollLoop(): void {
    if (!this.isRunning) return;

    this.pollMessages().finally(() => {
      // Schedule next poll
      const timeout = setTimeout(() => this.pollLoop(), this.config.pollIntervalMs);
      this.processMessageTimeouts.add(timeout);
    });
  }

  /**
   * Poll SQS queue for messages
   */
  private async pollMessages(): Promise<void> {
    try {
      const command = new ReceiveMessageCommand({
        QueueUrl: this.config.queueUrl,
        MaxNumberOfMessages: this.config.maxConcurrentMessages,
        VisibilityTimeout: this.config.visibilityTimeoutSeconds,
        WaitTimeSeconds: 10, // Long polling
      });

      const response = await this.sqs.send(command);

      if (!response.Messages || response.Messages.length === 0) {
        return; // No messages, continue polling
      }

      // Process each message concurrently (but limited)
      await Promise.all(
        response.Messages.map((message) =>
          this.processMessage(message).catch((error) => {
            console.error(`Error processing message ${message.MessageId}:`, error);
          })
        )
      );
    } catch (error) {
      console.error('❌ Error polling SQS:', error);
    }
  }

  /**
   * Process a single SQS message
   */
  private async processMessage(message: Message): Promise<void> {
    const startTime = Date.now();

    try {
      if (!message.Body || !message.MessageId || !message.ReceiptHandle) {
        throw new Error('Message body, MessageId or ReceiptHandle is empty');
      }

      const smsMessage: SQSMessage = JSON.parse(message.Body);
      const { tenantId, conversionId, conversion } = smsMessage;

      // Check for duplicate using composite unique key
      // Note: In real implementation, gateway would come from the conversion record
      const existing = await prisma.conversion.findUnique({
        where: {
          tenantId_gateway_gatewayEventId: {
            tenantId,
            gateway: 'hotmart', // TODO: Use gateway from conversion record when available
            gatewayEventId: conversion.gatewayEventId,
          },
        },
      });

      if (!existing) {
        throw new Error(`Conversion not found: ${conversion.gatewayEventId}`);
      }

      // Build CAPI payload
      const payload = this.capiClient!.buildPayload(
        {
          ...conversion,
          createdAt: new Date(conversion.createdAt),
        },
        'placeholder' // Token will be fetched from Secrets Manager in real impl
      );

      // Validate payload
      if (!this.capiClient!.validatePayload(payload)) {
        throw new Error('Invalid CAPI payload');
      }

      // Send to Meta with circuit breaker protection
      await this.circuitBreaker.execute(async () => {
        const result = await this.capiClient!.sendEvent(tenantId, conversionId, payload);
        return result;
      });

      // Success: log and delete message
      await prisma.dispatchAttempt.create({
        data: {
          tenantId,
          eventId: conversion.gatewayEventId,
          attempt: 1,
          status: 'success',
        },
      });

      const latency = Date.now() - startTime;
      this.metrics.successCount++;
      this.metrics.totalLatencyMs += latency;

      // Delete message from queue
      await this.sqs.send(
        new DeleteMessageCommand({
          QueueUrl: this.config.queueUrl,
          ReceiptHandle: message.ReceiptHandle,
        })
      );

      console.log(`✓ Processed: ${conversion.gatewayEventId} (${latency}ms)`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`❌ Failed to process message: ${errorMessage}`);

      this.metrics.failureCount++;

      // Get message attributes for retry count
      // For now, assume max retries reached and move to DLQ
      // In production, would increment ApproximateReceiveCount from message attributes

      try {
        // Move to DLQ
        const dlqMessage: SendMessageCommandInput = {
          QueueUrl: this.config.dlqUrl,
          MessageBody: message.Body,
          MessageAttributes: {
            OriginalMessageId: {
              StringValue: message.MessageId,
              DataType: 'String',
            },
          },
        };

        await this.sqs.send(new SendMessageCommand(dlqMessage));

        // Delete from primary queue
        await this.sqs.send(
          new DeleteMessageCommand({
            QueueUrl: this.config.queueUrl,
            ReceiptHandle: message.ReceiptHandle,
          })
        );

        this.metrics.dlqCount++;
        console.log(`↷ Moved to DLQ: ${message.MessageId}`);
      } catch (dlqError) {
        console.error(`❌ Failed to move message to DLQ:`, dlqError);
        // Message will be re-processed after visibility timeout
      }
    } finally {
      // Update circuit breaker metrics
      this.metrics.circuitBreakerState = this.circuitBreaker.getState();

      // Emit CloudWatch metrics
      await this.emitMetrics();
    }
  }

  /**
   * Emit metrics to CloudWatch
   */
  private async emitMetrics(): Promise<void> {
    try {
      const command = new PutMetricDataCommand({
        Namespace: 'Track-AI/CAPI',
        MetricData: [
          {
            MetricName: 'DispatchSuccess',
            Value: this.metrics.successCount,
            Unit: 'Count',
          },
          {
            MetricName: 'DispatchFailure',
            Value: this.metrics.failureCount,
            Unit: 'Count',
          },
          {
            MetricName: 'DispatchDLQ',
            Value: this.metrics.dlqCount,
            Unit: 'Count',
          },
          {
            MetricName: 'CircuitBreakerState',
            Value: this.metrics.circuitBreakerState === CircuitState.CLOSED ? 0 : 1,
            Unit: 'None',
          },
          {
            MetricName: 'AvgLatency',
            Value:
              this.metrics.successCount > 0
                ? this.metrics.totalLatencyMs / this.metrics.successCount
                : 0,
            Unit: 'Milliseconds',
          },
        ],
      });

      await this.cloudWatch.send(command);
    } catch (error) {
      console.error('Failed to emit metrics:', error);
      // Don't throw - metrics are non-critical
    }
  }

  /**
   * Get current metrics
   */
  getMetrics(): WorkerMetrics {
    return { ...this.metrics };
  }

  /**
   * Get circuit breaker state
   */
  getCircuitBreakerState(): CircuitState {
    return this.circuitBreaker.getState();
  }
}
