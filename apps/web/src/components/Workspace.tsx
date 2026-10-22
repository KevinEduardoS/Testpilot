import {
  FileCode,
  Info,
  ListChecks,
  LoaderCircle,
  Play,
  ShieldCheck,
  Terminal,
  TriangleAlert,
  type LucideIcon,
} from 'lucide-react';
import { useState } from 'react';
import type { Version } from '../conversation';
import type { ExecutionState } from '../execution';
import { CodeBlock, CopyButton } from './CodeBlock';
import { ExecutionView } from './ExecutionView';

const FEATURES = [
  { icon: ShieldCheck, text: 'Cada script se valida con una política de seguridad AST' },
  { icon: ListChecks, text: 'Pasos legibles con test.step() y aserciones web-first' },
  { icon: FileCode, text: 'Selectores accesibles por rol, label o texto visible' },
];

const IdleState = ({ generating }: { generating: boolean }) => (
  <div className="flex h-full flex-col items-center justify-center px-6 py-16 text-center">
    <div className="mb-4 rounded-xl border border-white/10 bg-white/[0.03] p-3">
      {generating ? (
        <LoaderCircle className="h-6 w-6 animate-spin text-indigo-400" />
      ) : (
        <Terminal className="h-6 w-6 text-zinc-400" />
      )}
    </div>
    <h2 className="text-base font-medium text-zinc-200">
      {generating ? 'Generando la primera versión…' : 'La prueba generada aparecerá aquí'}
    </h2>
    <p className="mt-1.5 max-w-sm text-sm text-zinc-500">
      Cada respuesta crea una versión nueva del script. Desde aquí puedes revisarla y ejecutarla en
      un navegador real.
    </p>
    <ul className="mt-8 grid w-full max-w-md gap-2 text-left">
      {FEATURES.map(({ icon: Icon, text }) => (
        <li key={text} className="flex items-center gap-3 text-sm text-zinc-400">
          <Icon className="h-4 w-4 shrink-0 text-indigo-400" />
          {text}
        </li>
      ))}
    </ul>
  </div>
);

const NoteList = ({
  icon: Icon,
  title,
  items,
  tone,
}: {
  icon: LucideIcon;
  title: string;
  items: string[];
  tone: string;
}) =>
  items.length === 0 ? null : (
    <div>
      <h3 className="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-zinc-500">
        <Icon className={`h-3.5 w-3.5 ${tone}`} />
        {title}
      </h3>
      <ul className="space-y-1.5 text-sm text-zinc-400">
        {items.map((item) => (
          <li key={item} className="flex gap-2">
            <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-zinc-600" />
            {item}
          </li>
        ))}
      </ul>
    </div>
  );

type Tab = 'script' | 'steps' | 'run';

type VersionViewProps = {
  version: Version;
  execution: ExecutionState;
  // Solo una ejecución a la vez: el runner rechaza las simultáneas.
  executeDisabled: boolean;
  onExecute: () => void;
};

const VersionView = ({ version, execution, executeDisabled, onExecute }: VersionViewProps) => {
  const { test } = version;
  // Se monta con key por versión: al cambiar, abre su ejecución si la tiene o el script.
  const [tab, setTab] = useState<Tab>(execution.phase === 'idle' ? 'script' : 'run');
  const lineCount = test.script.trimEnd().split('\n').length;
  const running = execution.phase === 'running';

  const tabClass = (value: Tab) =>
    `rounded-md px-3 py-1.5 text-xs font-medium transition ${
      tab === value ? 'bg-white/[0.08] text-white' : 'text-zinc-500 hover:text-zinc-300'
    }`;

  return (
    <div className="animate-fade-in">
      <div className="flex flex-col gap-4 border-b border-white/[0.06] p-5 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-md bg-indigo-400/15 px-1.5 py-0.5 font-mono text-[11px] text-indigo-200">
              v{version.number}
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-2 py-0.5 text-[11px] font-medium text-emerald-300">
              <ShieldCheck className="h-3 w-3" />
              Validado por la política de seguridad
            </span>
          </div>
          <h2 className="mt-3 text-lg font-semibold tracking-tight text-white">{test.title}</h2>
          <p className="mt-1 text-xs text-zinc-500">
            {test.steps.length} pasos · {lineCount} líneas · Playwright + TypeScript
          </p>
        </div>
        <button
          type="button"
          disabled={running || executeDisabled}
          onClick={() => {
            setTab('run');
            onExecute();
          }}
          className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg bg-emerald-500 px-4 py-2 text-sm font-medium text-zinc-950 shadow-lg shadow-emerald-500/20 transition hover:bg-emerald-400 focus:outline-none focus-visible:ring-4 focus-visible:ring-emerald-500/30 disabled:cursor-not-allowed disabled:bg-zinc-800 disabled:text-zinc-500 disabled:shadow-none"
        >
          {running ? (
            <LoaderCircle className="h-4 w-4 animate-spin" />
          ) : (
            <Play className="h-4 w-4" />
          )}
          {running
            ? 'Ejecutando…'
            : execution.phase === 'done'
              ? 'Ejecutar de nuevo'
              : 'Ejecutar prueba'}
        </button>
      </div>

      <div className="flex items-center justify-between border-b border-white/[0.06] px-3 py-2">
        <div className="flex gap-1" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'script'}
            className={tabClass('script')}
            onClick={() => setTab('script')}
          >
            Script
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'steps'}
            className={tabClass('steps')}
            onClick={() => setTab('steps')}
          >
            Pasos
          </button>
          {execution.phase !== 'idle' && (
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'run'}
              className={tabClass('run')}
              onClick={() => setTab('run')}
            >
              Ejecución
            </button>
          )}
        </div>
        {tab === 'script' && <CopyButton text={test.script} />}
      </div>

      {tab === 'run' && <ExecutionView state={execution} />}
      {tab === 'script' && (
        <div className="bg-black/30">
          <CodeBlock code={test.script} />
        </div>
      )}
      {tab === 'steps' && (
        <ol className="space-y-3 p-5">
          {test.steps.map((step, index) => (
            <li key={`${index}-${step}`} className="flex gap-3 text-sm text-zinc-300">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] font-mono text-[11px] text-zinc-400">
                {index + 1}
              </span>
              <span className="pt-0.5">{step}</span>
            </li>
          ))}
        </ol>
      )}

      {(test.assumptions.length > 0 || test.warnings.length > 0) && (
        <div className="grid gap-5 border-t border-white/[0.06] p-5 sm:grid-cols-2">
          <NoteList icon={Info} title="Supuestos" items={test.assumptions} tone="text-sky-400" />
          <NoteList
            icon={TriangleAlert}
            title="Advertencias"
            items={test.warnings}
            tone="text-amber-400"
          />
        </div>
      )}
    </div>
  );
};

type WorkspaceProps = {
  version: Version | undefined;
  generating: boolean;
  execution: ExecutionState;
  executeDisabled: boolean;
  onExecute: () => void;
};

export const Workspace = ({
  version,
  generating,
  execution,
  executeDisabled,
  onExecute,
}: WorkspaceProps) => (
  <section className="card min-h-[520px] overflow-hidden lg:h-[calc(100vh-15rem)] lg:min-h-[560px] lg:overflow-y-auto">
    {version === undefined ? (
      <IdleState generating={generating} />
    ) : (
      <VersionView
        key={version.number}
        version={version}
        execution={execution}
        executeDisabled={executeDisabled}
        onExecute={onExecute}
      />
    )}
  </section>
);
