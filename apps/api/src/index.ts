import Fastify from 'fastify';
import { healthStatusSchema } from '@testpilot/shared';
import { env } from './config.js';

const app = Fastify({ logger: true });

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
  const response = await fetch(`${env.RUNNER_URL}/health`, {
    headers: {
      'x-internal-api-key': env.INTERNAL_API_KEY,
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
    await app.listen({ port: env.API_PORT, host: '0.0.0.0' });
  } catch (error) {
    app.log.error(error);
    process.exit(1);
  }
};

void start();
