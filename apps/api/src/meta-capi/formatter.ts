import type { Conversion } from '@prisma/client';
import type { ConversionPayload } from './client.js';

/**
 * Format Conversion record into Meta Conversions API payload
 * Implements all 15+ Meta CAPI parameters (hashed PII)
 */
export function formatConversionToCAPI(
  conversion: Conversion,
  accessToken: string
): ConversionPayload {
  // Determine event name based on gateway
  const eventName = mapGatewayToEventName(conversion.gateway);

  // Event timestamp (Meta expects seconds since epoch)
  const eventTime = Math.floor(conversion.createdAt.getTime() / 1000);

  // Unique event ID (gateway + CAPI keeps track of this)
  const eventId = `${conversion.gateway}-${conversion.gatewayEventId}`;

  // Build user_data with hashed PII (only if available)
  const userData: Record<string, string> = {};

  // Contact info (already hashed)
  if (conversion.emailHash) {
    userData.em = conversion.emailHash;
  }
  if (conversion.phoneHash) {
    userData.ph = conversion.phoneHash;
  }

  // Personal info (already hashed)
  if (conversion.firstNameHash) {
    userData.fn = conversion.firstNameHash;
  }
  if (conversion.lastNameHash) {
    userData.ln = conversion.lastNameHash;
  }
  if (conversion.dateOfBirthHash) {
    userData.db = conversion.dateOfBirthHash;
  }

  // Address (already hashed, except country code)
  if (conversion.cityHash) {
    userData.ct = conversion.cityHash;
  }
  if (conversion.stateHash) {
    userData.st = conversion.stateHash;
  }
  if (conversion.countryCode) {
    userData.country = conversion.countryCode;
  }
  if (conversion.zipCodeHash) {
    userData.zp = conversion.zipCodeHash;
  }

  // External IDs (already hashed)
  if (conversion.externalIdHash) {
    userData.external_id = conversion.externalIdHash;
  }

  // Facebook Login ID (optional, for authenticated flows)
  // Note: Not included in CAPI spec as direct param, but could be in external_id

  // Build custom_data with purchase information
  const customData: Record<string, unknown> = {};

  if (conversion.currency) {
    customData.currency = conversion.currency;
  }
  if (conversion.amount) {
    customData.value = conversion.amount;
  }

  // Facebook IDs (FBP/FBC) are NOT hashed, but CAPI handles them separately
  // They're typically in pixel tracking, not in server-to-server API
  // For now, we keep them for audit but don't send to CAPI

  return {
    data: [
      {
        event_name: eventName,
        event_time: eventTime,
        action_source: 'website',
        event_id: eventId,
        user_data: Object.keys(userData).length > 0 ? userData : undefined,
        custom_data: Object.keys(customData).length > 0 ? (customData as any) : undefined, // eslint-disable-line @typescript-eslint/no-explicit-any
        opt_out: false,
      },
    ],
    access_token: accessToken,
  };
}

/**
 * Map gateway event type to Meta CAPI event name
 * Reference: https://developers.facebook.com/docs/marketing-api/conversions-api/event-types/
 */
function mapGatewayToEventName(gateway: string): string {
  switch (gateway.toLowerCase()) {
    case 'hotmart':
    case 'kiwify':
    case 'stripe':
    case 'pagseguro':
    case 'perfectpay':
      return 'Purchase'; // Standard purchase event
    default:
      return 'Purchase';
  }
}

/**
 * Validate that conversion has minimal required data for CAPI
 * Returns error message if invalid, null if valid
 */
export function validateConversionForCAP(conversion: Conversion): string | null {
  // At minimum, need amount
  if (!conversion.amount) {
    return 'Conversion missing amount';
  }

  // Need at least one PII field or a unique identifier
  const hasContactInfo = conversion.emailHash || conversion.phoneHash;
  const hasPersonalInfo =
    conversion.firstNameHash || conversion.lastNameHash || conversion.dateOfBirthHash;
  const hasAddress =
    conversion.cityHash || conversion.stateHash || conversion.zipCodeHash;
  const hasExternalId = conversion.externalIdHash;

  if (!hasContactInfo && !hasPersonalInfo && !hasAddress && !hasExternalId) {
    return 'Conversion must have at least one PII field (email, phone, name, address, or external ID)';
  }

  return null;
}
