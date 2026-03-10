// CRITICAL: This MUST be the first import
// It loads .env.local BEFORE any other imports execute
import './init-env.js';

import Fastify from 'fastify';
import cors from '@fastify/cors';
import sensible from '@fastify/sensible';
import jwt from '@fastify/jwt';
import rawBody from 'fastify-raw-body';
import {
  setupSessionCreateSchema,
  setupSessionStatusSchema,
  clickIngestSchema,
  perfectPayWebhookSchema,
  hotmartWebhookSchema,
  kiwifyWebhookSchema,
  stripeWebhookSchema,
} from '@hub/shared';
import { createSetupSession, getSetupSession, saveSetupSession } from './setup-store.js';
import { runValidations } from './validation.js';
import { handleClickIngest } from './click-handler.js';
import { handlePageviewIngest } from './pageview-handler.js';
import { handleCheckoutIngest } from './checkout-handler.js';
import { handlePerfectPayWebhook } from './perfectpay-webhook-handler.js';
import { handleHotmartWebhook } from './hotmart-webhook-handler.js';
import { handleKiwifyWebhook } from './kiwify-webhook-handler.js';
import { handleStripeWebhook } from './stripe-webhook-handler.js';
import { registerWebhookRoutes } from './webhooks/webhook-router.js';
import { register as registerAnalyticsV2Routes } from './routes/analytics-v2.js';
import { register as registerDispatchRoutes } from './routes/dispatch.js';
import { startAnalyticsRefreshJob } from './jobs/refresh-analytics-views.js'; // Story 011g-b (analytics optimization)
import { handleAdminOnboardCustomer } from './admin-onboard-handler.js';
import { prisma } from './db.js';

type PerfectPayWebhookParams = {
  sessionId: string;
  token: string;
};

