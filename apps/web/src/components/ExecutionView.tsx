import type { ExecutionResult } from '@testpilot/shared';
import { Check, ChevronRight, LoaderCircle, Minus, Wrench, X } from 'lucide-react';
import type { ReactNode } from 'react';
import { isRecordedBackend } from '../config';
import type { ExecutionState, LiveStep } from '../execution';
import { formatDuration } from '../format';
import { useElapsedSeconds } from '../hooks/useElapsedSeconds';

const STATUS: Record<ExecutionResult['status'], { label: string; dot: string; text: string }> = {
  passed: { label: 'Pasó', dot: 'bg-emerald-500', text: 'text-emerald-400' },
  failed: { label: 'Falló', dot: 'bg-red-500', text: 'text-red-400' },
  timedOut: { label: 'Tiempo agotado', dot: 'bg-amber-500', text: 'text-amber-400' },
  interrupted: { label: 'Interrumpida', dot: 'bg-neutral-500', text: 'text-neutral-400' },
};

const ErrorLog = ({ message }: { message: string }) => (
  <pre className="mt-2 overflow-x-auto whitespace-pre-wrap border-l-2 border-red-500/60 bg-neutral-950 py-2 pl-3 pr-2 font-mono text-2xs leading-5 text-neutral-300">
    {message}
  </pre>
);

const StepIcon = ({ status }: { status: LiveStep['status'] }) => {
  switch (status) {
    case 'running':
      return <LoaderCircle className="h-3.5 w-3.5 animate-spin text-neutral-300" />;
    case 'passed':
      return <Check className="h-3.5 w-3.5 text-emerald-500" strokeWidth={2.5} />;
    case 'failed':
      return <X className="h-3.5 w-3.5 text-red-500" strokeWidth={2.5} />;
  }
};

const StepLog = ({ steps }: { steps: LiveStep[] }) => (
  <ol className="divide-y divide-neutral-800/70 rounded-md border border-neutral-800">
    {steps.map((step, index) => (
      <li key={`${index}-${step.title}`} className="animate-fade-in px-3 py-2">
        <div className="flex items-center gap-3 text-sm">
          <span className="w-5 font-mono text-2xs tabular-nums text-neutral-600">
            {String(index + 1).padStart(2, '0')}
          </span>
          <StepIcon status={step.status} />
          <span
            className={`flex-1 ${step.status === 'running' ? 'text-neutral-100' : 'text-neutral-300'}`}
          >
            {step.title}
          </span>
          <span className="font-mono text-2xs tabular-nums text-neutral-500">
            {step.durationMs === null ? '…' : formatDuration(step.durationMs)}
          </span>
        </div>
        {step.error !== null && <ErrorLog message={step.error} />}
      </li>
    ))}
  </ol>
);

const SummaryBar = ({ children }: { children: ReactNode }) => (
  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">{children}</div>
);

const RunningView = ({ startedAt, steps }: { startedAt: number; steps: LiveStep[] }) => {
  const elapsed = useElapsedSeconds(startedAt);
  return (
    <div className="space-y-4 p-4">
      <SummaryBar>
        <span className="flex items-center gap-2 font-medium text-neutral-100">
          <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
          {steps.length === 0 ? 'Iniciando Chromium' : 'En ejecución'}
        </span>
        <span className="font-mono text-2xs tabular-nums text-neutral-500">{elapsed}s</span>
      </SummaryBar>
      {steps.length > 0 && <StepLog steps={steps} />}
    </div>
  );
};

type RepairProps = { repairDisabled: boolean; onRepair: () => void };

const RepairPrompt = ({ repairDisabled, onRepair }: RepairProps) => (
  <div className="flex flex-col gap-3 rounded-md border border-neutral-800 bg-neutral-950 p-3 sm:flex-row sm:items-center sm:justify-between">
    <p className="text-sm leading-relaxed text-neutral-400">
      Analiza el error y el árbol de accesibilidad para corregir la prueba o, si el fallo es del
      sitio, redactar el reporte del bug.
    </p>
    <button type="button" disabled={repairDisabled} onClick={onRepair} className="btn-secondary">
      <Wrench className="h-3.5 w-3.5" />
      Diagnosticar y reparar
    </button>
  </div>
);

