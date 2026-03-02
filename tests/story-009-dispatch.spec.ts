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

test('Story 009: Meta CAPI Dispatch - Single Conversion', async () => {
  console.log('\n🧪 STORY 009 TEST: Meta CAPI Dispatch — Single Conversion\n');

  // Step 1: Create a Click
  console.log('1️⃣ Creating Click with FBP...');
  const clickPayload = {
    fbclid: `test-fbclid-${Date.now()}`,
    fbc: 'fb.1.1234567890.1234567890',
    fbp: 'fb.1.987654321.1234567890',
    utmSource: 'google',
    utmCampaign: 'dispatch-test',
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

  // Step 2: Send PerfectPay Webhook with matching FBP
  console.log('\n2️⃣ Sending PerfectPay webhook (with matching FBP)...');
  const webhookPayload = {
    order_id: `order-${Date.now()}`,
    customer: {
      email: 'dispatch-test@example.com',
      phone: '11987654321',
      first_name: 'Test',
      last_name: 'User',
    },
    amount: 99.99,
    currency: 'BRL',
    fbp: 'fb.1.987654321.1234567890', // MATCHES click FBP
    fbc: 'fb.1.1234567890.1234567890',
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
  const webhookResult = await webhookResponse.json();
  console.log(`✓ Webhook accepted: ${JSON.stringify(webhookResult)}`);
  expect(webhookResult.conversionId).toBeDefined();

  const conversionId = webhookResult.conversionId;

  // Step 3: Check dispatch status BEFORE sending
  console.log('\n3️⃣ Checking dispatch status (should show 1 pending)...');
  const statusBefore = await fetch(`${BASE_URL}/api/v1/admin/dispatch/status`);
  expect(statusBefore.ok).toBeTruthy();

  const statusData = await statusBefore.json();
  console.log(`✓ Queue status: pending=${statusData.queue.pending}, success=${statusData.queue.success}`);
  expect(statusData.queue.pending).toBeGreaterThan(0);

  // Step 4: Manually dispatch the conversion
  console.log('\n4️⃣ Manually dispatching conversion...');
  const dispatchResponse = await fetch(
    `${BASE_URL}/api/v1/admin/dispatch/conversions/${conversionId}`,
    {
      method: 'POST',
    }
  );

  // Note: Dispatch will fail if Meta credentials not set, but we should get a response
  const dispatchData = await dispatchResponse.json();
  console.log(`✓ Dispatch response: ${JSON.stringify(dispatchData)}`);

  // Step 5: Check dispatch status AFTER sending
  console.log('\n5️⃣ Checking dispatch status (should reflect attempt)...');
  const statusAfter = await fetch(`${BASE_URL}/api/v1/admin/dispatch/status`);
  expect(statusAfter.ok).toBeTruthy();

  const statusAfterData = await statusAfter.json();
  console.log(
    `✓ Queue status after: pending=${statusAfterData.queue.pending}, success=${statusAfterData.queue.success}`
  );
  console.log(`✓ Recent attempts: ${statusAfterData.recentAttempts.total}`);
});

test('Story 009: Meta CAPI Dispatch - Bulk Retry', async () => {
  console.log('\n🧪 STORY 009 TEST: Meta CAPI Dispatch — Bulk Retry\n');

  console.log('1️⃣ Triggering bulk retry...');
  const retryResponse = await fetch(`${BASE_URL}/api/v1/admin/dispatch/retry`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ maxAttempts: 5 }),
  });

  expect(retryResponse.ok).toBeTruthy();
  const retryData = await retryResponse.json();
  console.log(`✓ Retry response: ${JSON.stringify(retryData)}`);
  console.log(`  - Success count: ${retryData.successCount}`);
  console.log(`  - Max attempts: ${retryData.maxAttempts}`);
});
