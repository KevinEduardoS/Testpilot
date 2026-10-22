import type { ExecutionResult } from '@testpilot/shared';
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

const setup = (execute: Executor = async () => passed) =>
  buildApp({ internalApiKey: KEY, execute, logger: false });

// null envía la petición sin cabecera de clave.
const post = (app: ReturnType<typeof setup>, payload: unknown, key: string | null = KEY) =>
  app.inject({
    method: 'POST',
    url: '/execute',
    payload: payload as object,
    headers: key === null ? {} : { 'x-internal-api-key': key },
  });

describe('POST /execute', () => {
  it.each([
    ['sin clave', null],
    ['con clave incorrecta', 'x'.repeat(32)],
  ])('responde 401 %s', async (_name, key) => {
    const response = await post(setup(), { script: validScript }, key);
    expect(response.statusCode).toBe(401);
  });

  it('ejecuta un script válido', async () => {
    const scripts: string[] = [];
    const response = await post(
      setup(async (script) => {
        scripts.push(script);
        return passed;
      }),
      { script: validScript },
    );
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual(passed);
    expect(scripts).toEqual([validScript]);
  });

  it('rechaza con 422 un script inseguro sin ejecutarlo', async () => {
    let executed = false;
    const response = await post(
      setup(async () => {
        executed = true;
        return passed;
      }),
      { script: validScript.replace("await expect", "eval('x'); await expect") },
    );
    expect(response.statusCode).toBe(422);
    expect(response.json()).toMatchObject({ error: 'unsafe_script' });
    expect(executed).toBe(false);
  });

  it('responde 400 con un cuerpo inválido', async () => {
    const response = await post(setup(), { script: '' });
    expect(response.statusCode).toBe(400);
  });

  it('responde 503 si el runner está ocupado', async () => {
    const response = await post(
      setup(async () => {
        throw new ExecutionError('runner_busy', 'ocupado');
      }),
      { script: validScript },
    );
    expect(response.statusCode).toBe(503);
    expect(response.json()).toEqual({ error: 'runner_busy', message: 'ocupado' });
  });
});

describe('GET /health', () => {
  it('no exige clave', async () => {
    const response = await setup().inject({ method: 'GET', url: '/health' });
    expect(response.statusCode).toBe(200);
  });
});
