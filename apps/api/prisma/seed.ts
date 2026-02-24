import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // 1. Create test tenant
  const tenant = await prisma.tenant.upsert({
    where: { slug: 'test-tenant' },
    update: {},
    create: {
      slug: 'test-tenant',
      name: 'Test Tenant Company',
      status: 'active',
    },
  });

  console.log(`✅ Tenant created: ${tenant.id} (${tenant.slug})`);

  // 2. Create sample clicks for testing
  const click1 = await prisma.click.create({
    data: {
      tenantId: tenant.id,
      fbclid: 'abc123xyz789',
      fbc: 'fb.1.1234567890.0987654321',
      fbp: 'fb.1.1111111111.2222222222',
      utmSource: 'google',
      utmMedium: 'cpc',
      utmCampaign: 'test-campaign',
      ip: '192.168.1.1',
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    },
  });

  const click2 = await prisma.click.create({
    data: {
      tenantId: tenant.id,
      fbclid: 'def456uvw012',
      fbc: 'fb.1.9876543210.1234567890',
      fbp: 'fb.1.3333333333.4444444444',
      utmSource: 'facebook',
      utmMedium: 'cpc',
      utmCampaign: 'retargeting',
      ip: '10.0.0.1',
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X)',
    },
  });

  console.log(`✅ Clicks created: ${click1.id}, ${click2.id}`);

  // 3. Create webhook raw event (PerfectPay example)
  const webhookRaw = await prisma.webhookRaw.create({
    data: {
      tenantId: tenant.id as any,
      gateway: 'perfectpay',
      gatewayEventId: 'evt_perfectpay_12345',
      eventType: 'purchase_approved',
      rawPayload: {
        id: 'evt_perfectpay_12345',
        customer: {
          email: 'customer@example.com',
          first_name: 'João',
          last_name: 'Silva',
          date_of_birth: '1990-05-15',
          phone: '11999999999',
          address: {
            street: 'Rua Teste',
            number: '123',
            city: 'São Paulo',
            state: 'SP',
            country: 'BR',
            zipcode: '01310-100',
          },
        },
        purchase: {
          amount: 299.90,
          currency: 'BRL',
        },
        fbc: 'fb.1.1234567890.0987654321',
        fbp: 'fb.1.1111111111.2222222222',
      },
    },
  });

  console.log(`✅ WebhookRaw created: ${webhookRaw.id}`);

  // 4. Create conversion (simulating what webhook-router does)
  const conversion = await prisma.conversion.create({
    data: {
      tenantId: tenant.id as any,
      webhookRawId: webhookRaw.id,
      gateway: 'perfectpay',
      gatewayEventId: 'evt_perfectpay_12345',
      amount: 299.90,
      currency: 'BRL',
      fbc: 'fb.1.1234567890.0987654321',
      fbp: 'fb.1.1111111111.2222222222',
      // Hashed PII (SHA-256)
      emailHash: 'sha256_of_customer@example.com',
      phoneHash: 'sha256_of_11999999999',
      firstNameHash: 'sha256_of_joao',
      lastNameHash: 'sha256_of_silva',
      dateOfBirthHash: 'sha256_of_19900515',
      cityHash: 'sha256_of_sao_paulo',
      stateHash: 'sha256_of_sp',
      countryCode: 'BR',
      zipCodeHash: 'sha256_of_01310-100',
      externalIdHash: 'sha256_of_customer_id',
      matchedClickId: click1.id as any,
      matchStrategy: 'fbc',
      sentToCAPI: false,
    },
  });

  console.log(`✅ Conversion created: ${conversion.id}`);

  // 5. Create match log
  const matchLog = await prisma.matchLog.create({
    data: {
      conversionId: conversion.id,
      fbcAttempted: true,
      fbcResult: 'found',
      fbcClickId: click1.id as any,
      fbpAttempted: false,
      emailAttempted: false,
      finalStrategy: 'fbc',
      finalClickId: click1.id as any,
      timeWindowStart: new Date(Date.now() - 72 * 60 * 60 * 1000),
      timeWindowEnd: new Date(),
      processingTimeMs: 45,
    },
  });

  console.log(`✅ MatchLog created: ${matchLog.id}`);

  // 6. Create setup session
  const setupSession = await prisma.setupSession.create({
    data: {
      id: 'setup_' + tenant.id,
      tenantId: tenant.id,
      projectName: 'Test Project',
      state: 'completed',
      webhookToken: 'webhook_token_' + Math.random().toString(36).substring(7),
      checks: {
        database: { status: 'pass' },
        sqs: { status: 'pass' },
        meta_capi: { status: 'pass' },
      },
    },
  });

  console.log(`✅ SetupSession created: ${setupSession.id}`);

  console.log('✨ Seeding completed successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
