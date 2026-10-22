import Anthropic from '@anthropic-ai/sdk';
import pino from 'pino';
import type { GenerateTestRequest } from '@testpilot/shared';
import { describe, expect, it } from 'vitest';
import { HttpError } from './errors.js';
import { createTestGenerator } from './test-generator.js';

const validScript = `import { test, expect } from '@playwright/test';

test('login inválido', async ({ page }) => {
  await test.step('abrir login', async () => {
    await page.goto('https://www.saucedemo.com');
  });
  await test.step('verificar error', async () => {
    await page.getByRole('button', { name: 'Login' }).click();
    await expect(page.locator('[data-test="error"]')).toBeVisible();
  });
});
`;

const modelOutput = (overrides: Record<string, unknown> = {}) => ({
  status: 'ok',
  title: 'Login inválido',
  steps: ['abrir login', 'verificar error'],
  script: validScript,
  assumptions: [],
  warnings: [],
  clarifying_question: null,
  rejection_reason: null,
  ...overrides,
});

const apiMessage = (text: string, stopReason = 'end_turn') => ({
  id: 'msg_test',
  type: 'message',
  role: 'assistant',
  model: 'claude-opus-5-5',
  content: text === '' ? [] : [{ type: 'text', text }],
  stop_reason: stopReason,
  stop_sequence: null,
  usage: { input_tokens: 10, output_tokens: 20 },
});

type CapturedRequest = { headers: Headers; body: Record<string, unknown> };

const setup = (status: number, payload: unknown) => {
  const captured: CapturedRequest[] = [];
  const client = new Anthropic({
    apiKey: 'test-key',
    maxRetries: 0,
    fetch: async (_url, init) => {
      captured.push({
        headers: new Headers(init?.headers),
        body: JSON.parse(String(init?.body)) as Record<string, unknown>,
      });
      return new Response(JSON.stringify(payload), {
        status,
        headers: { 'content-type': 'application/json' },
      });
    },
  });
  const generate = createTestGenerator({
    client,
    systemPrompt: 'prompt de sistema',
    model: 'claude-opus-5-5',
    effort: 'medium',
    maxTokens: 16_000,
    allowedDomains: ['saucedemo.com'],
  });
  const logger = pino({ level: 'silent' });
  return {
    captured,
    run: (request: GenerateTestRequest = { instruction: 'probar login inválido' }) =>
      generate(request, logger),
  };
};

const errorBody = (type: string) => ({ type: 'error', error: { type, message: 'fallo' } });

const expectHttpError = async (promise: Promise<unknown>, statusCode: number, code: string) => {
  const error = await promise.catch((caught: unknown) => caught);
  expect(error).toBeInstanceOf(HttpError);
  expect(error).toMatchObject({ statusCode, code });
};