const PageSnapshot = ({ snapshot }: { snapshot: string }) => (
  <details className="group rounded-md border border-neutral-800">
    <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-2 text-xs text-neutral-400 transition-colors hover:text-neutral-200">
      <ChevronRight className="h-3.5 w-3.5 transition-transform group-open:rotate-90" />
      <span className="font-mono">aria-snapshot</span>
      <span className="text-neutral-600">· estado de la página al fallar</span>
      <span className="ml-auto font-mono text-2xs text-neutral-600">
        {snapshot.length.toLocaleString('es-CO')} car.
      </span>
    </summary>
    <pre className="max-h-72 overflow-auto border-t border-neutral-800 p-3 font-mono text-2xs leading-5 text-neutral-400">
      {snapshot}
    </pre>
  </details>
);

const ResultView = ({ result, ...repair }: RepairProps & { result: ExecutionResult }) => {
  const status = STATUS[result.status];
  const stepHasError = result.steps.some((step) => step.error !== null);
  const passed = result.steps.filter((step) => step.status === 'passed').length;

  return (
    <div className="animate-fade-in space-y-4 p-4">
      <SummaryBar>
        <span className={`flex items-center gap-2 font-medium ${status.text}`}>
          <span className={`h-2 w-2 rounded-full ${status.dot}`} />
          {status.label}
        </span>
        <span className="font-mono text-2xs tabular-nums text-neutral-500">
          {formatDuration(result.durationMs)}
        </span>
        {result.steps.length > 0 && (
          <span className="font-mono text-2xs tabular-nums text-neutral-500">
            {passed}/{result.steps.length} pasos
          </span>
        )}
        <span className="ml-auto font-mono text-2xs text-neutral-600">
          {isRecordedBackend ? 'grabación · chromium' : 'chromium · headless'}
        </span>
      </SummaryBar>

      {result.steps.length > 0 && <StepLog steps={result.steps} />}

      {result.error !== null && !stepHasError && <ErrorLog message={result.error} />}

      {result.status !== 'passed' && <RepairPrompt {...repair} />}

      {result.pageSnapshot !== null && <PageSnapshot snapshot={result.pageSnapshot} />}

      {result.screenshot !== null && (
        <figure className="overflow-hidden rounded-md border border-neutral-800">
          <figcaption className="flex items-center justify-between border-b border-neutral-800 px-3 py-1.5">
            <span className="font-mono text-2xs text-neutral-500">screenshot.png</span>
            <span className="text-2xs text-neutral-600">estado final de la página</span>
          </figcaption>
          <img
            src={result.screenshot}
            alt="Estado final de la página al terminar la prueba"
            className="w-full"
          />
        </figure>
      )}
    </div>
  );
};

export const ExecutionView = ({ state, ...repair }: RepairProps & { state: ExecutionState }) => {
  switch (state.phase) {
    case 'idle':
      return null;
    case 'running':
      return <RunningView startedAt={state.startedAt} steps={state.steps} />;
    case 'done':
      if (state.outcome.ok) {
        return <ResultView result={state.outcome.result} {...repair} />;
      }
      return (
        <div className="animate-fade-in space-y-3 p-4">
          <SummaryBar>
            <span className="flex items-center gap-2 font-medium text-red-400">
              <Minus className="h-3.5 w-3.5" />
              No se pudo ejecutar
            </span>
            <span className="tag">{state.outcome.error.error}</span>
          </SummaryBar>
          <p className="text-sm text-neutral-400">{state.outcome.error.message}</p>
          {state.outcome.error.details && state.outcome.error.details.length > 0 && (
            <ErrorLog message={state.outcome.error.details.join('\n')} />
          )}
        </div>
      );
  }
};
