import Fastify from 'fastify';
import { healthStatusSchema } from '@testpilot/shared';

const app = Fastify({ logger: true });
const runnerUrl = process.env.RUNNER_URL ?? 'http://localhost:3002';
const internalApiKey = process.env.INTERNAL_API_KEY ?? 'development-secret';

app.get('/health', async () => {
  const payload = {
    status: 'ok',
    service: 'api',
    timestamp: new Date().toISOString(),
  };

  return healthStatusSchema.parse(payload);
});

app.get('/api/health', async () => {
  return {
    status: 'ok',
    service: 'api',
    timestamp: new Date().toISOString(),
  };
});

app.get('/api/ping', async () => {
  const response = await fetch(`${runnerUrl}/health`, {
    headers: {
      'x-internal-api-key': internalApiKey,
    },
  });

  if (!response.ok) {
    return {
      ok: false,
      status: response.status,
      message: 'runner unavailable',
    };
  }

  return {
    ok: true,
    status: response.status,
    message: 'runner reachable',
  };
});

const start = async () => {
  try {
    const port = Number(process.env.PORT ?? 3001);
    await app.listen({ port, host: '0.0.0.0' });
    app.log.info(`API listening on http://0.0.0.0:${port}`);
  } catch (error) {
    app.log.error(error);
    process.exit(1);
  }
};

start();
