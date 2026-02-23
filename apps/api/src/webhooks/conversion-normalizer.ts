import { createHash } from 'crypto';
import { NormalizedWebhookEvent } from './webhook-router.js';

/**
 * Normalize and hash PII data for Meta CAPI conformance.
 * Per Meta spec:
 * - Hash PII fields using SHA-256
 * - Normalize formats (lowercase, remove spaces, etc.)
 * - Fields like fbc/fbp are NOT hashed
 * - countryCode is ISO 2-letter code, NOT hashed
 */
export interface NormalizedConversion {
  // Webhook reference
  gateway: string;
  gatewayEventId: string;

  // Purchase data
  amount?: number;
  currency: string;

  // --- 15 Meta CAPI Parameters (hashed where required) ---
  // Facebook IDs (NOT hashed)
  fbc?: string;
  fbp?: string;

  // Contact info (HASHED SHA-256)
  emailHash?: string;
  phoneHash?: string;

  // Personal info (HASHED SHA-256)
  firstNameHash?: string;
  lastNameHash?: string;
  dateOfBirthHash?: string; // SHA-256(YYYYMMDD)

  // Address (HASHED SHA-256)
  cityHash?: string;
  stateHash?: string;
  countryCode?: string; // ISO 2-letter code (NOT hashed)
  zipCodeHash?: string;

  // External IDs (HASHED)
  externalIdHash?: string;
  facebookLoginIdHash?: string;
}

/**
 * Hash a value using SHA-256.
 * Meta recommends: SHA-256(normalized value)
 * @param value Raw value to hash
 * @returns SHA-256 hex hash, or undefined if value is falsy
 */
function hashValue(value: string | undefined): string | undefined {
  if (!value || value.trim() === '') {
    return undefined;
  }

  // Normalize: lowercase, trim spaces
  const normalized = value.toLowerCase().trim();

  return createHash('sha256').update(normalized).digest('hex');
}

/**
 * Normalize date to YYYYMMDD format for hashing.
 * Accepts multiple date formats: YYYY-MM-DD, YYYY/MM/DD, YYYYMMDD, etc.
 * @param date Date string in any format
 * @returns YYYYMMDD string, or undefined if invalid
 */
function normalizeDateOfBirth(date: string | undefined): string | undefined {
  if (!date || date.trim() === '') {
    return undefined;
  }

  // Remove all non-digit characters
  const digitsOnly = date.replace(/\D/g, '');

  // Must be at least YYYYMMDD (8 digits)
  if (digitsOnly.length < 8) {
    return undefined;
  }

  // Extract first 8 digits (YYYYMMDD)
  return digitsOnly.substring(0, 8);
}

/**
 * Normalize country code to ISO 2-letter format.
 * Accepts: country names, full codes, 2-letter codes.
 * @param country Country value
 * @returns ISO 2-letter code (uppercase), or undefined if invalid
 */
function normalizeCountryCode(country: string | undefined): string | undefined {
  if (!country || country.trim() === '') {
    return undefined;
  }

  const upper = country.toUpperCase().trim();

  // If it's already 2 letters, return as-is
  if (upper.length === 2 && /^[A-Z]{2}$/.test(upper)) {
    return upper;
  }

  // Common country name mappings (expand as needed)
  const countryMap: Record<string, string> = {
    BRASIL: 'BR',
    BRAZIL: 'BR',
    BRA: 'BR',
    BR: 'BR',
    UNITED_STATES: 'US',
    USA: 'US',
    US: 'US',
    UNITED_KINGDOM: 'GB',
    UK: 'GB',
    GB: 'GB',
  };

  const normalized = upper.replace(/\s+|-|_/g, '_');
  return countryMap[normalized] || undefined;
}

/**
 * Convert NormalizedWebhookEvent to NormalizedConversion with hashing.
 * @param event Parsed webhook event from adapter
 * @returns Conversion data ready to persist
 */
export function normalizeConversion(
  event: NormalizedWebhookEvent
): NormalizedConversion {
  // Normalize date of birth to YYYYMMDD before hashing
  const dob = normalizeDateOfBirth(event.customerDateOfBirth);

  const conversion: NormalizedConversion = {
    // Webhook reference
    gateway: event.gateway,
    gatewayEventId: event.eventId,

    // Purchase data
    amount: event.amount,
    currency: event.currency || 'BRL',

    // --- 15 Meta CAPI Parameters ---
    // Facebook IDs (NOT hashed)
    fbc: event.fbc,
    fbp: event.fbp,

    // Contact info (HASHED SHA-256)
    emailHash: hashValue(event.customerEmail),
    phoneHash: hashValue(event.customerPhone),

    // Personal info (HASHED SHA-256)
    firstNameHash: hashValue(event.customerFirstName),
    lastNameHash: hashValue(event.customerLastName),
    dateOfBirthHash: dob ? hashValue(dob) : undefined,

    // Address (HASHED SHA-256 or normalized)
    cityHash: hashValue(event.customerCity),
    stateHash: hashValue(event.customerState),
    countryCode: normalizeCountryCode(event.customerCountry),
    zipCodeHash: hashValue(event.customerZipCode),

    // External IDs (HASHED)
    externalIdHash: hashValue(event.customerExternalId),
    facebookLoginIdHash: hashValue(event.customerFacebookLoginId),
  };

  return conversion;
}
