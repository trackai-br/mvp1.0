import type { Conversion } from '@prisma/client';
import { prisma } from '../db.js';
import { MetaCAPIClient } from '../meta-capi/client.js';
import { formatConversionToCAPI, validateConversionForCAP } from '../meta-capi/formatter.js';

/**
 * Dispatch Service
 * Sends conversions to Meta CAPI and tracks attempts
 */

export async function dispatchConversionToMeta(
  conversion: Conversion
): Promise<{ success: boolean; message: string; retries: number }> {
  // 1. Validate conversion has required data
  const validationError = validateConversionForCAP(conversion);
  if (validationError) {
    console.log(`[dispatch] ⚠️ Validation failed for ${conversion.id}: ${validationError}`);
    return { success: false, message: validationError, retries: 0 };
  }

  // 2. Fetch tenant and Meta credentials
  const tenant = await prisma.tenant.findUnique({
    where: { id: conversion.tenantId },
  });

  if (!tenant) {
    console.log(`[dispatch] ✗ Tenant ${conversion.tenantId} not found`);
    return { success: false, message: 'Tenant not found', retries: 0 };
  }

  // 3. Get Meta pixel ID and access token
  // TODO: Fetch from tenant config (for now, use env)
  const pixelId = process.env.META_PIXEL_ID;
  const accessToken = process.env.META_ACCESS_TOKEN;

  if (!pixelId || !accessToken) {
    console.log(
      `[dispatch] ✗ Meta credentials not configured (pixel=${pixelId ? 'set' : 'missing'}, token=${accessToken ? 'set' : 'missing'})`
    );
    return {
      success: false,
      message: 'Meta credentials not configured',
      retries: 0,
    };
  }

  // 4. Format conversion to Meta payload
  const payload = formatConversionToCAPI(conversion, accessToken);

  // 5. Send to Meta CAPI
  const client = new MetaCAPIClient();
  const result = await client.sendConversions(pixelId, payload);

  // 6. Log attempt
  await logDispatchAttempt(
    conversion.tenantId,
    conversion.gatewayEventId,
    result.success ? 'success' : 'failed',
    result.error || undefined
  );

  // 7. Update conversion record if successful
  if (result.success) {
    await prisma.conversion.update({
      where: { id: conversion.id },
      data: {
        sentToCAPI: true,
        capiResponse: result.data ? JSON.stringify(result.data) : undefined,
        capiRequestPayload: JSON.stringify(payload),
      },
    });

    console.log(
      `[dispatch] ✓ Conversion ${conversion.id} sent to Meta CAPI (retries: ${result.retries})`
    );

    return {
      success: true,
      message: 'Sent to Meta CAPI',
      retries: result.retries,
    };
  }

  console.log(
    `[dispatch] ✗ Failed to send ${conversion.id} to Meta CAPI: ${result.error} (retries: ${result.retries})`
  );

  return {
    success: false,
    message: result.error || 'Unknown error',
    retries: result.retries,
  };
}

/**
 * Log a dispatch attempt for audit trail
 */
async function logDispatchAttempt(
  tenantId: string,
  eventId: string,
  status: 'success' | 'failed',
  error?: string
): Promise<void> {
  // Get current attempt number for this event
  const existingAttempts = await prisma.dispatchAttempt.findMany({
    where: { tenantId, eventId },
    orderBy: { createdAt: 'desc' },
    take: 1,
  });

  const attemptNumber = (existingAttempts[0]?.attempt ?? 0) + 1;

  await prisma.dispatchAttempt.create({
    data: {
      tenantId,
      eventId,
      attempt: attemptNumber,
      status: status === 'success' ? 'success' : 'failed',
      error,
    },
  });

  console.log(
    `[dispatch] Logged attempt #${attemptNumber} for ${eventId}: ${status}${error ? ` (${error})` : ''}`
  );
}

/**
 * Retry failed conversions (for Story 011 replay engine)
 */
export async function retryStalledConversions(maxAttempts: number = 5): Promise<number> {
  // Find conversions that failed (not sent to CAPI)
  const stalledConversions = await prisma.conversion.findMany({
    where: {
      sentToCAPI: false,
      createdAt: {
        // Only retry conversions created less than 24 hours ago
        gte: new Date(Date.now() - 24 * 60 * 60 * 1000),
      },
    },
    include: {
      tenant: true,
    },
    take: 100, // Process max 100 at a time
  });

  let successCount = 0;

  for (const conversion of stalledConversions) {
    // Check if we've exceeded max attempts
    const attempts = await prisma.dispatchAttempt.count({
      where: {
        tenantId: conversion.tenantId,
        eventId: conversion.gatewayEventId,
      },
    });

    if (attempts >= maxAttempts) {
      console.log(
        `[dispatch] ⏭️ Skipping ${conversion.id} — reached max attempts (${attempts}/${maxAttempts})`
      );
      continue;
    }

    const result = await dispatchConversionToMeta(conversion);
    if (result.success) {
      successCount++;
    }
  }

  console.log(`[dispatch] Retry complete: ${successCount}/${stalledConversions.length} succeeded`);
  return successCount;
}
