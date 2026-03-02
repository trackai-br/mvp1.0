import crypto from 'node:crypto';
import type {
  HotmartWebhookBody,
  KiwifyWebhookBody,
  StripeWebhookBody,
  PagSeguroWebhookBody,
} from '@hub/shared';

/**
 * Normalized conversion data from any gateway
 * Used by matching engine to find click matches
 */
export interface NormalizedConversion {
  gateway: 'hotmart' | 'kiwify' | 'stripe' | 'pagseguro';
  gatewayEventId: string;
  eventType: 'purchase_approved' | 'purchase_refunded' | 'purchase_pending';
  amount?: number;
  currency?: string;
  email?: string;
  phone?: string;
  fbp?: string;
  fbc?: string;
  rawPayload: Record<string, unknown>;
}

function sha256hex(value: string): string {
  return crypto.createHash('sha256').update(value, 'utf8').digest('hex');
}

export function normalizeHotmartConversion(
  payload: HotmartWebhookBody
): NormalizedConversion {
  const eventType = payload.status === 'approved' ? 'purchase_approved' : 'purchase_pending';
  const email = payload.buyer?.email?.toLowerCase().trim();
  const phone = payload.buyer?.phone?.replace(/\D/g, '');

  return {
    gateway: 'hotmart',
    gatewayEventId: payload.id,
    eventType,
    amount: payload.purchase?.price || payload.purchase?.full_price,
    currency: payload.purchase?.currency || 'BRL',
    email,
    phone,
    fbp: payload.fbp,
    fbc: payload.fbc,
    rawPayload: payload,
  };
}

export function normalizeKiwifyConversion(
  payload: KiwifyWebhookBody
): NormalizedConversion {
  // Kiwify event format: 'sale.confirmed', 'sale.completed', 'refund.requested'
  const eventType =
    payload.event === 'sale.completed' ? 'purchase_approved' : 'purchase_pending';
  const email = payload.data?.customer?.email?.toLowerCase().trim();
  const phone = payload.data?.customer?.phone?.replace(/\D/g, '');

  return {
    gateway: 'kiwify',
    gatewayEventId: payload.id,
    eventType,
    amount: payload.data?.amount,
    currency: payload.data?.currency || 'BRL',
    email,
    phone,
    fbp: payload.data?.fbp,
    fbc: payload.data?.fbc,
    rawPayload: payload,
  };
}

export function normalizeStripeConversion(
  payload: StripeWebhookBody
): NormalizedConversion {
  // Stripe can send various event types; we care about successful payments
  const eventType = payload.type?.includes('succeeded')
    ? 'purchase_approved'
    : 'purchase_pending';

  const chargeData = payload.data?.object?.charges?.data?.[0];
  const email = chargeData?.billing_details?.email?.toLowerCase().trim();
  const phone = chargeData?.billing_details?.phone?.replace(/\D/g, '');

  // Amount is in cents in Stripe
  const amountCents = payload.data?.object?.amount || chargeData?.amount;
  const amount = amountCents ? amountCents / 100 : undefined;

  // Currency from metadata or payload
  const currency =
    (typeof payload.data?.object?.metadata?.currency === 'string'
      ? payload.data.object.metadata.currency
      : payload.data?.object?.currency) || 'usd';

  // FBP/FBC from metadata
  const fbp =
    typeof payload.data?.object?.metadata?.fbp === 'string'
      ? payload.data.object.metadata.fbp
      : undefined;
  const fbc =
    typeof payload.data?.object?.metadata?.fbc === 'string'
      ? payload.data.object.metadata.fbc
      : undefined;

  return {
    gateway: 'stripe',
    gatewayEventId: payload.id,
    eventType,
    amount,
    currency,
    email,
    phone,
    fbp,
    fbc,
    rawPayload: payload,
  };
}

export function normalizePagSeguroConversion(
  payload: PagSeguroWebhookBody
): NormalizedConversion {
  // PagSeguro status codes: 1=aguardando, 2=em análise, 3=paga, 4=disponível, 5=em disputa, 6=devolvida, 7=cancelada
  const status = payload.status || '';
  const eventType = ['3', '4'].includes(status) ? 'purchase_approved' : 'purchase_pending';

  const email = payload.sender?.email?.toLowerCase().trim();
  const phone = payload.sender?.phone
    ? `${payload.sender.phone.areaCode || ''}${payload.sender.phone.number || ''}`.replace(
        /\D/g,
        ''
      )
    : undefined;

  // Amount: use grossAmount (with fees) or netAmount (without fees)
  const amount = payload.grossAmount ? parseFloat(payload.grossAmount) : undefined;

  return {
    gateway: 'pagseguro',
    gatewayEventId: payload.id,
    eventType,
    amount,
    currency: payload.currency || 'BRL',
    email,
    phone,
    fbp: payload.fbp,
    fbc: payload.fbc,
    rawPayload: payload,
  };
}

/**
 * Create PII hashes for identity matching (Story 007)
 */
export function createIdentityHashes(conversion: NormalizedConversion) {
  const emailHash = conversion.email
    ? sha256hex(conversion.email.toLowerCase().trim())
    : undefined;
  const phoneHash = conversion.phone ? sha256hex(conversion.phone.replace(/\D/g, '')) : undefined;

  return { emailHash, phoneHash };
}
