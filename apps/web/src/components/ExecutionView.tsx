import type { ExecutionResult } from '@testpilot/shared';
import {
  CircleAlert,
  CircleCheck,
  CircleSlash,
  CircleX,
  Clock,
  LoaderCircle,
  Timer,
  type LucideIcon,
} from 'lucide-react';
import type { ExecutionState, LiveStep } from '../execution';
import { useElapsedSeconds } from '../hooks/useElapsedSeconds';

const formatDuration = (ms: number) =>
  ms < 1000 ? `${Math.round(ms)} ms` : `${(ms / 1000).toFixed(1)} s`;

const statusBanner: Record<
  ExecutionResult['status'],
  { icon: LucideIcon; title: string; style: string }
> = {
  passed: {
    icon: CircleCheck,
    title: 'La prueba pasó',
    style: 'border-emerald-400/20 bg-emerald-400/10 text-emerald-300',
  },
  failed: {
    icon: CircleX,
    title: 'La prueba falló',
    style: 'border-rose-400/20 bg-rose-400/10 text-rose-300',
  },
  timedOut: {
    icon: Timer,
    title: 'Se agotó el tiempo de la prueba',
    style: 'border-amber-400/20 bg-amber-400/10 text-amber-300',
  },
  interrupted: {
    icon: CircleSlash,
    title: 'La ejecución se interrumpió',
    style: 'border-zinc-400/20 bg-zinc-400/10 text-zinc-300',
  },
};

const ErrorBox = ({ message }: { message: string }) => (
  <pre className="mt-2 overflow-x-auto whitespace-pre-wrap rounded-lg border border-rose-400/15 bg-rose-950/20 p-3 font-mono text-xs leading-relaxed text-rose-200/90">
    {message}
  </pre>
);

const StepIcon = ({ status }: { status: LiveStep['status'] }) => {
  switch (status) {
    case 'running':
      return <LoaderCircle className="h-4 w-4 shrink-0 animate-spin text-indigo-400" />;
    case 'passed':
      return <CircleCheck className="h-4 w-4 shrink-0 text-emerald-400" />;
    case 'failed':
      return <CircleX className="h-4 w-4 shrink-0 text-rose-400" />;
  }
};

const StepList = ({ steps }: { steps: LiveStep[] }) => (
  <ol className="space-y-2">
    {steps.map((step, index) => (
      <li key={`${index}-${step.title}`} className="animate-fade-in">
        <div className="flex items-center gap-3 text-sm">
          <StepIcon status={step.status} />
          <span className={`flex-1 ${step.status === 'running' ? 'text-white' : 'text-zinc-300'}`}>
            {step.title}
          </span>
          {step.durationMs !== null && (
            <span className="font-mono text-[11px] tabular-nums text-zinc-500">
              {formatDuration(step.durationMs)}
            </span>
          )}
        </div>
        {step.error !== null && <ErrorBox message={step.error} />}
      </li>
    ))}
  </ol>
);

const RunningView = ({ startedAt, steps }: { startedAt: number; steps: LiveStep[] }) => {
  const elapsed = useElapsedSeconds(startedAt);
  return (
    <div className="space-y-5 p-5">
      <div className="flex items-center justify-between rounded-lg border border-indigo-400/20 bg-indigo-400/10 px-4 py-3 text-indigo-200">
        <span className="flex items-center gap-2.5 text-sm font-medium">
          <LoaderCircle className="h-4 w-4 animate-spin" />
          {steps.length === 0 ? 'Abriendo el navegador…' : 'Ejecutando en Chromium…'}
        </span>
        <span className="inline-flex items-center gap-1.5 font-mono text-xs tabular-nums opacity-80">
          <Clock className="h-3.5 w-3.5" />
          {elapsed}s
        </span>
      </div>
      <StepList steps={steps} />
    </div>
  );
};

const ResultView = ({ result }: { result: ExecutionResult }) => {
  const banner = statusBanner[result.status];
  const BannerIcon = banner.icon;
  const stepHasError = result.steps.some((step) => step.error !== null);

  return (
    <div className="animate-fade-in space-y-5 p-5">
      <div
        className={`flex items-center justify-between rounded-lg border px-4 py-3 ${banner.style}`}
      >
        <span className="flex items-center gap-2.5 text-sm font-medium">
          <BannerIcon className="h-4 w-4" />
          {banner.title}
        </span>
        <span className="font-mono text-xs tabular-nums opacity-80">
          {formatDuration(result.durationMs)}
        </span>
      </div>

      {result.steps.length > 0 && <StepList steps={result.steps} />}

      {result.error !== null && !stepHasError && <ErrorBox message={result.error} />}

      {result.screenshot !== null && (
        <figure>
          <img
            src={result.screenshot}
            alt="Estado final de la página al terminar la prueba"
            className="w-full rounded-lg border border-white/10"
          />
          <figcaption className="mt-2 text-center text-xs text-zinc-500">
            Estado final de la página
          </figcaption>
        </figure>
      )}
    </div>
  );
};

export const ExecutionView = ({ state }: { state: ExecutionState }) => {
  switch (state.phase) {
    case 'idle':
      return null;
    case 'running':
      return <RunningView startedAt={state.startedAt} steps={state.steps} />;
    case 'done':
      if (state.outcome.ok) {
        return <ResultView result={state.outcome.result} />;
      }
      return (
        <div className="animate-fade-in p-5">
          <div className="flex items-center gap-2.5 text-sm font-medium text-rose-300">
            <CircleAlert className="h-4 w-4" />
            No se pudo ejecutar la prueba
          </div>
          <p className="mt-2 text-sm text-zinc-400">{state.outcome.error.message}</p>
          {state.outcome.error.details && state.outcome.error.details.length > 0 && (
            <ErrorBox message={state.outcome.error.details.join('\n')} />
          )}
        </div>
      );
  }
};
