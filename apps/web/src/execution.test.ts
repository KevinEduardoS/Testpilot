import {
  MAX_ERROR_LENGTH,
  MAX_PAGE_SNAPSHOT_LENGTH,
  executionFailureSchema,
  type ExecutionEvent,
  type ExecutionResult,
} from '@testpilot/shared';
import { describe, expect, it } from 'vitest';
import {
  applyExecutionEvent,
  startExecution,
  toExecutionFailure,
  type ExecutionState,
} from './execution';

const passed: ExecutionResult = {
  status: 'passed',
  durationMs: 10,
  steps: [],
  error: null,
  screenshot: null,
  pageSnapshot: null,
};

const apply = (events: ExecutionEvent[], initial: ExecutionState = startExecution(0)) =>
  events.reduce(applyExecutionEvent, initial);

describe('applyExecutionEvent', () => {
  it('marca un paso en curso y luego su resultado', () => {
    const running = apply([{ type: 'step-begin', index: 0, title: 'abrir' }]);
    expect(running).toMatchObject({ steps: [{ title: 'abrir', status: 'running' }] });

    const ended = apply(
      [
        {
          type: 'step-end',
          index: 0,
          step: { title: 'abrir', status: 'failed', durationMs: 5, error: 'x' },
        },
      ],
      running,
    );
    expect(ended).toMatchObject({
      steps: [{ title: 'abrir', status: 'failed', durationMs: 5, error: 'x' }],
    });
  });

  it('termina con el resultado o el error', () => {
    expect(apply([{ type: 'result', result: passed }])).toEqual({
      phase: 'done',
      outcome: { ok: true, result: passed },
    });
    expect(apply([{ type: 'error', error: { error: 'e', message: 'm' } }])).toEqual({
      phase: 'done',
      outcome: { ok: false, error: { error: 'e', message: 'm' } },
    });
  });

  it('ignora eventos de paso tardíos tras terminar', () => {
    const done = apply([{ type: 'result', result: passed }]);
    expect(apply([{ type: 'step-begin', index: 0, title: 'tarde' }], done)).toBe(done);
  });
});

describe('toExecutionFailure', () => {
  it('no devuelve nada si la prueba pasó', () => {
    expect(toExecutionFailure(passed)).toBeNull();
  });

  it('recorta la evidencia a los límites que acepta la API', () => {
    const failure = toExecutionFailure({
      ...passed,
      status: 'failed',
      error: 'e'.repeat(MAX_ERROR_LENGTH + 10),
      steps: [{ title: 'paso', status: 'failed', durationMs: 5, error: 'falló' }],
      screenshot: 'data:image/png;base64,AAAA',
      pageSnapshot: 's'.repeat(MAX_PAGE_SNAPSHOT_LENGTH + 10),
    });

    expect(executionFailureSchema.safeParse(failure).success).toBe(true);
    expect(failure).not.toHaveProperty('screenshot');
    expect(failure?.steps).toEqual([
      { title: 'paso', status: 'failed', durationMs: 5, error: 'falló' },
    ]);
  });
});
