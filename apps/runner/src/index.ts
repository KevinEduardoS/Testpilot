import { timingSafeEqual } from 'node:crypto';
import Fastify from 'fastify';
import { healthStatusSchema } from '@testpilot/shared';
import { env } from './config.js';

const app = Fastify({ logger: true });
const expectedKey = Buffer.from(env.INTERNAL_API_KEY);

const isValidInternalKey = (providedKey: string | string[] | undefined): boolean => {
  if (typeof providedKey !== 'string') {
    return false;
  }

  const provided = Buffer.from(providedKey);
  return provided.length === expectedKey.length && timingSafeEqual(provided, expectedKey);
};

app.addHook('onRequest', async (request, reply) => {
  if (request.routeOptions.url === '/health') {
    return;
  }

  if (!isValidInternalKey(request.headers['x-internal-api-key'])) {
    return reply.code(401).send({
      error: 'Unauthorized',
      message: 'Missing or invalid INTERNAL_API_KEY',
    });
  }
});

app.get('/health', async () => {
  const payload = {
    status: 'ok',
    service: 'runner',
    timestamp: new Date().toISOString(),
  };

  return healthStatusSchema.parse(payload);
});

app.post('/snapshot', async (_request, reply) => {
  const body = {
    status: 'ok',
    service: 'runner',
    ariaSnapshot: 'url=https://example.com\n[page]\n  [link "Example Domain"]\n',
    timestamp: new Date().toISOString(),
  };

  reply.code(200);
  return body;
});

app.post('/execute', async (_request, reply) => {
  const body = {
    ok: true,
    durationMs: 1250,
    steps: [
      {
        name: 'núcleo de la ejecución',
        status: 'passed',
        durationMs: 1200,
      },
    ],
    screenshots: [],
    video: null,
    error: null,
    snapshot: null,
    timestamp: new Date().toISOString(),
  };

  reply.code(200);
  return body;
});

const start = async () => {
  try {
    await app.listen({ port: env.RUNNER_PORT, host: '0.0.0.0' });
  } catch (error) {
    app.log.error(error);
    process.exit(1);
  }
};

void start();
