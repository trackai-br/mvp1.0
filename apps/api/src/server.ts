import Fastify from 'fastify';
import cors from '@fastify/cors';
import sensible from '@fastify/sensible';
import {
  setupSessionCreateSchema,
  setupSessionStatusSchema
} from '@hub/shared';
import { createSetupSession, getSetupSession, saveSetupSession } from './setup-store';
import { runValidations } from './validation';

type PerfectPayWebhookParams = {
  sessionId: string;
  token: string;
};

async function bootstrap() {
  const app = Fastify({ logger: true });

  await app.register(cors, { origin: true });
  await app.register(sensible);

  app.get('/health', async () => ({ ok: true, project: 'Track AI' }));

  app.post('/api/v1/setup/sessions', async (request, reply) => {
    const parsed = setupSessionCreateSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send(parsed.error.flatten());
    }

    const session = createSetupSession(parsed.data);
    return reply.code(201).send(session);
  });

  app.post('/api/v1/setup/sessions/:id/validate', async (request, reply) => {
    const params = request.params as { id: string };
    const session = getSetupSession(params.id);

    if (!session) {
      return reply.code(404).send({ message: 'Setup session nao encontrada.' });
    }

    const validated = await runValidations(session);
    saveSetupSession(validated);

    return reply.send(validated);
  });

  app.get('/api/v1/setup/sessions/:id/status', async (request, reply) => {
    const params = request.params as { id: string };
    const session = getSetupSession(params.id);

    if (!session) {
      return reply.code(404).send({ message: 'Setup session nao encontrada.' });
    }

    const parsed = setupSessionStatusSchema.safeParse(session);
    if (!parsed.success) {
      return reply.code(500).send({ message: 'Estado de sessao invalido.' });
    }

    return reply.send(session);
  });

  app.post('/api/v1/webhooks/perfectpay/:sessionId/:token', async (request, reply) => {
    const params = request.params as PerfectPayWebhookParams;
    const session = getSetupSession(params.sessionId);

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

  await app.listen({ port: 3001, host: '0.0.0.0' });
}

bootstrap().catch((err) => {
  console.error(err);
  process.exit(1);
});
