import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import type { ExecutionEvent, ExecutionResult } from '@testpilot/shared';
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
  pageSnapshot: null,
};

const ndjson = (events: unknown[]) => events.map((event) => `${JSON.stringify(event)}\n`).join('');

let server: Server | undefined;

afterEach(async () => {
  await new Promise((resolve) => (server ? server.close(resolve) : resolve(undefined)));
  server = undefined;
});

type Received = { key: string | undefined; body: string };

// Runner falso que responde siempre con el mismo estado y cuerpo crudo.
const fakeRunner = async (status: number, body: string, contentType = 'application/x-ndjson') => {
  const received: Received[] = [];
  server = createServer((request, response) => {
    let data = '';
    request.on('data', (chunk: Buffer) => (data += chunk.toString()));
    request.on('end', () => {
      const key = request.headers['x-internal-api-key'];
      received.push({ key: typeof key === 'string' ? key : undefined, body: data });
      response.writeHead(status, { 'content-type': contentType });
      response.end(body);
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

const collect = async (events: AsyncIterable<ExecutionEvent>) => {
  const collected: ExecutionEvent[] = [];
  for await (const event of events) {
    collected.push(event);
  }
  return collected;
};

const run = (execute: ReturnType<typeof createRunnerClient>) =>
  execute('script', new AbortController().signal);

const expectHttpError = async (promise: Promise<unknown>, statusCode: number, code: string) => {
  const error = await promise.catch((caught: unknown) => caught);
  expect(error).toBeInstanceOf(HttpError);
  expect(error).toMatchObject({ statusCode, code });
};

describe('createRunnerClient', () => {
  it('envía el script con la clave interna y transmite los eventos', async () => {
    const events: ExecutionEvent[] = [
      { type: 'step-begin', index: 0, title: 'paso' },
      { type: 'step-end', index: 0, step: passed.steps[0]! },
      { type: 'result', result: passed },
    ];
    const { received, execute } = await fakeRunner(200, ndjson(events));

    await expect(collect(await run(execute))).resolves.toEqual(events);
    expect(received).toEqual([{ key: KEY, body: JSON.stringify({ script: 'script' }) }]);
  });

  it('corta con un evento de error ante una línea inválida', async () => {
    const { execute } = await fakeRunner(
      200,
      ndjson([{ type: 'desconocido' }, { type: 'result', result: passed }]),
    );
    await expect(collect(await run(execute))).resolves.toEqual([
      { type: 'error', error: expect.objectContaining({ error: 'invalid_event' }) },
    ]);
  });

  it('añade un evento de error si el stream termina sin resultado', async () => {
    const { execute } = await fakeRunner(
      200,
      ndjson([{ type: 'step-begin', index: 0, title: 'paso' }]),
    );
    const events = await collect(await run(execute));
    expect(events.at(-1)).toEqual({
      type: 'error',
      error: expect.objectContaining({ error: 'stream_incomplete' }),
    });
  });

  it('propaga el rechazo por política del runner', async () => {
    const { execute } = await fakeRunner(
      422,
      JSON.stringify({ error: 'unsafe_script', message: 'inseguro', details: ['línea 1'] }),
      'application/json',
    );
    await expectHttpError(run(execute), 422, 'unsafe_script');
  });

  it('propaga que el runner está ocupado', async () => {
    const { execute } = await fakeRunner(
      503,
      JSON.stringify({ error: 'runner_busy', message: 'ocupado' }),
      'application/json',
    );
    await expectHttpError(run(execute), 503, 'runner_busy');
  });

  it('trata un 401 del runner como error interno', async () => {
    const { execute } = await fakeRunner(
      401,
      JSON.stringify({ error: 'unauthorized', message: 'clave' }),
      'application/json',
    );
    await expectHttpError(run(execute), 502, 'runner_error');
  });

  it('responde 503 si el runner no está disponible', async () => {
    const execute = createRunnerClient({
      runnerUrl: 'http://127.0.0.1:9',
      internalApiKey: KEY,
      runTimeoutMs: 1000,
    });
    await expectHttpError(run(execute), 503, 'runner_unavailable');
  });
});
