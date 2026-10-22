import type { GeneratedTest } from '@testpilot/shared';
import {
  Ban,
  CircleAlert,
  CircleQuestionMark,
  Clock,
  FileCode,
  Info,
  ListChecks,
  LoaderCircle,
  ShieldCheck,
  Terminal,
  TriangleAlert,
  type LucideIcon,
} from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import type { GenerateResult } from '../api';
import { CodeBlock, CopyButton } from './CodeBlock';

export type GenerationState =
  | { phase: 'idle' }
  | { phase: 'loading'; startedAt: number }
  | { phase: 'done'; result: GenerateResult };

const FEATURES = [
  { icon: ShieldCheck, text: 'Cada script se valida con una política de seguridad AST' },
  { icon: ListChecks, text: 'Pasos legibles con test.step() y aserciones web-first' },
  { icon: FileCode, text: 'Selectores accesibles por rol, label o texto visible' },
];

const IdleState = () => (
  <div className="flex h-full flex-col items-center justify-center px-6 py-16 text-center">
    <div className="mb-4 rounded-xl border border-white/10 bg-white/[0.03] p-3">
      <Terminal className="h-6 w-6 text-zinc-400" />
    </div>
    <h2 className="text-base font-medium text-zinc-200">La prueba generada aparecerá aquí</h2>
    <p className="mt-1.5 max-w-sm text-sm text-zinc-500">
      Describe un caso de prueba o elige un ejemplo. Claude escribirá un script Playwright listo
      para ejecutar.
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

const useElapsedSeconds = (startedAt: number) => {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, []);
  return Math.max(0, Math.floor((now - startedAt) / 1000));
};

const LoadingState = ({ startedAt }: { startedAt: number }) => {
  const elapsed = useElapsedSeconds(startedAt);
  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-2.5 text-sm text-zinc-300">
          <LoaderCircle className="h-4 w-4 animate-spin text-indigo-400" />
          Generando la prueba con Claude…
        </div>
        <span className="inline-flex items-center gap-1.5 font-mono text-xs tabular-nums text-zinc-500">
          <Clock className="h-3.5 w-3.5" />
          {elapsed}s
        </span>
      </div>
      <div className="space-y-3" aria-hidden="true">
        {[72, 88, 54, 80, 64, 92, 46].map((width, index) => (
          <div
            key={index}
            className="h-3 animate-pulse rounded bg-white/[0.05]"
            style={{ width: `${width}%`, animationDelay: `${index * 80}ms` }}
          />
        ))}
      </div>
    </div>
  );
};

type MessageTone = 'info' | 'danger';

const toneStyles: Record<MessageTone, { icon: string; ring: string }> = {
  info: { icon: 'text-sky-400', ring: 'border-sky-400/20 bg-sky-400/10' },
  danger: { icon: 'text-rose-400', ring: 'border-rose-400/20 bg-rose-400/10' },
};

const MessageState = ({
  icon: Icon,
  tone,
  title,
  children,
}: {
  icon: LucideIcon;
  tone: MessageTone;
  title: string;
  children: ReactNode;
}) => (
  <div className="flex h-full flex-col items-center justify-center px-6 py-16 text-center">
    <div className={`mb-4 rounded-xl border p-3 ${toneStyles[tone].ring}`}>
      <Icon className={`h-6 w-6 ${toneStyles[tone].icon}`} />
    </div>
    <h2 className="text-base font-medium text-zinc-100">{title}</h2>
    <div className="mt-2 max-w-md text-sm leading-relaxed text-zinc-400">{children}</div>
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

type Tab = 'script' | 'steps';

const TestResult = ({ test }: { test: GeneratedTest }) => {
  const [tab, setTab] = useState<Tab>('script');
  const lineCount = test.script.trimEnd().split('\n').length;

  const tabClass = (value: Tab) =>
    `rounded-md px-3 py-1.5 text-xs font-medium transition ${
      tab === value ? 'bg-white/[0.08] text-white' : 'text-zinc-500 hover:text-zinc-300'
    }`;

  return (
    <div className="animate-fade-in">
      <div className="border-b border-white/[0.06] p-5">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-2 py-0.5 text-[11px] font-medium text-emerald-300">
          <ShieldCheck className="h-3 w-3" />
          Validado por la política de seguridad
        </span>
        <h2 className="mt-3 text-lg font-semibold tracking-tight text-white">{test.title}</h2>
        <p className="mt-1 text-xs text-zinc-500">
          {test.steps.length} pasos · {lineCount} líneas · Playwright + TypeScript
        </p>
      </div>

      <div className="flex items-center justify-between border-b border-white/[0.06] px-3 py-2">
        <div className="flex gap-1" role="tablist">
          <button type="button" role="tab" aria-selected={tab === 'script'} className={tabClass('script')} onClick={() => setTab('script')}>
            Script
          </button>
          <button type="button" role="tab" aria-selected={tab === 'steps'} className={tabClass('steps')} onClick={() => setTab('steps')}>
            Pasos
          </button>
        </div>
        {tab === 'script' && <CopyButton text={test.script} />}
      </div>

      {tab === 'script' ? (
        <div className="bg-black/30">
          <CodeBlock code={test.script} />
        </div>
      ) : (
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
          <NoteList icon={TriangleAlert} title="Advertencias" items={test.warnings} tone="text-amber-400" />
        </div>
      )}
    </div>
  );
};

const DoneState = ({ result }: { result: GenerateResult }) => {
  if (!result.ok) {
    return (
      <MessageState icon={CircleAlert} tone="danger" title="No se pudo generar la prueba">
        <p>{result.error.message}</p>
        {result.error.details && result.error.details.length > 0 && (
          <ul className="mt-4 space-y-1 rounded-lg border border-white/[0.06] bg-black/30 p-3 text-left font-mono text-xs text-zinc-400">
            {result.error.details.map((detail) => (
              <li key={detail}>{detail}</li>
            ))}
          </ul>
        )}
        <code className="mt-4 inline-block rounded bg-white/5 px-1.5 py-0.5 font-mono text-[11px] text-zinc-500">
          {result.error.error}
        </code>
      </MessageState>
    );
  }

  switch (result.data.status) {
    case 'ok':
      return <TestResult test={result.data.test} />;
    case 'needs_clarification':
      return (
        <MessageState icon={CircleQuestionMark} tone="info" title="Se necesita más información">
          <blockquote className="rounded-lg border border-white/[0.06] bg-black/20 px-4 py-3 text-zinc-200">
            {result.data.question}
          </blockquote>
          <p className="mt-3 text-xs text-zinc-500">
            Añade el dato a la instrucción y vuelve a generar.
          </p>
        </MessageState>
      );
    case 'rejected':
      return (
        <MessageState icon={Ban} tone="danger" title="Solicitud rechazada">
          <p>{result.data.reason}</p>
        </MessageState>
      );
  }
};

export const ResultPanel = ({ state }: { state: GenerationState }) => (
  <section className="card min-h-[520px] overflow-hidden" aria-live="polite">
    {state.phase === 'idle' && <IdleState />}
    {state.phase === 'loading' && <LoadingState startedAt={state.startedAt} />}
    {state.phase === 'done' && <DoneState result={state.result} />}
  </section>
);
