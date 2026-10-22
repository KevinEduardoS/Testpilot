import { PassThrough } from 'node:stream';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import {
  appInfoSchema,
  executeTestRequestSchema,
  generateTestRequestSchema,
  generateTestResponseSchema,
  healthStatusSchema,
  repairTestRequestSchema,
  repairTestResponseSchema,
  runnerPingSchema,
  isAllowedHost,
  type AiProvider,
  type AllowedDomains,
  type ApiError,
  type RunnerPing,
} from '@testpilot/shared';
import { checkScriptPolicy } from '@testpilot/shared/script-policy';
import Fastify, { type FastifyServerOptions } from 'fastify';
import { ZodError } from 'zod';
import { HttpError } from './errors.js';
import type { TestExecutor } from './runner-client.js';
import type { TestGenerator } from './test-generator.js';
import type { TestRepairer } from './test-repairer.js';

const RUNNER_PING_TIMEOUT_MS = 3000;

const assertSafeScript = (script: string, allowedDomains: AllowedDomains) => {
  const policy = checkScriptPolicy(script, { allowedDomains });
  if (!policy.ok) {
    throw new HttpError(
      422,
      'unsafe_script',
      'El script no cumple la política de seguridad.',
      policy.violations,
    );
  }
};

export type AppOptions = {
  webOrigin: string;
  runnerUrl: string;
  internalApiKey: string;
  rateLimitPerHour: number;
  aiProvider: AiProvider;
  allowedDomains: AllowedDomains;
  generateTest: TestGenerator;
  repairTest: TestRepairer;
  executeTest: TestExecutor;
  logger?: FastifyServerOptions['logger'];
};

export const buildApp = async (options: AppOptions) => {
  const app = Fastify({ logger: options.logger ?? true });

  await app.register(cors, { origin: options.webOrigin });
  await app.register(rateLimit, { global: false });

  app.setErrorHandler<Error & { statusCode?: number }>((error, request, reply) => {
    let body: ApiError;
    let statusCode: number;

    if (error instanceof HttpError) {
      statusCode = error.statusCode;
      body = { error: error.code, message: error.message, details: error.details };
    } else if (error instanceof ZodError) {
      statusCode = 400;
      body = {
        error: 'invalid_request',
        message: 'La solicitud no es válida.',
        details: error.issues.map((issue) => `${issue.path.join('.') || 'body'}: ${issue.message}`),
      };
    } else if (error.statusCode === 429) {
      statusCode = 429;
      body = {
        error: 'rate_limited',
        message: 'Límite de solicitudes alcanzado. Intenta más tarde.',
      };
    } else if (error.statusCode !== undefined && error.statusCode < 500) {
      statusCode = error.statusCode;
      body = { error: 'bad_request', message: error.message };
    } else {
      statusCode = 500;
      body = { error: 'internal_error', message: 'Error interno del servidor.' };
    }

    if (statusCode >= 500) {
      request.log.error({ err: error }, 'request failed');
    }
    return reply.code(statusCode).send(body);
  });

  app.get('/health', async () =>
    healthStatusSchema.parse({ status: 'ok', service: 'api', timestamp: new Date().toISOString() }),
  );

  app.get('/api/info', async () =>
    appInfoSchema.parse({ aiProvider: options.aiProvider, allowedDomains: options.allowedDomains }),
  );

  app.get('/api/ping', async (request, reply) => {
    let result: RunnerPing;

    try {
      const response = await fetch(`${options.runnerUrl}/health`, {
        headers: { 'x-internal-api-key': options.internalApiKey },
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

  app.post(
    '/api/tests/generate',
    { config: { rateLimit: { max: options.rateLimitPerHour, timeWindow: '1 hour' } } },
    async (request) => {
      const input = generateTestRequestSchema.parse(request.body);
      // Se comprueba antes de llamar a la IA: una prueba para otro dominio no podría ejecutarse.
      if (
        input.baseUrl !== undefined &&
        !isAllowedHost(new URL(input.baseUrl).hostname, options.allowedDomains)
      ) {
        throw new HttpError(
          422,
          'domain_not_allowed',
          `Esta instancia de TestPilot solo puede probar: ${options.allowedDomains?.join(', ')}.`,
        );
      }
      return generateTestResponseSchema.parse(await options.generateTest(input, request.log));
    },
  );

  app.post(
    '/api/tests/repair',
    { config: { rateLimit: { max: options.rateLimitPerHour, timeWindow: '1 hour' } } },
    async (request) => {
      const input = repairTestRequestSchema.parse(request.body);
      // El script que se pide reparar llega del cliente: se valida como cualquier otro.
      assertSafeScript(input.script, options.allowedDomains);
      return repairTestResponseSchema.parse(await options.repairTest(input, request.log));
    },
  );

  app.post(
    '/api/tests/execute',
    { config: { rateLimit: { max: options.rateLimitPerHour, timeWindow: '1 hour' } } },
    async (request, reply) => {
      const { script } = executeTestRequestSchema.parse(request.body);
      // El cliente puede enviar cualquier script: se valida aquí y otra vez en el runner.
      assertSafeScript(script, options.allowedDomains);

      const abort = new AbortController();
      // Los errores previos a la ejecución se lanzan aquí y responden con su estado HTTP.
      const events = await options.executeTest(script, abort.signal);

      const stream = new PassThrough();
      // Si el navegador se desconecta, se cancela la ejecución en el runner.
      reply.raw.on('close', () => {
        if (!reply.raw.writableFinished) {
          abort.abort();
        }
      });

      void (async () => {
        for await (const event of events) {
          stream.write(`${JSON.stringify(event)}\n`);
        }
        stream.end();
      })();

      return reply.type('application/x-ndjson').send(stream);
    },
  );

  return app;
};
