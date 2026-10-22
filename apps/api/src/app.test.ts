import type { GenerateTestResponse } from '@testpilot/shared';
import { describe, expect, it } from 'vitest';
import { buildApp } from './app.js';
import { HttpError } from './errors.js';
import type { TestGenerator } from './test-generator.js';

const okResponse: GenerateTestResponse = {
  status: 'ok',
  test: { title: 't', steps: ['s'], script: 'script', assumptions: [], warnings: [] },
};

const setup = async (generateTest: TestGenerator = async () => okResponse, rateLimitPerHour = 10) =>
  buildApp({
    webOrigin: 'http://localhost:5173',
    // Puerto 9 (discard): nada escucha ahí, así que el runner aparece caído.
    runnerUrl: 'http://127.0.0.1:9',
    internalApiKey: 'k'.repeat(32),
    rateLimitPerHour,
    generateTest,
    logger: false,
  });

const generate = (app: Awaited<ReturnType<typeof setup>>, payload: unknown) =>
  app.inject({ method: 'POST', url: '/api/tests/generate', payload: payload as object });

describe('POST /api/tests/generate', () => {
  it('devuelve la prueba generada', async () => {
    const app = await setup();
    const response = await generate(app, { instruction: 'probar login', baseUrl: 'https://example.com' });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual(okResponse);
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
    expect(response.json()).toMatchObject({ error: expect.any(String), message: expect.any(String) });
  });

  it('propaga los HttpError del generador', async () => {
    const app = await setup(async () => {
      throw new HttpError(502, 'unsafe_script', 'inseguro', ['línea 1: "eval" no está permitido']);
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
    const app = await setup(async () => {
      throw new Error('detalle interno');
    });
    const response = await generate(app, { instruction: 'probar' });
    expect(response.statusCode).toBe(500);
    expect(response.json()).toEqual({ error: 'internal_error', message: 'Error interno del servidor.' });
  });

  it('aplica el límite de solicitudes por hora', async () => {
    const app = await setup(undefined, 2);
    const statuses = [];
    for (let i = 0; i < 3; i += 1) {
      statuses.push((await generate(app, { instruction: 'probar' })).statusCode);
    }
    expect(statuses).toEqual([200, 200, 429]);
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

describe('GET /api/ping', () => {
  it('responde 503 si el runner no está disponible', async () => {
    const app = await setup();
    const response = await app.inject({ method: 'GET', url: '/api/ping' });
    expect(response.statusCode).toBe(503);
    expect(response.json()).toEqual({ ok: false, message: 'runner unreachable' });
  });
});
