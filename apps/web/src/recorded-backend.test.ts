import type { ExecutionEvent } from '@testpilot/shared';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { recordedExecution, recordedGenerate, recordedRepair, wait } from './recorded-backend';
import type { Recording } from './recording';

const SCRIPT = "import { test, expect } from '@playwright/test';";

const recording: Recording = {
  recordedAt: '2026-11-07T00:00:00.000Z',
  generations: [
    {
      instruction: 'Probar el login',
      durationMs: 0,
      response: {
        status: 'ok',
        test: { title: 'Login', steps: ['abrir'], script: SCRIPT, assumptions: [], warnings: [] },
      },
    },
  ],
  repairs: [
    {
      script: SCRIPT,
      durationMs: 0,
      response: {
        status: 'bug_report',
        diagnosis: { category: 'app_bug', summary: 'el sitio falla' },
        report: {
          title: 'Bug',
          severity: 'medium',
          stepsToReproduce: ['abrir'],
          expected: 'a',
          actual: 'b',
        },
      },
    },
  ],
  executions: [
    {
      script: SCRIPT,
      events: [
        { atMs: 0, event: { type: 'step-begin', index: 0, title: 'abrir' } },
        {
          atMs: 5,
          event: {
            type: 'step-end',
            index: 0,
            step: { title: 'abrir', status: 'passed', durationMs: 5, error: null },
          },
        },
        {
          atMs: 10,
          event: {
            type: 'result',
            result: {
              status: 'passed',
              durationMs: 10,
              steps: [{ title: 'abrir', status: 'passed', durationMs: 5, error: null }],
              error: null,
              screenshot: '/recordings/screenshot-1.png',
              pageSnapshot: null,
            },
          },
        },
      ],
    },
  ],
};

beforeAll(() => {
  vi.stubGlobal('fetch', async () => new Response(JSON.stringify(recording)));
});

afterAll(() => {
  vi.unstubAllGlobals();
});

describe('recordedGenerate', () => {
  it('responde la instrucción grabada aunque cambien mayúsculas y espacios', async () => {
    const result = await recordedGenerate({ instruction: '  probar   el LOGIN ' });
    expect(result).toMatchObject({ ok: true, data: { status: 'ok', test: { title: 'Login' } } });
  });

  it('indica que solo hay ejemplos cuando la instrucción no está grabada', async () => {
    const result = await recordedGenerate({ instruction: 'otra cosa' });
    expect(result).toMatchObject({ ok: false, error: { error: 'not_recorded' } });
  });
});

describe('recordedRepair', () => {
  it('responde la reparación grabada del script', async () => {
    const result = await recordedRepair({
      instructions: ['Probar el login'],
      script: SCRIPT,
      failure: { status: 'failed', error: null, steps: [], pageSnapshot: null },
    });
    expect(result).toMatchObject({ ok: true, data: { status: 'bug_report' } });
  });
});

describe('recordedExecution', () => {
  it('reproduce los eventos en orden y termina con el resultado', async () => {
    const events: ExecutionEvent[] = [];
    await recordedExecution({ script: SCRIPT }, (event) => events.push(event));
    expect(events.map((event) => event.type)).toEqual(['step-begin', 'step-end', 'result']);
  });

  it('termina con un error si el script no está grabado', async () => {
    const events: ExecutionEvent[] = [];
    await recordedExecution({ script: 'otro' }, (event) => events.push(event));
    expect(events).toEqual([
      { type: 'error', error: expect.objectContaining({ error: 'not_recorded' }) },
    ]);
  });

  it('se detiene al abortar', async () => {
    const abort = new AbortController();
    abort.abort();
    const events: ExecutionEvent[] = [];
    await recordedExecution({ script: SCRIPT }, (event) => events.push(event), abort.signal);
    expect(events).toEqual([]);
  });
});

describe('wait', () => {
  it('resuelve false si se aborta durante la espera', async () => {
    const abort = new AbortController();
    const pending = wait(10_000, abort.signal);
    abort.abort();
    await expect(pending).resolves.toBe(false);
  });
});
