import { timingSafeEqual } from 'node:crypto';
import { PassThrough } from 'node:stream';
import {
  executeTestRequestSchema,
  executionResultSchema,
  healthStatusSchema,
  type AllowedDomains,
  type ApiError,
  type ExecutionEvent,
} from '@testpilot/shared';
import { checkScriptPolicy } from '@testpilot/shared/script-policy';
import Fastify, { type FastifyServerOptions } from 'fastify';
import { ZodError } from 'zod';
import { ExecutionError, type Executor } from './executor.js';

export type AppOptions = {
  internalApiKey: string;
  allowedDomains: AllowedDomains;
  executor: Executor;
  logger?: FastifyServerOptions['logger'];
};

export const buildApp = (options: AppOptions) => {
  const app = Fastify({ logger: options.logger ?? true, bodyLimit: 256 * 1024 });
  const expectedKey = Buffer.from(options.internalApiKey);

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
      const body: ApiError = {
        error: 'unauthorized',
        message: 'Missing or invalid INTERNAL_API_KEY',
      };
      return reply.code(401).send(body);
    }
  });

  app.setErrorHandler<Error & { statusCode?: number }>((error, request, reply) => {
    let statusCode: number;
    let body: ApiError;

    if (error instanceof ExecutionError) {
      statusCode = error.code === 'runner_busy' ? 503 : 500;
      body = { error: error.code, message: error.message };
    } else if (error instanceof ZodError) {
      statusCode = 400;
      body = {
        error: 'invalid_request',
        message: 'La solicitud no es válida.',
        details: error.issues.map((issue) => `${issue.path.join('.') || 'body'}: ${issue.message}`),
      };
    } else if (error.statusCode !== undefined && error.statusCode < 500) {
      statusCode = error.statusCode;
      body = { error: 'bad_request', message: error.message };
    } else {
      statusCode = 500;
      body = { error: 'internal_error', message: 'Error interno del runner.' };
    }

    if (statusCode >= 500) {
      request.log.error({ err: error }, 'request failed');
    }
    return reply.code(statusCode).send(body);
  });

  app.get('/health', async () =>
    healthStatusSchema.parse({
      status: 'ok',
      service: 'runner',
      timestamp: new Date().toISOString(),
    }),
  );

  app.post('/execute', async (request, reply) => {
    const { script } = executeTestRequestSchema.parse(request.body);

    // Segunda línea de defensa: la API ya validó el script, pero el runner no confía en nadie.
    const policy = checkScriptPolicy(script, { allowedDomains: options.allowedDomains });
    if (!policy.ok) {
      const body: ApiError = {
        error: 'unsafe_script',
        message: 'El script no cumple la política de seguridad.',
        details: policy.violations,
      };
      return reply.code(422).send(body);
    }

    // Se comprueba antes de abrir el stream para poder responder 503 con un estado HTTP normal.
    if (options.executor.isBusy()) {
      throw new ExecutionError('runner_busy', 'El runner está ejecutando otra prueba.');
    }

    const stream = new PassThrough();
    const send = (event: ExecutionEvent) => stream.write(`${JSON.stringify(event)}\n`);
    const abort = new AbortController();
    // Si el cliente se va antes de terminar, se mata el navegador en lugar de seguir ejecutando.
    reply.raw.on('close', () => {
      if (!reply.raw.writableFinished) {
        abort.abort();
      }
    });

    options.executor
      .run(script, { onProgress: send, signal: abort.signal })
      .then((result) => send({ type: 'result', result: executionResultSchema.parse(result) }))
      .catch((error: unknown) => {
        request.log.error({ err: error }, 'execution failed');
        const apiError: ApiError =
          error instanceof ExecutionError
            ? { error: error.code, message: error.message }
            : { error: 'internal_error', message: 'Error interno del runner.' };
        send({ type: 'error', error: apiError });
      })
      .finally(() => stream.end());

    return reply.type('application/x-ndjson').send(stream);
  });

  return app;
};
