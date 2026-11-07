import { describe, expect, it } from 'vitest';
import { formatRunId, isTerminalEvent, toRunRecord } from './runs';

describe('formatRunId', () => {
  it('rellena el número de secuencia con ceros', () => {
    expect(formatRunId(7)).toBe('run_0007');
    expect(formatRunId(12345)).toBe('run_12345');
  });
});

describe('isTerminalEvent', () => {
  it('solo considera terminales los eventos result y error', () => {
    expect(isTerminalEvent({ type: 'step-begin', index: 0, title: 'paso' })).toBe(false);
    expect(
      isTerminalEvent({ type: 'error', error: { error: 'runner_busy', message: 'ocupado' } }),
    ).toBe(true);
  });
});

describe('toRunRecord', () => {
  const common = { sequence: 3, version: 2, title: 'Login', startedAt: 1_000, finishedAt: 9_000 };

  it('resume el resultado con los pasos superados y la duración de Playwright', () => {
    const record = toRunRecord({
      ...common,
      event: {
        type: 'result',
        result: {
          status: 'failed',
          durationMs: 6_100,
          steps: [
            { title: 'abrir', status: 'passed', durationMs: 900, error: null },
            { title: 'verificar', status: 'failed', durationMs: 5_000, error: 'no encontrado' },
          ],
          error: 'no encontrado',
          screenshot: null,
          pageSnapshot: null,
        },
      },
    });

    expect(record).toEqual({
      id: 'run_0003',
      version: 2,
      title: 'Login',
      status: 'failed',
      passedSteps: 1,
      totalSteps: 2,
      durationMs: 6_100,
      finishedAt: 9_000,
    });
  });

  it('registra un error con la duración medida en el cliente', () => {
    const record = toRunRecord({
      ...common,
      event: { type: 'error', error: { error: 'runner_busy', message: 'ocupado' } },
    });
    expect(record).toMatchObject({
      status: 'error',
      passedSteps: 0,
      totalSteps: 0,
      durationMs: 8_000,
    });
  });
});
