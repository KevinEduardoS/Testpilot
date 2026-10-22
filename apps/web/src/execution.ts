import {
  MAX_ERROR_LENGTH,
  MAX_PAGE_SNAPSHOT_LENGTH,
  MAX_STEP_TITLE_LENGTH,
  MAX_STEPS,
  type ApiError,
  type ExecutionEvent,
  type ExecutionFailure,
  type ExecutionResult,
} from '@testpilot/shared';

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

const clip = (text: string, maxLength: number) => text.slice(0, maxLength);
const clipNullable = (text: string | null, maxLength: number) =>
  text === null ? null : clip(text, maxLength);

// Evidencia de un fallo para pedir su reparación, recortada a los límites que acepta la API.
// Devuelve null si la prueba pasó: no hay nada que reparar.
export const toExecutionFailure = (result: ExecutionResult): ExecutionFailure | null => {
  if (result.status === 'passed') {
    return null;
  }
  return {
    status: result.status,
    error: clipNullable(result.error, MAX_ERROR_LENGTH),
    steps: result.steps.slice(0, MAX_STEPS).map((step) => ({
      ...step,
      title: clip(step.title, MAX_STEP_TITLE_LENGTH),
      error: clipNullable(step.error, MAX_ERROR_LENGTH),
    })),
    pageSnapshot: clipNullable(result.pageSnapshot, MAX_PAGE_SNAPSHOT_LENGTH),
  };
};
