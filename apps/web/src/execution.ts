import type { ApiError, ExecutionEvent, ExecutionResult } from '@testpilot/shared';

export type LiveStep = {
  title: string;
  status: 'running' | 'passed' | 'failed';
  durationMs: number | null;
  error: string | null;
};

export type ExecutionState =
  | { phase: 'idle' }
  | { phase: 'running'; startedAt: number; steps: LiveStep[] }
  | {
      phase: 'done';
      outcome: { ok: true; result: ExecutionResult } | { ok: false; error: ApiError };
    };

export const startExecution = (startedAt: number): ExecutionState => ({
  phase: 'running',
  startedAt,
  steps: [],
});

const withStep = (steps: LiveStep[], index: number, step: LiveStep): LiveStep[] => {
  const next = [...steps];
  next[index] = step;
  return next;
};

export const applyExecutionEvent = (
  state: ExecutionState,
  event: ExecutionEvent,
): ExecutionState => {
  switch (event.type) {
    case 'result':
      return { phase: 'done', outcome: { ok: true, result: event.result } };
    case 'error':
      return { phase: 'done', outcome: { ok: false, error: event.error } };
    case 'step-begin':
      if (state.phase !== 'running') {
        return state;
      }
      return {
        ...state,
        steps: withStep(state.steps, event.index, {
          title: event.title,
          status: 'running',
          durationMs: null,
          error: null,
        }),
      };
    case 'step-end':
      if (state.phase !== 'running') {
        return state;
      }
      return {
        ...state,
        steps: withStep(state.steps, event.index, {
          title: event.step.title,
          status: event.step.status,
          durationMs: event.step.durationMs,
          error: event.step.error,
        }),
      };
  }
};
