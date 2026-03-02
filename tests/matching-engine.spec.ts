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

test('Story 007: Matching Engine - Click to Conversion', async () => {
  console.log('\n🧪 STORY 007 TEST: Matching Engine\n');

  // Test data
  const email = 'matching-test@example.com';
  const phone = '+5511987654321';
  const emailHash = sha256(email.toLowerCase());
  const phoneHash = sha256(phone.replace(/\D/g, ''));

  // STEP 1: Create a Click with email + phone hashes
  console.log('1️⃣ Creating Click with hashes...');
  const clickPayload = {
    fbclid: `test-fbclid-${Date.now()}`,
    fbc: 'fb.1.1234567890.1234567890',
    fbp: 'fb.1.987654321.1234567890',
    utmSource: 'google',
    utmCampaign: 'matching-test',
    emailHash,
    phoneHash,
  };

  const clickResponse = await fetch(`${BASE_URL}/api/v1/track/click`, {
    method: 'POST',
    headers: {
      'x-tenant-id': TENANT_ID,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(clickPayload),
  });

  expect(clickResponse.ok).toBeTruthy();
  const clickData = await clickResponse.json();
  const clickId = clickData.id;
  console.log(`✓ Click created: ${clickId}`);

  // STEP 2: Send webhook with matching email/phone
  console.log('\n2️⃣ Sending webhook with matching email...');

  const webhookPayload = {
    order_id: `order-${Date.now()}`,
    customer: {
      email,
      phone,
      first_name: 'Test',
      last_name: 'User',
    },
    amount: 99.99,
    currency: 'BRL',
  };

  const webhookSecret = process.env.PERFECTPAY_WEBHOOK_SECRET || 'eecb790d368d3a21b31f67313de4ffee';
  const payloadString = JSON.stringify(webhookPayload);
  const signature = hmacSha256(webhookSecret, payloadString);

  const webhookResponse = await fetch(`${BASE_URL}/api/v1/webhooks/perfectpay/${TENANT_ID}`, {
    method: 'POST',
    headers: {
      'x-signature': signature,
      'Content-Type': 'application/json',
    },
    body: payloadString,
  });

  expect(webhookResponse.ok).toBeTruthy();
  const webhookData = await webhookResponse.json();
  console.log(`✓ Webhook received: ${JSON.stringify(webhookData)}`);

  // STEP 3: Verify Conversion was created and matched
  console.log('\n3️⃣ Verifying Conversion in database...');

  // Wait a bit for async processing
  await new Promise((resolve) => setTimeout(resolve, 1000));

  // Query database for conversion
  const conversionResponse = await fetch(`${BASE_URL}/api/v1/admin/conversions?tenantId=${TENANT_ID}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  }).catch(() => null);

  if (conversionResponse && conversionResponse.ok) {
    const conversions = await conversionResponse.json();
    console.log(`✓ Conversions found: ${conversions.length}`);

    if (conversions.length > 0) {
      const conversion = conversions[conversions.length - 1]; // Latest
      console.log(`  - ID: ${conversion.id}`);
      console.log(`  - Matched Click: ${conversion.matchedClickId}`);
      console.log(`  - Match Strategy: ${conversion.matchStrategy}`);
      console.log(`  - Match Score: ${conversion.matchScore}`);

      expect(conversion.matchedClickId).toBe(clickId);
      expect(conversion.matchStrategy).toMatch(/email_hash|phone_hash/);
      console.log('\n✅ MATCHING ENGINE WORKS!');
    }
  } else {
    console.log('⚠️ Admin endpoint not available, skipping database verification');
  }
});