describe('createTestGenerator', () => {
  it('devuelve la prueba cuando el script cumple la política', async () => {
    const { run } = setup(200, apiMessage(JSON.stringify(modelOutput())));
    await expect(run()).resolves.toEqual({
      status: 'ok',
      test: {
        title: 'Login inválido',
        steps: ['abrir login', 'verificar error'],
        script: validScript,
        assumptions: [],
        warnings: [],
      },
    });
  });

  it('envía modelo, fallbacks, caché del prompt e instrucción delimitada', async () => {
    const { captured, run } = setup(200, apiMessage(JSON.stringify(modelOutput())));
    await run();

    const [request] = captured;
    expect(request?.headers.get('anthropic-beta')).toContain('server-side-fallback-2026-07-01');
    expect(request?.body).toMatchObject({
      model: 'claude-opus-5-5',
      max_tokens: 16_000,
      fallbacks: 'default',
      output_config: { effort: 'medium', format: { type: 'json_schema' } },
      system: [{ type: 'text', text: 'prompt de sistema', cache_control: { type: 'ephemeral' } }],
      messages: [
        {
          role: 'user',
          content: expect.stringContaining(
            '<instruccion_usuario>\nprobar login inválido\n</instruccion_usuario>',
          ),
        },
      ],
    });
  });

  it('incluye el contexto de conversación al refinar una prueba', async () => {
    const { captured, run } = setup(200, apiMessage(JSON.stringify(modelOutput())));
    await run({
      instruction: 'verifica también el título',
      context: { previousInstructions: ['probar login inválido'], currentScript: validScript },
    });

    const content = (captured[0]?.body.messages as { content: string }[])[0]?.content ?? '';
    expect(content).toContain(
      '<instrucciones_anteriores>\n1. probar login inválido\n</instrucciones_anteriores>',
    );
    expect(content).toContain(`<script_actual>\n${validScript}\n</script_actual>`);
    expect(content.indexOf('<script_actual>')).toBeLessThan(
      content.indexOf('<instruccion_usuario>'),
    );
  });

  it('indica al modelo los dominios permitidos', async () => {
    const { captured, run } = setup(200, apiMessage(JSON.stringify(modelOutput())));
    await run();
    const content = (captured[0]?.body.messages as { content: string }[])[0]?.content ?? '';
    expect(content).toMatch(
      /^Dominios permitidos: saucedemo\.com y sus subdominios\. Cualquier otro está bloqueado\.\n/,
    );
  });

  it('rechaza con 502 un script que navega fuera de los dominios permitidos', async () => {
    const offsite = validScript.replace('https://www.saucedemo.com', 'https://example.com');
    const { run } = setup(200, apiMessage(JSON.stringify(modelOutput({ script: offsite }))));
    await expectHttpError(run(), 502, 'unsafe_script');
  });

  it('rechaza con 502 un script que viola la política', async () => {
    const unsafe = validScript.replace('await page.goto', "eval('x'); await page.goto");
    const { run } = setup(200, apiMessage(JSON.stringify(modelOutput({ script: unsafe }))));
    const error = await run().catch((caught: unknown) => caught);
    expect(error).toMatchObject({ statusCode: 502, code: 'unsafe_script' });
    expect((error as HttpError).details).toEqual([expect.stringContaining('"eval"')]);
  });

  it('devuelve la pregunta de aclaración', async () => {
    const output = modelOutput({
      status: 'needs_clarification',
      script: '',
      clarifying_question: '¿Qué sitio?',
    });
    const { run } = setup(200, apiMessage(JSON.stringify(output)));
    await expect(run()).resolves.toEqual({
      status: 'needs_clarification',
      question: '¿Qué sitio?',
    });
  });

  it('falla si pide aclaración sin pregunta', async () => {
    const output = modelOutput({ status: 'needs_clarification', script: '' });
    const { run } = setup(200, apiMessage(JSON.stringify(output)));
    await expectHttpError(run(), 502, 'invalid_model_output');
  });

  it('devuelve el motivo del rechazo', async () => {
    const output = modelOutput({
      status: 'rejected',
      script: '',
      rejection_reason: 'Es fuerza bruta.',
    });
    const { run } = setup(200, apiMessage(JSON.stringify(output)));
    await expect(run()).resolves.toEqual({ status: 'rejected', reason: 'Es fuerza bruta.' });
  });

  it('convierte un rechazo de seguridad del modelo en status rejected', async () => {
    const { run } = setup(200, apiMessage('', 'refusal'));
    await expect(run()).resolves.toMatchObject({ status: 'rejected' });
  });

  it('falla si la respuesta quedó truncada', async () => {
    const { run } = setup(200, apiMessage('{"status": "ok", "tit', 'max_tokens'));
    await expectHttpError(run(), 502, 'truncated_output');
  });

  it.each([
    ['JSON inválido', 'no es json'],
    ['forma incorrecta', JSON.stringify({ status: 'ok' })],
  ])('falla con %s', async (_name, text) => {
    const { run } = setup(200, apiMessage(text));
    await expectHttpError(run(), 502, 'invalid_model_output');
  });

  it.each([
    [429, 'rate_limit_error', 503, 'ai_rate_limited'],
    [401, 'authentication_error', 500, 'ai_misconfigured'],
    [529, 'overloaded_error', 502, 'ai_error'],
  ])('traduce el error HTTP %i de la API', async (status, type, statusCode, code) => {
    const { run } = setup(status, errorBody(type));
    await expectHttpError(run(), statusCode, code);
  });
});
