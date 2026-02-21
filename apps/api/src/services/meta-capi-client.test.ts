import { describe, it, expect, beforeEach } from 'vitest';
import { MetaCapiClient } from './meta-capi-client';

describe('MetaCapiClient', () => {
  let client: MetaCapiClient;

  beforeEach(() => {
    client = new MetaCapiClient('app-123', 'token-abc', 'pixel-456');
  });

  describe('buildPayload', () => {
    it('should build valid CAPI payload from conversion', () => {
      const conversion = {
        id: 'conv-001',
        gatewayEventId: 'hotmart-evt-123',
        amount: 99.99,
        currency: 'BRL',
        emailHash: 'a'.repeat(64),
        phoneHash: 'b'.repeat(64),
        firstNameHash: 'c'.repeat(64),
        lastNameHash: 'd'.repeat(64),
        cityHash: 'e'.repeat(64),
        stateHash: 'f'.repeat(64),
        countryCode: 'BR',
        zipCodeHash: 'g'.repeat(64),
        dateOfBirthHash: 'h'.repeat(64),
        externalIdHash: 'i'.repeat(64),
        facebookLoginId: 'j'.repeat(64),
        fbc: 'fb.1.123456789.AbCdEf',
        fbp: 'ga1.2.123456789.1612345678',
        createdAt: new Date('2026-02-21T10:00:00Z'),
      };

      const payload = client.buildPayload(conversion, 'token-xyz');

      expect(payload.data).toHaveLength(1);
      expect(payload.data[0].event_name).toBe('Purchase');
      expect(payload.data[0].event_id).toBe('hotmart-evt-123');
      expect(payload.data[0].user_data.em).toBe('a'.repeat(64));
      expect(payload.data[0].user_data.country).toBe('BR');
      expect(payload.data[0].custom_data.value).toBe(99.99);
      expect(payload.data[0].custom_data.currency).toBe('BRL');
      expect(payload.access_token).toBe('token-xyz');
    });

    it('should handle missing optional fields', () => {
      const conversion = {
        id: 'conv-002',
        gatewayEventId: 'stripe-evt-456',
        amount: undefined,
        currency: undefined,
        emailHash: undefined,
        phoneHash: undefined,
        firstNameHash: undefined,
        lastNameHash: undefined,
        cityHash: undefined,
        stateHash: undefined,
        countryCode: undefined,
        zipCodeHash: undefined,
        dateOfBirthHash: undefined,
        externalIdHash: undefined,
        facebookLoginId: undefined,
        fbc: undefined,
        fbp: undefined,
        createdAt: new Date(),
      };

      const payload = client.buildPayload(conversion, 'token-xyz');

      expect(payload.data[0].user_data.em).toBeUndefined();
      expect(payload.data[0].custom_data.value).toBeUndefined();
      expect(payload.data[0].user_data.hashed_maids).toBeUndefined();
    });

    it('should set hashed_maids when facebookLoginId present', () => {
      const conversion = {
        id: 'conv-003',
        gatewayEventId: 'evt-003',
        amount: 50,
        currency: 'USD',
        emailHash: undefined,
        phoneHash: undefined,
        firstNameHash: undefined,
        lastNameHash: undefined,
        cityHash: undefined,
        stateHash: undefined,
        countryCode: undefined,
        zipCodeHash: undefined,
        dateOfBirthHash: undefined,
        externalIdHash: undefined,
        facebookLoginId: 'login-hash-123',
        fbc: undefined,
        fbp: undefined,
        createdAt: new Date(),
      };

      const payload = client.buildPayload(conversion, 'token');

      expect(payload.data[0].user_data.hashed_maids).toEqual(['login-hash-123']);
    });
  });

  describe('validatePayload', () => {
    it('should validate correct payload', () => {
      const payload = {
        data: [
          {
            event_name: 'Purchase' as const,
            event_time: 1234567890,
            event_id: 'evt-123',
            event_source_id: 'pixel-456',
            action_source: 'website' as const,
            user_data: {
              em: 'email-hash',
            },
            custom_data: {},
          },
        ],
        access_token: 'token',
      };

      expect(client.validatePayload(payload)).toBe(true);
    });

    it('should reject payload with missing event_id', () => {
      const payload = {
        data: [
          {
            event_name: 'Purchase' as const,
            event_time: 1234567890,
            event_id: '', // Empty
            event_source_id: 'pixel-456',
            action_source: 'website' as const,
            user_data: {},
            custom_data: {},
          },
        ],
        access_token: 'token',
      };

      expect(client.validatePayload(payload)).toBe(false);
    });

    it('should reject payload with missing data array', () => {
      const payload = {
        data: [],
        access_token: 'token',
      };

      expect(client.validatePayload(payload)).toBe(false);
    });

    it('should reject payload with missing user_data', () => {
      const payload = {
        data: [
          {
            event_name: 'Purchase' as const,
            event_time: 1234567890,
            event_id: 'evt-123',
            event_source_id: 'pixel-456',
            action_source: 'website' as const,
            user_data: undefined as unknown as Record<string, unknown>,
            custom_data: {},
          },
        ],
        access_token: 'token',
      };

      expect(client.validatePayload(payload)).toBe(false);
    });
  });
});