async function bootstrap() {
  const app = Fastify({ logger: true });

  // Register raw body plugin BEFORE other plugins (global: true ensures rawBody is available on all routes for HMAC validation)
  await app.register(rawBody, { global: true, runFirst: true });

  await app.register(cors, { origin: true });
  await app.register(sensible);
  await app.register(jwt, {
    secret: process.env.JWT_SECRET || 'dev-secret-change-in-production',
  });

  // Decorate app with authenticate hook for protected routes
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (app as any).authenticate = async function(request: any, reply: any) {
    try {
      await request.jwtVerify();
    } catch {
      reply.code(401).send({ message: 'Unauthorized' });
    }
  };

  app.get('/api/v1/health', async (_request, reply) => {
    try {
      await prisma.$queryRaw`SELECT 1`;
      return reply.send({ status: 'ok', db: 'connected', project: 'Track AI' });
    } catch (err) {
      // Retorna 200 para não derrubar o serviço; db_error fica visível no monitoramento
      return reply.send({ status: 'degraded', db: 'unreachable', project: 'Track AI', db_error: String(err) });
    }
  });

  // Admin endpoint for customer onboarding (FASE 4: MVP Go-Live)
  app.post('/api/v1/admin/onboard-customer', async (request, reply) => {
    try {
      const result = await handleAdminOnboardCustomer(request.body);
      return reply.code(201).send(result);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      app.log.error(error, 'Admin onboard customer failed');
      return reply.code(400).send({ success: false, message });
    }
  });

  app.post('/api/v1/setup/sessions', async (request, reply) => {
    const parsed = setupSessionCreateSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send(parsed.error.flatten());
    }

    const session = await createSetupSession(parsed.data);
    return reply.code(201).send(session);
  });

  app.post('/api/v1/setup/sessions/:id/validate', async (request, reply) => {
    const params = request.params as { id: string };
    const session = await getSetupSession(params.id);

    if (!session) {
      return reply.code(404).send({ message: 'Setup session nao encontrada.' });
    }

    const validated = await runValidations(session);
    await saveSetupSession(validated);

    return reply.send(validated);
  });

  app.get('/api/v1/setup/sessions/:id/status', async (request, reply) => {
    const params = request.params as { id: string };
    const session = await getSetupSession(params.id);

    if (!session) {
      return reply.code(404).send({ message: 'Setup session nao encontrada.' });
    }

    const parsed = setupSessionStatusSchema.safeParse(session);
    if (!parsed.success) {
      return reply.code(500).send({ message: 'Estado de sessao invalido.' });
    }

    return reply.send(session);
  });

  app.post('/api/v1/track/click', async (request, reply) => {
    const tenantId = request.headers['x-tenant-id'];
    if (!tenantId || typeof tenantId !== 'string') {
      return reply.code(400).send({ message: 'Header x-tenant-id obrigatorio.' });
    }

    const parsed = clickIngestSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send(parsed.error.flatten());
    }

    const result = await handleClickIngest(tenantId, parsed.data, {
      ip: request.ip,
      headers: request.headers as Record<string, string | string[] | undefined>,
    });

    if ('error' in result && result.error === 'tenant_not_found') {
      return reply.code(404).send({ message: 'Tenant nao encontrado.' });
    }

    return reply.code(201).send(result);
  });

  app.post('/api/v1/track/pageview', async (request, reply) => {
    const tenantId = request.headers['x-tenant-id'];
    if (!tenantId || typeof tenantId !== 'string') {
      return reply.code(400).send({ message: 'Header x-tenant-id obrigatorio.' });
    }

    // Minimal validation for pageview
    const body = request.body as Record<string, unknown>;
    if (!body || typeof body.url !== 'string') {
      return reply.code(400).send({ message: 'url obrigatorio e deve ser string.' });
    }

    const result = await handlePageviewIngest(
      tenantId,
      {
        url: body.url,
        referrer: body.referrer as string | null | undefined,
        title: body.title as string | null | undefined,
        utmSource: body.utmSource as string | null | undefined,
        utmMedium: body.utmMedium as string | null | undefined,
        utmCampaign: body.utmCampaign as string | null | undefined,
        utmContent: body.utmContent as string | null | undefined,
        utmTerm: body.utmTerm as string | null | undefined,
        fbclid: body.fbclid as string | null | undefined,
        fbc: body.fbc as string | null | undefined,
        fbp: body.fbp as string | null | undefined,
      },
      request.ip,
      request.headers['user-agent'] as string | undefined
    );

    if ('error' in result && result.error === 'tenant_not_found') {
      return reply.code(404).send({ message: 'Tenant nao encontrado.' });
    }

    return reply.code(201).send(result);
  });

  app.post('/api/v1/track/initiate_checkout', async (request, reply) => {
    const tenantId = request.headers['x-tenant-id'];
    if (!tenantId || typeof tenantId !== 'string') {
      return reply.code(400).send({ message: 'Header x-tenant-id obrigatorio.' });
    }

    // Minimal validation for checkout
    const result = await handleCheckoutIngest(
      tenantId,
      request.body as Record<string, unknown>,
      request.ip,
      request.headers['user-agent'] as string | undefined
    );

    if ('error' in result && result.error === 'tenant_not_found') {
      return reply.code(404).send({ message: 'Tenant nao encontrado.' });
    }

    return reply.code(201).send(result);
  });

  // Webhook de conversão PerfectPay (tenant já provisionado)
  app.post('/api/v1/webhooks/perfectpay/:tenantId', async (request, reply) => {
    const { tenantId } = request.params as { tenantId: string };
    // Suporta ambos x-signature e x-perfectpay-signature
    const signature = (request.headers['x-signature'] || request.headers['x-perfectpay-signature']) as string | undefined;

    // Get raw body from plugin (preserves original formatting for HMAC validation)
    const rawBody = (request as { rawBody: string }).rawBody;

    const parsed = perfectPayWebhookSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send(parsed.error.flatten());
    }

    const result = await handlePerfectPayWebhook(tenantId, parsed.data, rawBody, signature);

    if ('error' in result) {
      if (result.error === 'invalid_signature') {
        return reply.code(401).send({ message: 'Assinatura invalida.' });
      }
      if (result.error === 'tenant_not_found') {
        return reply.code(404).send({ message: 'Tenant nao encontrado.' });
      }
    }

    return reply.code(202).send({ ok: true });
  });

  // Webhook de setup session PerfectPay (fluxo wizard)
  app.post('/api/v1/webhooks/perfectpay/:sessionId/:token', async (request, reply) => {
    const params = request.params as PerfectPayWebhookParams;
    const session = await getSetupSession(params.sessionId);

    if (!session) {
      return reply.code(404).send({ message: 'Sessao nao encontrada para webhook.' });
    }

    if (session.webhook?.token !== params.token) {
      return reply.code(401).send({ message: 'Token de webhook invalido.' });
    }

    app.log.info({
      sessionId: session.id,
      provider: 'perfectpay',
      payload: request.body
    }, 'Perfect Pay webhook recebido');

    return reply.code(202).send({ ok: true });
  });

  // Webhook de conversão Hotmart
  app.post('/api/v1/webhooks/hotmart/:tenantId', async (request, reply) => {
    const { tenantId } = request.params as { tenantId: string };
    const signature = request.headers['x-hotmart-signature'] as string | undefined;
    const rawBody = (request as { rawBody: string }).rawBody;

    const parsed = hotmartWebhookSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send(parsed.error.flatten());
    }

    const result = await handleHotmartWebhook(tenantId, parsed.data, rawBody, signature);

    if ('error' in result) {
      if (result.error === 'invalid_signature') {
        return reply.code(401).send({ message: 'Assinatura invalida.' });
      }
      if (result.error === 'tenant_not_found') {
        return reply.code(404).send({ message: 'Tenant nao encontrado.' });
      }
    }

    return reply.code(202).send({ ok: true });
  });

  // Webhook de conversão Kiwify
  app.post('/api/v1/webhooks/kiwify/:tenantId', async (request, reply) => {
    const { tenantId } = request.params as { tenantId: string };
    const signature = request.headers['x-kiwify-signature'] as string | undefined;
    const rawBody = (request as { rawBody: string }).rawBody;

    const parsed = kiwifyWebhookSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send(parsed.error.flatten());
    }

    const result = await handleKiwifyWebhook(tenantId, parsed.data, rawBody, signature);

    if ('error' in result) {
      if (result.error === 'invalid_signature') {
        return reply.code(401).send({ message: 'Assinatura invalida.' });
      }
      if (result.error === 'tenant_not_found') {
        return reply.code(404).send({ message: 'Tenant nao encontrado.' });
      }
    }

    return reply.code(202).send({ ok: true });
  });

  // Webhook de conversão Stripe
  app.post('/api/v1/webhooks/stripe/:tenantId', async (request, reply) => {
    const { tenantId } = request.params as { tenantId: string };
    const signatureHeader = request.headers['stripe-signature'] as string | undefined;
    const rawBody = (request as { rawBody: string }).rawBody;

    const parsed = stripeWebhookSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send(parsed.error.flatten());
    }

    const result = await handleStripeWebhook(tenantId, parsed.data, rawBody, signatureHeader);

    if ('error' in result) {
      if (result.error === 'invalid_signature') {
        return reply.code(401).send({ message: 'Assinatura invalida.' });
      }
      if (result.error === 'tenant_not_found') {
        return reply.code(404).send({ message: 'Tenant nao encontrado.' });
      }
    }

    return reply.code(202).send({ ok: true });
  });

  // Register generic webhook routes for multi-gateway support
  await registerWebhookRoutes(app);

  // Register analytics routes (Story 010: Dashboard Operacional)
  // await registerAnalyticsRoutes(app); // desativado: rotas duplicadas com analytics-v2
  await registerAnalyticsV2Routes(app);

  // Register dispatch routes (Story 009: Meta CAPI Dispatch)
  await registerDispatchRoutes(app);

  // Start analytics refresh job (Story 011g-b: 5 min interval)
  startAnalyticsRefreshJob();

  await app.listen({ port: 3001, host: '0.0.0.0' });
}

bootstrap().catch((err) => {
  console.error(err);
  process.exit(1);
});
