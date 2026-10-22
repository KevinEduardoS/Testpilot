import {
  executionEventSchema,
  type ExecutionEvent,
  type ExecutionResult,
  type GenerateTestResponse,
  type RepairTestRequest,
  type RepairTestResponse,
} from '@testpilot/shared';
import { describe, expect, it } from 'vitest';
import { buildApp } from './app.js';
import { HttpError } from './errors.js';
import type { TestExecutor } from './runner-client.js';
import type { TestGenerator } from './test-generator.js';
import type { TestRepairer } from './test-repairer.js';

const okResponse: GenerateTestResponse = {
  status: 'ok',
  test: { title: 't', steps: ['s'], script: 'script', assumptions: [], warnings: [] },
};

const fixedResponse: RepairTestResponse = {
  status: 'fixed',
  diagnosis: { category: 'selector', summary: 'el selector cambió' },
  test: okResponse.test,
};

const passed: ExecutionResult = {
  status: 'passed',
  durationMs: 10,
  steps: [],
  error: null,
  screenshot: null,
  pageSnapshot: null,
};

const validScript = `import { test, expect } from '@playwright/test';
test('x', async ({ page }) => {
  await test.step('paso', async () => {
    await expect(page).toHaveURL(/about/);
  });
});
`;

async function* toEvents(events: ExecutionEvent[]): AsyncIterable<ExecutionEvent> {
  yield* events;
}

const parseEvents = (body: string) =>
  body
    .trim()
    .split('\n')
    .map((line) => executionEventSchema.parse(JSON.parse(line)));

type SetupOptions = {
  generateTest?: TestGenerator;
  repairTest?: TestRepairer;
  executeTest?: TestExecutor;
  rateLimitPerHour?: number;
  trustProxy?: number;
};

const setup = async ({
  generateTest = async () => okResponse,
  repairTest = async () => fixedResponse,
  executeTest = async () => toEvents([{ type: 'result', result: passed }]),
  rateLimitPerHour = 10,
  trustProxy = 0,
}: SetupOptions = {}) =>
  buildApp({
    webOrigin: 'http://localhost:5173',
    // Puerto 9 (discard): nada escucha ahí, así que el runner aparece caído.
    runnerUrl: 'http://127.0.0.1:9',
    internalApiKey: 'k'.repeat(32),
    rateLimitPerHour,
    trustProxy,
    aiProvider: 'demo',
    allowedDomains: ['saucedemo.com'],
    generateTest,
    repairTest,
    executeTest,
    logger: false,
  });

const generate = (app: Awaited<ReturnType<typeof setup>>, payload: unknown) =>
  app.inject({ method: 'POST', url: '/api/tests/generate', payload: payload as object });

