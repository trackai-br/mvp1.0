import Fastify from 'fastify';
import cors from '@fastify/cors';
import sensible from '@fastify/sensible';
import {
  setupSessionCreateSchema,
  setupSessionStatusSchema,
  clickIngestSchema,
  perfectPayWebhookSchema,
} from '@hub/shared';
import { createSetupSession, getSetupSession, saveSetupSession } from './setup-store';
import { runValidations } from './validation';
import { handleClickIngest } from './click-handler';
import { handlePageviewIngest } from './pageview-handler';
import { handleCheckoutIngest } from './checkout-handler';
import { handlePerfectPayWebhook } from './perfectpay-webhook-handler';
import { registerWebhookRoutes } from './webhooks/webhook-router';
import { prisma } from './db';

type PerfectPayWebhookParams = {
  sessionId: string;
  token: string;
};

async function bootstrap() {
  const app = Fastify({ logger: true });

  await app.register(cors, { origin: true });
  await app.register(sensible);

  app.get('/health', async (_request, reply) => {
    try {
      await prisma.$queryRaw`SELECT 1`;
      return reply.send({ status: 'ok', db: 'connected', project: 'Track AI' });
    } catch (err) {
      // Retorna 200 para não derrubar o serviço; db_error fica visível no monitoramento
      return reply.send({ status: 'degraded', db: 'unreachable', project: 'Track AI', db_error: String(err) });
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (!request.body || typeof (request.body as any).url !== 'string') {
      return reply.code(400).send({ message: 'url obrigatorio e deve ser string.' });
    }

    const result = await handlePageviewIngest(
      tenantId,
      request.body,
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
      request.body,
      request.ip,
      request.headers['user-agent'] as string | undefined
    );

    if ('error' in result && result.error === 'tenant_not_found') {
      return reply.code(404).send({ message: 'Tenant nao encontrado.' });
    }

    return reply.code(201).send(result);
  });

  // Webhook de conversão PerfectPay (tenant já provisionado)
  app.post('/api/v1/webhooks/perfectpay/:tenantId', {
    config: { rawBody: true },
  }, async (request, reply) => {
    const { tenantId } = request.params as { tenantId: string };
    const signature = request.headers['x-perfectpay-signature'] as string | undefined;

    // raw body: usa JSON.stringify como aproximação MVP (limitação: key ordering)
    const rawBody = JSON.stringify(request.body);

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

    if (session.webhook.token !== params.token) {
      return reply.code(401).send({ message: 'Token de webhook invalido.' });
    }

    app.log.info({
      sessionId: session.id,
      provider: 'perfectpay',
      payload: request.body
    }, 'Perfect Pay webhook recebido');

    return reply.code(202).send({ ok: true });
  });

  // Register generic webhook routes for multi-gateway support
  await registerWebhookRoutes(app);

  await app.listen({ port: 3001, host: '0.0.0.0' });
}

bootstrap().catch((err) => {
  console.error(err);
  process.exit(1);
});
