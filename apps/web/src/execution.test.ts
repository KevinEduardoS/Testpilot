import type { ExecutionEvent, ExecutionResult } from '@testpilot/shared';
import { describe, expect, it } from 'vitest';
import { applyExecutionEvent, startExecution, type ExecutionState } from './execution';

const passed: ExecutionResult = {
  status: 'passed',
  durationMs: 10,
  steps: [],
  error: null,
  screenshot: null,
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
