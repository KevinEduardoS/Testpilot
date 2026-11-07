import type { ExecutionEvent, ExecutionResult } from '@testpilot/shared';

// Registro de una ejecución terminada, para el historial de la sesión.
export type RunStatus = ExecutionResult['status'] | 'error';

export type RunRecord = {
  id: string;
  version: number;
  title: string;
  status: RunStatus;
  passedSteps: number;
  totalSteps: number;
  // Duración que informa Playwright; si la ejecución no llegó a correr, la medida en el cliente.
  durationMs: number;
  finishedAt: number;
};

export const formatRunId = (sequence: number): string => `run_${String(sequence).padStart(4, '0')}`;

type TerminalEvent = Extract<ExecutionEvent, { type: 'result' | 'error' }>;

export const isTerminalEvent = (event: ExecutionEvent): event is TerminalEvent =>
  event.type === 'result' || event.type === 'error';

export const toRunRecord = ({
  sequence,
  version,
  title,
  startedAt,
  finishedAt,
  event,
}: {
  sequence: number;
  version: number;
  title: string;
  startedAt: number;
  finishedAt: number;
  event: TerminalEvent;
}): RunRecord => {
  const base = { id: formatRunId(sequence), version, title, finishedAt };
  if (event.type === 'error') {
    return {
      ...base,
      status: 'error',
      passedSteps: 0,
      totalSteps: 0,
      durationMs: finishedAt - startedAt,
    };
  }
  const { result } = event;
  return {
    ...base,
    status: result.status,
    passedSteps: result.steps.filter((step) => step.status === 'passed').length,
    totalSteps: result.steps.length,
    durationMs: result.durationMs,
  };
};
