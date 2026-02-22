import axios, { AxiosInstance } from 'axios';
import { prisma } from '../db.js';

/**
 * Meta Conversions API (CAPI) v21 client
 *
 * Handles:
 * - Event sending with all 15 parameters (hashed PII)
 * - Retry logic (exponential backoff, 5 max attempts)
 * - Idempotency via dedup_batch_id
 * - Error handling and logging
 */

export interface CapiEventPayload {
  data: {
    event_name: 'Purchase';
    event_time: number; // Unix timestamp
    event_id: string; // gateway eventId for dedup
    event_source_id: string; // pixel ID or business account ID
    action_source: 'website' | 'mobile_app' | 'offline' | 'phone_call';
    user_data: {
      em?: string; // email hash
      ph?: string; // phone hash
      fn?: string; // first name hash
      ln?: string; // last name hash
      ct?: string; // city hash
      st?: string; // state hash
      zp?: string; // zip hash
      country?: string; // NOT hashed (ISO code)
      db?: string; // date of birth hash
      external_id?: string; // external ID hash
      fbc?: string; // Facebook Click ID
      fbp?: string; // Facebook Pixel ID
      hashed_maids?: string[]; // Facebook login ID hashed
    };
    custom_data: {
      value?: number;
      currency?: string;
    };
  }[];
  access_token: string;
}

export interface CapiResponse {
  events_received: number;
  filler_events: number;
}

export class MetaCapiClient {
  private client: AxiosInstance;
  private baseUrl: string;
  private maxRetries = 5;
  private retryDelays = [1000, 2000, 4000, 8000, 16000]; // ms, exponential backoff

  constructor(
    private appId: string,
    private accessToken: string,
    private pixelId: string
  ) {
    this.baseUrl = `https://graph.facebook.com/v21.0/${pixelId}/events`;

    this.client = axios.create({
      baseURL: this.baseUrl,
      timeout: 3000, // 3s timeout per request
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  /**
   * Send event to Meta CAPI with retry logic
   */
  async sendEvent(
    tenantId: string,
    conversionId: string,
    payload: CapiEventPayload,
    currentAttempt = 1
  ): Promise<CapiResponse> {
    try {
      const response = await this.client.post<CapiResponse>('', payload);

      // Log successful dispatch
      await prisma.dispatchAttempt.create({
        data: {
          tenantId,
          eventId: payload.data[0].event_id,
          attempt: currentAttempt,
          status: 'success',
        },
      });

      return response.data;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);

      // Log failed attempt
      await prisma.dispatchAttempt.create({
        data: {
          tenantId,
          eventId: payload.data[0].event_id,
          attempt: currentAttempt,
          status: 'failed',
          error: errorMessage,
        },
      });

      // Check if should retry
      if (currentAttempt < this.maxRetries) {
        const delay = this.retryDelays[currentAttempt - 1];
        await this.sleep(delay);
        return this.sendEvent(tenantId, conversionId, payload, currentAttempt + 1);
      }

      // Max retries exceeded
      throw new Error(
        `Meta CAPI dispatch failed after ${this.maxRetries} attempts: ${errorMessage}`
      );
    }
  }

  /**
   * Build CAPI payload from Conversion record
   */
  buildPayload(
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
      createdAt: Date;
    },
    accessToken: string
  ): CapiEventPayload {
    return {
      data: [
        {
          event_name: 'Purchase',
          event_time: Math.floor(conversion.createdAt.getTime() / 1000),
          event_id: conversion.gatewayEventId, // For dedup
          event_source_id: this.pixelId,
          action_source: 'website',
          user_data: {
            em: conversion.emailHash,
            ph: conversion.phoneHash,
            fn: conversion.firstNameHash,
            ln: conversion.lastNameHash,
            ct: conversion.cityHash,
            st: conversion.stateHash,
            zp: conversion.zipCodeHash,
            country: conversion.countryCode,
            db: conversion.dateOfBirthHash,
            external_id: conversion.externalIdHash,
            fbc: conversion.fbc,
            fbp: conversion.fbp,
            hashed_maids: conversion.facebookLoginId ? [conversion.facebookLoginId] : undefined,
          },
          custom_data: {
            value: conversion.amount,
            currency: conversion.currency,
          },
        },
      ],
      access_token: accessToken,
    };
  }

  /**
   * Validate payload before sending (basic checks)
   */
  validatePayload(payload: CapiEventPayload): boolean {
    if (!payload.data || payload.data.length === 0) {
      return false;
    }

    const event = payload.data[0];
    if (!event.event_id || !event.user_data) {
      return false;
    }

    return true;
  }

  /**
   * Sleep utility for retries
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

/**
 * Factory function to create client with token from secrets
 */
export async function createCapiClient(pixelId: string): Promise<MetaCapiClient> {
  // TODO: Fetch from AWS Secrets Manager in production
  const appId = process.env.META_CAPI_APP_ID || '';
  const accessToken = process.env.META_CAPI_TOKEN || '';

  if (!appId || !accessToken) {
    throw new Error('META_CAPI_APP_ID or META_CAPI_TOKEN not configured');
  }

  return new MetaCapiClient(appId, accessToken, pixelId);
}
