import { SQSClient, SendMessageCommand } from '@aws-sdk/client-sqs';
import { prisma } from '../db.js';

/**
 * Service to enqueue conversions to AWS SQS for Meta CAPI dispatch.
 *
 * This service is called after the Match Engine successfully matches
 * a conversion to a click (or determines it's unmatched).
 *
 * The enqueued message is then processed by CapiDispatchWorker which:
 * 1. Builds CAPI payload with hashed PII
 * 2. Sends to Meta Conversions API (v21)
 * 3. Handles retries with exponential backoff
 * 4. Moves failed messages to DLQ
 */

export interface EnqueueOptions {
  conversionId: string;
  tenantId: string;
  queueUrl?: string;
  region?: string;
}

export interface EnqueueResult {
  messageId: string;
  enqueueTime: Date;
  status: 'enqueued' | 'failed';
  error?: string;
}

/**
 * Enqueue conversion for CAPI dispatch
 */
export async function enqueueConversionForCapi(
  options: EnqueueOptions
): Promise<EnqueueResult> {
  const {
    conversionId,
    tenantId,
    queueUrl = process.env.SQS_QUEUE_URL,
    region = process.env.AWS_REGION || 'us-east-1',
  } = options;

  if (!queueUrl) {
    throw new Error('SQS_QUEUE_URL not configured');
  }

  try {
    // 1. Fetch conversion with all hashed PII fields
    const conversion = await prisma.conversion.findUnique({
      where: { id: conversionId },
    });

    if (!conversion) {
      throw new Error(`Conversion not found: ${conversionId}`);
    }

    // 2. Build SQS message payload
    const messageBody = {
      tenantId,
      conversionId: conversion.id,
      conversion: {
        id: conversion.id,
        gatewayEventId: conversion.gatewayEventId,
        amount: conversion.amount,
        currency: conversion.currency,
        // Hashed PII (15 Meta CAPI parameters)
        emailHash: conversion.emailHash,
        phoneHash: conversion.phoneHash,
        firstNameHash: conversion.firstNameHash,
        lastNameHash: conversion.lastNameHash,
        cityHash: conversion.cityHash,
        stateHash: conversion.stateHash,
        countryCode: conversion.countryCode,
        zipCodeHash: conversion.zipCodeHash,
        dateOfBirthHash: conversion.dateOfBirthHash,
        externalIdHash: conversion.externalIdHash,
        facebookLoginId: conversion.facebookLoginId,
        // Facebook IDs (NOT hashed)
        fbc: conversion.fbc,
        fbp: conversion.fbp,
        // Timestamp for CAPI event_time
        createdAt: conversion.createdAt.toISOString(),
      },
    } as const;

    // 3. Send to SQS
    const sqs = new SQSClient({ region });
    const command = new SendMessageCommand({
      QueueUrl: queueUrl,
      MessageBody: JSON.stringify(messageBody),
      // Use conversion ID as dedup key for FIFO queue compatibility
      MessageDeduplicationId: conversion.gatewayEventId,
      // Use tenant as group ID for FIFO
      MessageGroupId: tenantId,
    });

    const response = await sqs.send(command);

    // 4. Update conversion to mark as enqueued
    await prisma.conversion.update({
      where: { id: conversionId },
      data: {
        sentToCAPI: false, // Will be true when worker succeeds
        // Store request payload as JSON for audit trail
        capiRequestPayload: JSON.parse(JSON.stringify(messageBody)),
      },
    });

    // 5. Return success
    return {
      messageId: response.MessageId || 'unknown',
      enqueueTime: new Date(),
      status: 'enqueued',
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    // Log error but don't throw — enqueue failures are non-blocking
    console.error(
      `Failed to enqueue conversion ${conversionId} to CAPI queue:`,
      errorMessage
    );

    return {
      messageId: 'none',
      enqueueTime: new Date(),
      status: 'failed',
      error: errorMessage,
    };
  }
}

/**
 * Batch enqueue multiple conversions
 */
export async function enqueueConversionsBatch(
  conversions: EnqueueOptions[]
): Promise<EnqueueResult[]> {
  return Promise.all(
    conversions.map((opts) => enqueueConversionForCapi(opts))
  );
}

/**
 * Get enqueue statistics for monitoring
 */
export async function getEnqueueStats(tenantId: string) {
  const total = await prisma.conversion.count({
    where: { tenantId },
  });

  // Count conversions successfully sent to CAPI
  const sentToCAPI = await prisma.conversion.count({
    where: {
      tenantId,
      sentToCAPI: true,
    },
  });

  // Conversions enqueued but not yet sent
  const pending = total - sentToCAPI;

  return {
    total,
    sentToCAPI,
    pending,
    successRate:
      total > 0 ? ((sentToCAPI / total) * 100).toFixed(2) + '%' : 'N/A',
  };
}
