#!/usr/bin/env node
/**
 * Script de teste end-to-end
 * Fluxo: Setup → Validar → Webhook → Verificar dados
 */

const crypto = require('crypto');

const API_URL = 'http://localhost:3001';

async function log(step, message) {
  console.log(`\n📌 ${step} — ${message}`);
}

async function request(method, path, body = null, headers = {}) {
  const url = `${API_URL}${path}`;
  const options = {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
  };

  if (body) options.body = JSON.stringify(body);

  try {
    const res = await fetch(url, options);
    const text = await res.text();
    const data = text ? JSON.parse(text) : {};
    return { status: res.status, data };
  } catch (err) {
    console.error(`❌ Erro na requisição ${method} ${path}:`, err.message);
    throw err;
  }
}

async function main() {
  try {
    // ============================================
    // STEP 1: Create Setup Session
    // ============================================
    await log('1️⃣ STEP 1', 'Criar SetupSession');

    const sessionRes = await request('POST', '/api/v1/setup/sessions', {
      projectName: 'Test Project',
      trackingEnvironment: 'lp',
      landingUrl: 'https://example.com',
      meta: {
        pixelId: '123456789',
        accessToken: 'test-token-xxx',
        adAccountId: 'act_123456',
      },
      gateway: {
        platform: 'perfectpay',
        apiKey: 'test-api-key',
        webhookSecret: 'test-secret-perfectpay-123456',
      },
    });

    if (sessionRes.status !== 201) {
      throw new Error(`Setup session failed: ${sessionRes.status} ${JSON.stringify(sessionRes.data)}`);
    }

    const sessionId = sessionRes.data.id;
    console.log(`✅ SetupSession criada: ${sessionId}`);
    console.log(`   Webhook URL será: /api/v1/webhooks/perfectpay/${sessionId}/:token`);

    // ============================================
    // STEP 2: Validate Setup Session (cria Tenant)
    // ============================================
    await log('2️⃣ STEP 2', 'Validar SetupSession (cria Tenant no banco)');

    const validateRes = await request('POST', `/api/v1/setup/sessions/${sessionId}/validate`);

    if (validateRes.status !== 200) {
      throw new Error(`Validation failed: ${validateRes.status}`);
    }

    const tenantId = validateRes.data.tenantId;
    console.log(`✅ SetupSession validada`);
    console.log(`   Tenant criado: ${tenantId}`);

    // ============================================
    // STEP 3: Send PerfectPay Webhook (conversão)
    // ============================================
    await log('3️⃣ STEP 3', 'Enviar webhook de conversão PerfectPay');

    const payload = {
      order_id: 'TESTE-001',
      amount: 199.90,
      currency: 'BRL',
      customer: {
        email: 'cliente@teste.com.br',
        phone: '+5511987654321',
      },
    };

    const secret = 'test-secret-perfectpay-123456';
    const payloadStr = JSON.stringify(payload);
    const signature = crypto.createHmac('sha256', secret).update(payloadStr).digest('hex');

    console.log(`   Assinatura HMAC: ${signature.substring(0, 20)}...`);

    const webhookRes = await request(
      'POST',
      `/api/v1/webhooks/perfectpay/${tenantId}`,
      payload,
      { 'X-Signature': signature }
    );

    if (webhookRes.status !== 202) {
      throw new Error(`Webhook failed: ${webhookRes.status} ${JSON.stringify(webhookRes.data)}`);
    }

    console.log(`✅ Webhook recebido e processado`);

    // ============================================
    // STEP 4: Verify Data in Database
    // ============================================
    await log('4️⃣ STEP 4', 'Verificar dados no banco (usando Prisma)');

    const { PrismaClient } = require('@prisma/client');
    const prisma = new PrismaClient();

    // Buscar Tenant
    const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) {
      throw new Error('Tenant não encontrado no banco');
    }
    console.log(`✅ Tenant encontrado: ${tenant.name} (status: ${tenant.status})`);

    // Buscar Identities (email/phone hasheado)
    const identities = await prisma.identity.findMany({
      where: { tenantId },
    });
    console.log(`✅ Identities (PII hasheado): ${identities.length} registros`);
    if (identities.length > 0) {
      console.log(`   Email hash: ${identities[0].emailHash?.substring(0, 20)}...`);
      console.log(`   Phone hash: ${identities[0].phoneHash?.substring(0, 20)}...`);
    }

    // Buscar DedupeRegistry
    const dedupe = await prisma.dedupeRegistry.findMany({
      where: { tenantId },
    });
    console.log(`✅ DedupeRegistry: ${dedupe.length} eventos únicos`);

    await prisma.$disconnect();

    // ============================================
    // SUCCESS!
    // ============================================
    console.log('\n' + '='.repeat(60));
    console.log('🎉 TESTE COMPLETO COM SUCESSO! 🎉');
    console.log('='.repeat(60));
    console.log(`
📊 Resumo:
  ✓ SetupSession criada: ${sessionId}
  ✓ Tenant criado: ${tenantId}
  ✓ Webhook processado com sucesso
  ✓ Dados salvos no banco (${identities.length} identities, ${dedupe.length} eventos)

🔗 Próximos passos:
  1. Acesse http://localhost:3000/dashboard
  2. Deverá ver os dados do evento
  3. Teste com mais conversões para ver match rate aumentar
    `);
  } catch (err) {
    console.error('\n❌ ERRO:', err.message);
    console.error(err.stack);
    process.exit(1);
  }
}

main();
