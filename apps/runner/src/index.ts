import { fileURLToPath } from 'node:url';
import { buildApp } from './app.js';
import { env } from './config.js';
import { createExecutor } from './executor.js';

// Dentro del paquete del runner para que el script generado resuelva @playwright/test.
const runsDir = fileURLToPath(new URL('../.runs/', import.meta.url));

const app = buildApp({
  internalApiKey: env.INTERNAL_API_KEY,
  execute: createExecutor({ runsDir, timeoutMs: env.RUN_TIMEOUT_MS }),
});

try {
  await app.listen({ port: env.RUNNER_PORT, host: '0.0.0.0' });
} catch (error) {
  app.log.error(error);
  process.exit(1);
}