describe('POST /api/tests/generate', () => {
  it('devuelve la prueba generada', async () => {
    const app = await setup();
    const response = await generate(app, {
      instruction: 'probar login',
      baseUrl: 'https://www.saucedemo.com',
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual(okResponse);
  });

  it('rechaza con 422 una URL base fuera de los dominios permitidos sin llamar a la IA', async () => {
    let called = false;
    const app = await setup({
      generateTest: async () => {
        called = true;
        return okResponse;
      },
    });
    const response = await generate(app, { instruction: 'probar', baseUrl: 'https://example.com' });
    expect(response.statusCode).toBe(422);
    expect(response.json()).toEqual({
      error: 'domain_not_allowed',
      message: 'Esta instancia de TestPilot solo puede probar: saucedemo.com.',
    });
    expect(called).toBe(false);
  });

  it.each([
    ['instrucción vacía', { instruction: '   ' }],
    ['instrucción demasiado larga', { instruction: 'x'.repeat(1001) }],
    ['URL no http', { instruction: 'probar', baseUrl: 'file:///etc/passwd' }],
    ['sin cuerpo', undefined],
  ])('responde 400 con %s', async (_name, payload) => {
    const app = await setup();
    const response = await generate(app, payload);
    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({
      error: expect.any(String),
      message: expect.any(String),
    });
  });

  it('propaga los HttpError del generador', async () => {
    const app = await setup({
      generateTest: async () => {
        throw new HttpError(502, 'unsafe_script', 'inseguro', [
          'línea 1: "eval" no está permitido',
        ]);
      },
    });
    const response = await generate(app, { instruction: 'probar' });
    expect(response.statusCode).toBe(502);
    expect(response.json()).toEqual({
      error: 'unsafe_script',
      message: 'inseguro',
      details: ['línea 1: "eval" no está permitido'],
    });
  });

  it('oculta los errores inesperados', async () => {
    const app = await setup({
      generateTest: async () => {
        throw new Error('detalle interno');
      },
    });
    const response = await generate(app, { instruction: 'probar' });
    expect(response.statusCode).toBe(500);
    expect(response.json()).toEqual({
      error: 'internal_error',
      message: 'Error interno del servidor.',
    });
  });

  it('aplica el límite de solicitudes por hora', async () => {
    const app = await setup({ rateLimitPerHour: 2 });
    const statuses = [];
    for (let i = 0; i < 3; i += 1) {
      statuses.push((await generate(app, { instruction: 'probar' })).statusCode);
    }
    expect(statuses).toEqual([200, 200, 429]);
  });

  it.each([
    ['cuenta a cada visitante por separado detrás de un proxy de confianza', 1, [200, 200]],
    ['ignora X-Forwarded-For sin proxies de confianza', 0, [200, 429]],
  ])('%s', async (_name, trustProxy, expected) => {
    const app = await setup({ rateLimitPerHour: 1, trustProxy });
    const statuses = [];
    for (const visitor of ['203.0.113.1', '203.0.113.2']) {
      const response = await app.inject({
        method: 'POST',
        url: '/api/tests/generate',
        payload: { instruction: 'probar' },
        headers: { 'x-forwarded-for': visitor },
      });
      statuses.push(response.statusCode);
    }
    expect(statuses).toEqual(expected);
  });

  it('solo autoriza CORS para el origen de la web', async () => {
    const app = await setup();
    const response = await app.inject({
      method: 'OPTIONS',
      url: '/api/tests/generate',
      headers: { origin: 'http://localhost:5173', 'access-control-request-method': 'POST' },
    });
    expect(response.headers['access-control-allow-origin']).toBe('http://localhost:5173');
  });
});

describe('POST /api/tests/execute', () => {
  const execute = (app: Awaited<ReturnType<typeof setup>>, payload: unknown) =>
    app.inject({ method: 'POST', url: '/api/tests/execute', payload: payload as object });

  it('transmite al cliente los eventos del runner', async () => {
    const scripts: string[] = [];
    const events: ExecutionEvent[] = [
      { type: 'step-begin', index: 0, title: 'paso' },
      { type: 'result', result: passed },
    ];
    const app = await setup({
      executeTest: async (script) => {
        scripts.push(script);
        return toEvents(events);
      },
    });
    const response = await execute(app, { script: validScript });
    expect(response.statusCode).toBe(200);
    expect(response.headers['content-type']).toContain('application/x-ndjson');
    expect(parseEvents(response.body)).toEqual(events);
    expect(scripts).toEqual([validScript]);
  });

  it('rechaza con 422 un script inseguro sin llamar al runner', async () => {
    let called = false;
    const app = await setup({
      executeTest: async () => {
        called = true;
        return toEvents([]);
      },
    });
    const response = await execute(app, {
      script: validScript.replace('await expect', "eval('x'); await expect"),
    });
    expect(response.statusCode).toBe(422);
    expect(response.json()).toMatchObject({ error: 'unsafe_script' });
    expect(called).toBe(false);
  });

  it('rechaza con 422 un script que navega fuera de los dominios permitidos', async () => {
    const response = await execute(await setup(), {
      script: validScript.replace(
        'await expect',
        "await page.goto('https://example.com'); await expect",
      ),
    });
    expect(response.statusCode).toBe(422);
    expect(response.json()).toMatchObject({ error: 'unsafe_script' });
  });

  it('propaga los errores del runner', async () => {
    const app = await setup({
      executeTest: async () => {
        throw new HttpError(503, 'runner_busy', 'ocupado');
      },
    });
    const response = await execute(app, { script: validScript });
    expect(response.statusCode).toBe(503);
    expect(response.json()).toEqual({ error: 'runner_busy', message: 'ocupado' });
  });
});

describe('POST /api/tests/repair', () => {
  const repairRequest: RepairTestRequest = {
    instructions: ['probar el título'],
    script: validScript,
    failure: { status: 'failed', error: 'no encontrado', steps: [], pageSnapshot: '- heading "x"' },
  };
  const repair = (app: Awaited<ReturnType<typeof setup>>, payload: unknown) =>
    app.inject({ method: 'POST', url: '/api/tests/repair', payload: payload as object });

  it('devuelve el diagnóstico del reparador', async () => {
    const received: RepairTestRequest[] = [];
    const app = await setup({
      repairTest: async (request) => {
        received.push(request);
        return fixedResponse;
      },
    });
    const response = await repair(app, repairRequest);
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual(fixedResponse);
    expect(received).toEqual([repairRequest]);
  });

  it('rechaza con 422 un script inseguro sin llamar al reparador', async () => {
    let called = false;
    const app = await setup({
      repairTest: async () => {
        called = true;
        return fixedResponse;
      },
    });
    const response = await repair(app, {
      ...repairRequest,
      script: validScript.replace('await expect', "eval('x'); await expect"),
    });
    expect(response.statusCode).toBe(422);
    expect(called).toBe(false);
  });

  it('rechaza con 400 una ejecución que pasó', async () => {
    const app = await setup();
    const response = await repair(app, {
      ...repairRequest,
      failure: { ...repairRequest.failure, status: 'passed' },
    });
    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({ error: 'invalid_request' });
  });
});

describe('GET /api/info', () => {
  it('informa el proveedor de IA y los dominios permitidos', async () => {
    const app = await setup();
    const response = await app.inject({ method: 'GET', url: '/api/info' });
    expect(response.json()).toEqual({ aiProvider: 'demo', allowedDomains: ['saucedemo.com'] });
  });
});

describe('GET /api/ping', () => {
  it('responde 503 si el runner no está disponible', async () => {
    const app = await setup();
    const response = await app.inject({ method: 'GET', url: '/api/ping' });
    expect(response.statusCode).toBe(503);
    expect(response.json()).toEqual({ ok: false, message: 'runner unreachable' });
  });
});
