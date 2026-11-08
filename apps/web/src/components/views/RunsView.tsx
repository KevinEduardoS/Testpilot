import { isRecordedBackend } from '../../config';
import { formatClock, formatDuration } from '../../format';
import type { RunRecord, RunStatus } from '../../runs';
import { hashForView } from '../../views';

const STATUS: Record<RunStatus, { label: string; dot: string }> = {
  passed: { label: 'passed', dot: 'bg-emerald-500' },
  failed: { label: 'failed', dot: 'bg-red-500' },
  timedOut: { label: 'timed_out', dot: 'bg-amber-500' },
  interrupted: { label: 'interrupted', dot: 'bg-neutral-500' },
  error: { label: 'error', dot: 'bg-red-500' },
};

type RunsViewProps = {
  runs: RunRecord[];
  onOpen: (version: number) => void;
};

const COLUMNS = ['ID', 'Prueba', 'Versión', 'Estado', 'Pasos', 'Duración', 'Hora'];

export const RunsView = ({ runs, onOpen }: RunsViewProps) => {
  const passed = runs.filter((run) => run.status === 'passed').length;

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-base font-semibold text-neutral-100">Ejecuciones</h1>
          <p className="mt-0.5 text-sm text-neutral-500">
            Historial de esta sesión.{' '}
            {isRecordedBackend
              ? 'Cada fila reproduce una ejecución real grabada en Chromium.'
              : 'Cada fila es una ejecución real en Chromium.'}
          </p>
        </div>
        {runs.length > 0 && (
          <p className="font-mono text-2xs text-neutral-500">
            {runs.length} total · {passed} passed · {runs.length - passed} con fallos
          </p>
        )}
      </div>

      {runs.length === 0 ? (
        <div className="mt-6 rounded-md border border-dashed border-neutral-800 px-6 py-12 text-center">
          <p className="text-sm text-neutral-300">Aún no hay ejecuciones</p>
          <p className="mt-1 text-sm text-neutral-500">
            Genera una prueba en el Playground y ejecútala para verla aquí.
          </p>
          <a href={hashForView('playground')} className="btn-secondary mt-4">
            Ir al Playground
          </a>
        </div>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-md border border-neutral-800">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="border-b border-neutral-800 bg-neutral-900/50">
              <tr>
                {COLUMNS.map((column) => (
                  <th
                    key={column}
                    scope="col"
                    className="px-3 py-2 font-mono text-2xs font-normal uppercase tracking-wider text-neutral-500"
                  >
                    {column}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-800/70">
              {runs.map((run) => {
                const status = STATUS[run.status];
                return (
                  <tr key={run.id} className="transition-colors hover:bg-neutral-900/60">
                    <td className="px-3 py-2 font-mono text-xs text-neutral-400">{run.id}</td>
                    <td className="max-w-[280px] truncate px-3 py-2 text-neutral-200">
                      <button
                        type="button"
                        onClick={() => onOpen(run.version)}
                        className="truncate text-left hover:underline"
                      >
                        {run.title}
                      </button>
                    </td>
                    <td className="px-3 py-2">
                      <span className="tag">v{run.version}</span>
                    </td>
                    <td className="px-3 py-2">
                      <span className="flex items-center gap-2 font-mono text-xs text-neutral-300">
                        <span className={`h-1.5 w-1.5 rounded-full ${status.dot}`} />
                        {status.label}
                      </span>
                    </td>
                    <td className="px-3 py-2 font-mono text-xs tabular-nums text-neutral-400">
                      {run.totalSteps === 0 ? '—' : `${run.passedSteps}/${run.totalSteps}`}
                    </td>
                    <td className="px-3 py-2 font-mono text-xs tabular-nums text-neutral-400">
                      {formatDuration(run.durationMs)}
                    </td>
                    <td className="px-3 py-2 font-mono text-xs tabular-nums text-neutral-500">
                      {formatClock(run.finishedAt)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
