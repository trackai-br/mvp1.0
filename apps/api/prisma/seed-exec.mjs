#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load .env.local
const envPath = path.resolve(__dirname, '../../../infra/secrets/.env.local');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  envContent.split('\n').forEach(line => {
    if (line && !line.startsWith('#')) {
      const [key, val] = line.split('=');
      if (key) process.env[key.trim()] = val?.trim();
    }
  });
  console.log('✅ Env loaded from .env.local');
}

const { PrismaClient } = await import('@prisma/client');
const prisma = new PrismaClient();

console.log('🌱 Starting seed...');

try {
  // 1. Create tenant
  const tenant = await prisma.tenant.upsert({
    where: { slug: 'test-tenant' },
    update: {},
    create: {
      slug: 'test-tenant',
      name: 'Test Tenant Company',
      status: 'active',
    },
  });
  console.log(`✅ Tenant: ${tenant.id}`);

  // 2. Create click
  const click = await prisma.click.create({
    data: {
      tenantId: tenant.id,
      fbclid: 'test_fbclid_001',
      fbc: 'fb.1.123456789.987654321',
      fbp: 'fb.1.111111111.222222222',
      utmSource: 'google',
      utmMedium: 'cpc',
    },
  });
  console.log(`✅ Click: ${click.id}`);

  console.log('\n✨ Seed completed!');
} catch (err) {
  console.error('❌ Seed error:', err.message);
  process.exit(1);
} finally {
  await prisma.$disconnect();
}
