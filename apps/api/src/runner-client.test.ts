import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import type { ExecutionResult } from '@testpilot/shared';
import { afterEach, describe, expect, it } from 'vitest';
import { HttpError } from './errors.js';
import { createRunnerClient } from './runner-client.js';

const KEY = 'k'.repeat(32);

const passed: ExecutionResult = {
  status: 'passed',
  durationMs: 10,
  steps: [{ title: 'paso', status: 'passed', durationMs: 5, error: null }],
  error: null,
  screenshot: null,
};

let server: Server | undefined;

afterEach(async () => {
  await new Promise((resolve) => (server ? server.close(resolve) : resolve(undefined)));
  server = undefined;
});

type Received = { key: string | undefined; body: string };

// Runner falso que responde siempre con el mismo estado y cuerpo.
const fakeRunner = async (status: number, body: unknown) => {
  const received: Received[] = [];
  server = createServer((request, response) => {
    let data = '';
    request.on('data', (chunk: Buffer) => (data += chunk.toString()));
    request.on('end', () => {
      const key = request.headers['x-internal-api-key'];
      received.push({ key: typeof key === 'string' ? key : undefined, body: data });
      response.writeHead(status, { 'content-type': 'application/json' });
      response.end(JSON.stringify(body));
    });
  });
  await new Promise<void>((resolve) => server?.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as AddressInfo;
  const execute = createRunnerClient({
    runnerUrl: `http://127.0.0.1:${port}`,
    internalApiKey: KEY,
    runTimeoutMs: 1000,
  });
  return { received, execute };
};

const expectHttpError = async (promise: Promise<unknown>, statusCode: number, code: string) => {
  const error = await promise.catch((caught: unknown) => caught);
  expect(error).toBeInstanceOf(HttpError);
  expect(error).toMatchObject({ statusCode, code });
};

describe('createRunnerClient', () => {
  it('envía el script con la clave interna y devuelve el resultado', async () => {
    const { received, execute } = await fakeRunner(200, passed);
    await expect(execute('script')).resolves.toEqual(passed);
    expect(received).toEqual([{ key: KEY, body: JSON.stringify({ script: 'script' }) }]);
  });

  it('propaga el rechazo por política del runner', async () => {
    const { execute } = await fakeRunner(422, {
      error: 'unsafe_script',
      message: 'inseguro',
      details: ['línea 1'],
    });
    await expectHttpError(execute('script'), 422, 'unsafe_script');
  });

  it('propaga que el runner está ocupado', async () => {
    const { execute } = await fakeRunner(503, { error: 'runner_busy', message: 'ocupado' });
    await expectHttpError(execute('script'), 503, 'runner_busy');
  });

  it('trata un 401 del runner como error interno', async () => {
    const { execute } = await fakeRunner(401, { error: 'unauthorized', message: 'clave' });
    await expectHttpError(execute('script'), 502, 'runner_error');
  });

  it('rechaza un resultado con formato inválido', async () => {
    const { execute } = await fakeRunner(200, { status: 'passed' });
    await expectHttpError(execute('script'), 502, 'invalid_runner_response');
  });

  it('responde 503 si el runner no está disponible', async () => {
    const execute = createRunnerClient({
      runnerUrl: 'http://127.0.0.1:9',
      internalApiKey: KEY,
      runTimeoutMs: 1000,
    });
    await expectHttpError(execute('script'), 503, 'runner_unavailable');
  });
});
