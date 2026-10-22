import { executionEventSchema, type ExecutionResult } from '@testpilot/shared';
import { describe, expect, it } from 'vitest';
import { buildApp } from './app.js';
import { ExecutionError, type Executor } from './executor.js';

const KEY = 'k'.repeat(32);

const passed: ExecutionResult = {
  status: 'passed',
  durationMs: 10,
  steps: [{ title: 'paso', status: 'passed', durationMs: 5, error: null }],
  error: null,
  screenshot: null,
};

const validScript = `import { test, expect } from '@playwright/test';
test('x', async ({ page }) => {
  await test.step('paso', async () => {
    await expect(page).toHaveURL(/about/);
  });
});
`;

const fakeExecutor = (
  run: Executor['run'] = async () => passed,
  isBusy: () => boolean = () => false,
): Executor => ({ isBusy, run });

const setup = (executor: Executor = fakeExecutor()) =>
  buildApp({ internalApiKey: KEY, executor, logger: false });

// null envía la petición sin cabecera de clave.
const post = (app: ReturnType<typeof setup>, payload: unknown, key: string | null = KEY) =>
  app.inject({
    method: 'POST',
    url: '/execute',
    payload: payload as object,
    headers: key === null ? {} : { 'x-internal-api-key': key },
  });

const parseEvents = (body: string) =>
  body
    .trim()
    .split('\n')
    .map((line) => executionEventSchema.parse(JSON.parse(line)));

describe('POST /execute', () => {
  it.each([
    ['sin clave', null],
    ['con clave incorrecta', 'x'.repeat(32)],
  ])('responde 401 %s', async (_name, key) => {
    const response = await post(setup(), { script: validScript }, key);
    expect(response.statusCode).toBe(401);
  });

  it('emite el progreso y termina con el resultado', async () => {
    const scripts: string[] = [];
    const executor = fakeExecutor(async (script, options) => {
      scripts.push(script);
      options?.onProgress?.({ type: 'step-begin', index: 0, title: 'paso' });
      options?.onProgress?.({ type: 'step-end', index: 0, step: passed.steps[0]! });
      return passed;
    });

    const response = await post(setup(executor), { script: validScript });

    expect(response.statusCode).toBe(200);
    expect(response.headers['content-type']).toContain('application/x-ndjson');
    expect(parseEvents(response.body)).toEqual([
      { type: 'step-begin', index: 0, title: 'paso' },
      { type: 'step-end', index: 0, step: passed.steps[0] },
      { type: 'result', result: passed },
    ]);
    expect(scripts).toEqual([validScript]);
  });

  it('termina el stream con un evento de error si la ejecución falla', async () => {
    const executor = fakeExecutor(async () => {
      throw new ExecutionError('execution_failed', 'sin reporte');
    });
    const response = await post(setup(executor), { script: validScript });
    expect(response.statusCode).toBe(200);
    expect(parseEvents(response.body)).toEqual([
      { type: 'error', error: { error: 'execution_failed', message: 'sin reporte' } },
    ]);
  });

  it('rechaza con 422 un script inseguro sin ejecutarlo', async () => {
    let executed = false;
    const executor = fakeExecutor(async () => {
      executed = true;
      return passed;
    });
    const response = await post(setup(executor), {
      script: validScript.replace('await expect', "eval('x'); await expect"),
    });
    expect(response.statusCode).toBe(422);
    expect(response.json()).toMatchObject({ error: 'unsafe_script' });
    expect(executed).toBe(false);
  });

  it('responde 400 con un cuerpo inválido', async () => {
    const response = await post(setup(), { script: '' });
    expect(response.statusCode).toBe(400);
  });

  it('responde 503 antes de abrir el stream si el runner está ocupado', async () => {
    const response = await post(setup(fakeExecutor(undefined, () => true)), {
      script: validScript,
    });
    expect(response.statusCode).toBe(503);
    expect(response.json()).toMatchObject({ error: 'runner_busy' });
  });
});

describe('GET /health', () => {
  it('no exige clave', async () => {
    const response = await setup().inject({ method: 'GET', url: '/health' });
    expect(response.statusCode).toBe(200);
  });
});
