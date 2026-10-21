import cors from '@fastify/cors';
import Fastify from 'fastify';
import { healthStatusSchema, runnerPingSchema, type RunnerPing } from '@testpilot/shared';
import { env } from './config.js';

const RUNNER_PING_TIMEOUT_MS = 3000;

const app = Fastify({ logger: true });

await app.register(cors, { origin: env.WEB_ORIGIN });

app.get('/health', async () => {
  const payload = {
    status: 'ok',
    service: 'api',
    timestamp: new Date().toISOString(),
  };

  return healthStatusSchema.parse(payload);
});

app.get('/api/ping', async (request, reply) => {
  let result: RunnerPing;

  try {
    const response = await fetch(`${env.RUNNER_URL}/health`, {
      headers: {
        'x-internal-api-key': env.INTERNAL_API_KEY,
      },
      signal: AbortSignal.timeout(RUNNER_PING_TIMEOUT_MS),
    });

    result = response.ok
      ? { ok: true, message: 'runner reachable' }
      : { ok: false, message: `runner responded with status ${response.status}` };
  } catch (error) {
    request.log.warn({ err: error }, 'runner unreachable');
    result = { ok: false, message: 'runner unreachable' };
  }

  reply.code(result.ok ? 200 : 503);
  return runnerPingSchema.parse(result);
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
