import { LoaderCircle, Play } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import type { Version } from '../conversation';
import type { ExecutionState } from '../execution';
import { CodeBlock, CopyButton } from './CodeBlock';
import { ExecutionView } from './ExecutionView';

// Lo que comprueba la política antes de aceptar un script (packages/shared/src/script-policy.ts).
const POLICY_CHECKS = [
  ['import', "solo { test, expect } de '@playwright/test'"],
  ['runtime', 'sin eval, Function, require, process ni globalThis'],
  ['page', 'sin evaluate, addInitScript, route ni setContent'],
  ['goto', 'URL literal https de un dominio permitido'],
  ['estructura', 'un test(), test.step() y al menos un expect()'],
];

const IdleState = ({ generating }: { generating: boolean }) => (
  <div className="flex h-full flex-col justify-center px-6 py-14">
    <div className="mx-auto w-full max-w-md">
      <p className="flex items-center gap-2 text-sm font-medium text-neutral-200">
        {generating && <LoaderCircle className="h-3.5 w-3.5 animate-spin" />}
        {generating ? 'Generando la primera versión' : 'Ninguna prueba seleccionada'}
      </p>
      <p className="mt-1 text-sm text-neutral-500">
        Cada respuesta crea una versión del script. Antes de mostrarse, pasa por la política de
        seguridad:
      </p>
      <dl className="mt-5 divide-y divide-neutral-800 rounded-md border border-neutral-800">
        {POLICY_CHECKS.map(([rule, detail]) => (
          <div key={rule} className="grid grid-cols-[88px_minmax(0,1fr)] gap-3 px-3 py-2">
            <dt className="font-mono text-2xs text-neutral-500">{rule}</dt>
            <dd className="text-xs text-neutral-400">{detail}</dd>
          </div>
        ))}
      </dl>
    </div>
  </div>
);

const NoteList = ({ title, items }: { title: string; items: string[] }) =>
  items.length === 0 ? null : (
    <div>
      <h3 className="eyebrow mb-2">{title}</h3>
      <ul className="space-y-1.5 text-sm text-neutral-400">
        {items.map((item) => (
          <li key={item} className="flex gap-2">
            <span className="select-none font-mono text-neutral-600">–</span>
            {item}
          </li>
        ))}
      </ul>
    </div>
  );

const Meta = ({ label, children }: { label: string; children: ReactNode }) => (
  <span className="font-mono text-2xs">
    <span className="text-neutral-600">{label}</span>{' '}
    <span className="text-neutral-400">{children}</span>
  </span>
);

type Tab = 'script' | 'steps' | 'run';

type VersionViewProps = {
  version: Version;
  execution: ExecutionState;
  // Solo una ejecución a la vez: el runner rechaza las simultáneas.
  executeDisabled: boolean;
  repairDisabled: boolean;
  onExecute: () => void;
  onRepair: () => void;
};

const VersionView = ({
  version,
  execution,
  executeDisabled,
  repairDisabled,
  onExecute,
  onRepair,
}: VersionViewProps) => {
  const { test } = version;
  // Se monta con key por versión: al cambiar, abre su ejecución si la tiene o el script.
  const [tab, setTab] = useState<Tab>(execution.phase === 'idle' ? 'script' : 'run');
  const lineCount = test.script.trimEnd().split('\n').length;
  const running = execution.phase === 'running';

  const tabs: { id: Tab; label: string; visible: boolean }[] = [
    { id: 'script', label: 'Script', visible: true },
    { id: 'steps', label: `Pasos (${test.steps.length})`, visible: true },
    { id: 'run', label: 'Ejecución', visible: execution.phase !== 'idle' },
  ];

  return (
    <div className="animate-fade-in">
      <div className="flex flex-col gap-3 border-b border-neutral-800 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 font-mono text-2xs text-neutral-500">
            <span>tests</span>
            <span className="text-neutral-700">/</span>
            <span className="text-neutral-300">v{version.number}</span>
          </p>
          <h2 className="mt-0.5 truncate text-sm font-medium text-neutral-100">{test.title}</h2>
          <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5">
            <Meta label="steps">{test.steps.length}</Meta>
            <Meta label="lines">{lineCount}</Meta>
            <Meta label="policy">
              <span className="text-emerald-500">passed</span>
            </Meta>
            {version.repairedFrom !== null && (
              <Meta label="repaired_from">v{version.repairedFrom}</Meta>
            )}
          </div>
        </div>
        <button
          type="button"
          disabled={running || executeDisabled}
          onClick={() => {
            setTab('run');
            onExecute();
          }}
          className="btn-primary"
        >
          {running ? (
            <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Play className="h-3.5 w-3.5" />
          )}
          {running ? 'Ejecutando' : execution.phase === 'done' ? 'Volver a ejecutar' : 'Ejecutar'}
        </button>
      </div>

      <div className="flex items-center justify-between border-b border-neutral-800 px-4">
        <div className="-mb-px flex gap-5" role="tablist">
          {tabs
            .filter(({ visible }) => visible)
            .map(({ id, label }) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={tab === id}
                onClick={() => setTab(id)}
                className={`border-b-2 py-2.5 text-xs font-medium transition-colors ${
                  tab === id
                    ? 'border-neutral-100 text-neutral-100'
                    : 'border-transparent text-neutral-500 hover:text-neutral-300'
                }`}
              >
                {label}
              </button>
            ))}
        </div>
        {tab === 'script' && <CopyButton text={test.script} />}
      </div>

      {tab === 'run' && (
        <ExecutionView state={execution} repairDisabled={repairDisabled} onRepair={onRepair} />
      )}
      {tab === 'script' && (
        <div className="flex items-center justify-between border-b border-neutral-800/60 px-4 py-1.5">
          <span className="font-mono text-2xs text-neutral-500">generated.spec.ts</span>
          <span className="font-mono text-2xs text-neutral-600">TypeScript · Playwright</span>
        </div>
      )}
      {tab === 'script' && <CodeBlock code={test.script} />}
      {tab === 'steps' && (
        <ol className="divide-y divide-neutral-800/70">
          {test.steps.map((step, index) => (
            <li
              key={`${index}-${step}`}
              className="flex gap-3 px-4 py-2.5 text-sm text-neutral-300"
            >
              <span className="w-5 font-mono text-2xs tabular-nums leading-5 text-neutral-600">
                {String(index + 1).padStart(2, '0')}
              </span>
              {step}
            </li>
          ))}
        </ol>
      )}

      {(test.assumptions.length > 0 || test.warnings.length > 0) && (
        <div className="grid gap-5 border-t border-neutral-800 p-4 sm:grid-cols-2">
          <NoteList title="Supuestos" items={test.assumptions} />
          <NoteList title="Advertencias" items={test.warnings} />
        </div>
      )}
    </div>
  );
};

type WorkspaceProps = Omit<VersionViewProps, 'version'> & {
  version: Version | undefined;
  generating: boolean;
};

export const Workspace = ({ version, generating, ...viewProps }: WorkspaceProps) => (
  <section className="panel min-h-[480px] overflow-hidden lg:h-[calc(100vh-9.5rem)] lg:min-h-[540px] lg:overflow-y-auto">
    {version === undefined ? (
      <IdleState generating={generating} />
    ) : (
      <VersionView key={version.number} version={version} {...viewProps} />
    )}
  </section>
);
