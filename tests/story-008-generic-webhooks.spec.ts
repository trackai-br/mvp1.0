import { test, expect } from '@playwright/test';
import crypto from 'crypto';

const BASE_URL = 'http://localhost:3001';
const TENANT_ID = '3fa85f64-5717-4562-b3fc-2c963f66afa6';

function sha256(text: string): string {
  return crypto.createHash('sha256').update(text).digest('hex');
}

function hmacSha256(secret: string, message: string): string {
  return crypto.createHmac('sha256', secret).update(message).digest('hex');
}

test('Story 008: Generic Webhook Receiver - Hotmart', async () => {
  console.log('\n🧪 STORY 008 TEST: Generic Webhook Receiver — Hotmart\n');

  const hotmartPayload = {
    id: `hotmart-event-${Date.now()}`,
    status: 'approved',
    purchase: {
      id: `purchase-${Date.now()}`,
      full_price: 199.99,
      price: 199.99,
      currency: 'BRL',
      approved_date: new Date().toISOString(),
    },
    buyer: {
      email: 'hotmart-customer@example.com',
      phone: '11987654321',
      name: 'João Silva',
      birth_date: '1990-01-15',
      address: {
        city: 'São Paulo',
        state: 'SP',
        country: 'BR',
        zip_code: '01310100',
      },
    },
    fbp: 'fb.1.987654321.1234567890',
    fbc: 'fb.1.1234567890.1234567890',
  };

  const payloadString = JSON.stringify(hotmartPayload);
  const secret = process.env.HOTMART_WEBHOOK_SECRET || 'dev-secret-change-in-production';
  const signature = hmacSha256(secret, payloadString);

  console.log('1️⃣ Sending Hotmart webhook...');
  const response = await fetch(`${BASE_URL}/api/v1/webhooks/hotmart/${TENANT_ID}`, {
    method: 'POST',
    headers: {
      'x-hotmart-signature': signature,
      'Content-Type': 'application/json',
    },
    body: payloadString,
  });

  expect(response.ok).toBeTruthy();
  console.log(`✓ Hotmart webhook accepted (${response.status})`);

  const result = await response.json();
  console.log(`✓ Response: ${JSON.stringify(result)}`);
  expect(result.ok).toBe(true);
  expect(result.conversionId).toBeDefined();
});

test('Story 008: Generic Webhook Receiver - Kiwify', async () => {
  console.log('\n🧪 STORY 008 TEST: Generic Webhook Receiver — Kiwify\n');

  const kiwifyPayload = {
    event: 'sale.completed',
    id: `kiwify-event-${Date.now()}`,
    timestamp: new Date().toISOString(),
    data: {
      id: `sale-${Date.now()}`,
      status: 'completed',
      amount: 299.99,
      currency: 'BRL',
      customer: {
        email: 'kiwify-customer@example.com',
        phone: '21987654321',
        name: 'Maria Santos',
        birth_date: '1985-05-20',
        address: {
          city: 'Rio de Janeiro',
          state: 'RJ',
          country: 'BR',
          zip_code: '20020000',
        },
      },
      fbp: 'fb.1.111111111.2222222222',
      fbc: 'fb.1.3333333333.4444444444',
    },
  };

  const payloadString = JSON.stringify(kiwifyPayload);
  const secret = process.env.KIWIFY_WEBHOOK_SECRET || 'dev-secret-change-in-production';
  const signature = hmacSha256(secret, payloadString);

  console.log('1️⃣ Sending Kiwify webhook...');
  const response = await fetch(`${BASE_URL}/api/v1/webhooks/kiwify/${TENANT_ID}`, {
    method: 'POST',
    headers: {
      'x-kiwify-signature': signature,
      'Content-Type': 'application/json',
    },
    body: payloadString,
  });

  expect(response.ok).toBeTruthy();
  console.log(`✓ Kiwify webhook accepted (${response.status})`);

  const result = await response.json();
  console.log(`✓ Response: ${JSON.stringify(result)}`);
  expect(result.ok).toBe(true);
});

test('Story 008: Generic Webhook Receiver - Stripe', async () => {
  console.log('\n🧪 STORY 008 TEST: Generic Webhook Receiver — Stripe\n');

  const timestamp = Math.floor(Date.now() / 1000).toString();
  const stripePayload = {
    id: `evt_${Date.now()}`,
    type: 'charge.succeeded',
    created: parseInt(timestamp),
    livemode: false,
    data: {
      object: {
        id: `ch_${Date.now()}`,
        object: 'charge',
        amount: 39999, // cents
        currency: 'brl',
        status: 'succeeded',
        customer: 'cus_123456',
        metadata: {
          fbp: 'fb.1.555555555.6666666666',
          fbc: 'fb.1.7777777777.8888888888',
          currency: 'BRL',
        },
        charges: {
          data: [
            {
              id: `ch_${Date.now()}`,
              amount: 39999,
              billing_details: {
                email: 'stripe-customer@example.com',
                phone: '+5585987654321',
                name: 'Carlos Oliveira',
                address: {
                  city: 'Fortaleza',
                  state: 'CE',
                  country: 'BR',
                  postal_code: '60010000',
                },
              },
            },
          ],
        },
      },
    },
  };

  const payloadString = JSON.stringify(stripePayload);
  const secret = process.env.STRIPE_WEBHOOK_SECRET || 'dev-secret-change-in-production';

  // Stripe signature: t=timestamp,v1=signature
  const signedContent = `${timestamp}.${payloadString}`;
  const signatureHash = crypto.createHmac('sha256', secret).update(signedContent).digest('hex');
  const stripeSignature = `t=${timestamp},v1=${signatureHash}`;

  console.log('1️⃣ Sending Stripe webhook...');
  const response = await fetch(`${BASE_URL}/api/v1/webhooks/stripe/${TENANT_ID}`, {
    method: 'POST',
    headers: {
      'stripe-signature': stripeSignature,
      'Content-Type': 'application/json',
    },
    body: payloadString,
  });

  expect(response.ok).toBeTruthy();
  console.log(`✓ Stripe webhook accepted (${response.status})`);

  const result = await response.json();
  console.log(`✓ Response: ${JSON.stringify(result)}`);
  expect(result.ok).toBe(true);
});
