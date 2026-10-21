import Fastify from 'fastify';
import { healthStatusSchema } from '@testpilot/shared';

const app = Fastify({ logger: true });
const internalApiKey = process.env.INTERNAL_API_KEY ?? 'development-secret';

app.addHook('preHandler', async (request, reply) => {
  if (request.routeOptions.url === '/health' || request.url === '/health') {
    return;
  }

  const providedKey = request.headers['x-internal-api-key'];
  if (providedKey !== internalApiKey) {
    reply.code(401).send({
      error: 'Unauthorized',
      message: 'Missing or invalid INTERNAL_API_KEY',
    });
    return;
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
    const port = Number(process.env.PORT ?? 3002);
    await app.listen({ port, host: '0.0.0.0' });
    app.log.info(`Runner listening on http://0.0.0.0:${port}`);
  } catch (error) {
    app.log.error(error);
    process.exit(1);
  }
};

start();
