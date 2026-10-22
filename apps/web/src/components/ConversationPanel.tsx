import { EXAMPLES, MAX_INSTRUCTION_LENGTH, type ApiError } from '@testpilot/shared';
import {
  ArrowUp,
  Ban,
  CircleAlert,
  CircleQuestionMark,
  FlaskConical,
  Globe,
  LoaderCircle,
  RotateCcw,
  Wrench,
  type LucideIcon,
} from 'lucide-react';
import { useEffect, useRef, type FormEvent, type KeyboardEvent, type ReactNode } from 'react';
import type { InstructionReply, RepairReply, Turn } from '../conversation';
import { useElapsedSeconds } from '../hooks/useElapsedSeconds';
import { BugReportCard, DiagnosisNotice } from './DiagnosisViews';
import { VersionCard } from './VersionCard';

type ConversationPanelProps = {
  turns: Turn[];
  selectedVersion: number | null;
  demoMode: boolean;
  draft: string;
  baseUrl: string;
  busy: boolean;
  onDraftChange: (value: string) => void;
  onBaseUrlChange: (value: string) => void;
  onSend: (instruction: string, baseUrl: string) => void;
  onSelectVersion: (version: number) => void;
  onReset: () => void;
};

const PendingReply = ({ startedAt, label }: { startedAt: number; label: string }) => {
  const elapsed = useElapsedSeconds(startedAt);
  return (
    <div className="flex items-center gap-2.5 text-sm text-zinc-400">
      <LoaderCircle className="h-4 w-4 animate-spin text-indigo-400" />
      {label}
      <span className="font-mono text-xs tabular-nums text-zinc-600">{elapsed}s</span>
    </div>
  );
};

const Notice = ({
  tone,
  icon: Icon,
  children,
}: {
  tone: 'info' | 'danger';
  icon: LucideIcon;
  children: ReactNode;
}) => (
  <div
    className={`flex gap-2.5 rounded-lg border px-3 py-2.5 text-sm leading-relaxed ${
      tone === 'info'
        ? 'border-sky-400/15 bg-sky-400/[0.06] text-sky-100/90'
        : 'border-rose-400/15 bg-rose-400/[0.06] text-rose-100/90'
    }`}
  >
    <Icon
      className={`mt-0.5 h-4 w-4 shrink-0 ${tone === 'info' ? 'text-sky-400' : 'text-rose-400'}`}
    />
    <div>{children}</div>
  </div>
);

const ErrorNotice = ({ error }: { error: ApiError }) => (
  <Notice tone="danger" icon={CircleAlert}>
    {error.message}
    {error.details && error.details.length > 0 && (
      <ul className="mt-2 space-y-0.5 font-mono text-xs text-rose-200/70">
        {error.details.map((detail) => (
          <li key={detail}>{detail}</li>
        ))}
      </ul>
    )}
  </Notice>
);

const RejectedNotice = ({ reason }: { reason: string }) => (
  <Notice tone="danger" icon={Ban}>
    <span className="font-medium">Solicitud rechazada.</span> {reason}
  </Notice>
);

type SelectionProps = {
  selectedVersion: number | null;
  onSelectVersion: (version: number) => void;
};

const InstructionReplyView = ({
  reply,
  selectedVersion,
  onSelectVersion,
}: SelectionProps & { reply: InstructionReply }) => {
  if (reply.phase === 'loading') {
    return <PendingReply startedAt={reply.startedAt} label="Generando la prueba…" />;
  }
  const { result, version } = reply;
  if (!result.ok) {
    return <ErrorNotice error={result.error} />;
  }

  switch (result.data.status) {
    case 'needs_clarification':
      return (
        <Notice tone="info" icon={CircleQuestionMark}>
          {result.data.question}
        </Notice>
      );
    case 'rejected':
      return <RejectedNotice reason={result.data.reason} />;
    case 'ok':
      return version === null ? null : (
        <VersionCard
          title={result.data.test.title}
          stepCount={result.data.test.steps.length}
          version={version}
          selected={version === selectedVersion}
          onSelect={onSelectVersion}
        />
      );
  }
};

const RepairReplyView = ({
  reply,
  selectedVersion,
  onSelectVersion,
}: SelectionProps & { reply: RepairReply }) => {
  if (reply.phase === 'loading') {
    return <PendingReply startedAt={reply.startedAt} label="Diagnosticando el fallo…" />;
  }
  const { result, version } = reply;
  if (!result.ok) {
    return <ErrorNotice error={result.error} />;
  }

  switch (result.data.status) {
    case 'rejected':
      return <RejectedNotice reason={result.data.reason} />;
    case 'bug_report':
      return (
        <div className="space-y-3">
          <DiagnosisNotice diagnosis={result.data.diagnosis} />
          <BugReportCard report={result.data.report} diagnosis={result.data.diagnosis} />
        </div>
      );
    case 'fixed':
      return (
        <div className="space-y-3">
          <DiagnosisNotice diagnosis={result.data.diagnosis} />
          {version !== null && (
            <VersionCard
              title={result.data.test.title}
              stepCount={result.data.test.steps.length}
              version={version}
              selected={version === selectedVersion}
              onSelect={onSelectVersion}
            />
          )}
        </div>
      );
  }
};

const TurnView = ({ turn, ...selection }: SelectionProps & { turn: Turn }) =>
  turn.kind === 'instruction' ? (
    <>
      <div className="ml-auto w-fit max-w-[90%] whitespace-pre-wrap rounded-2xl rounded-br-md bg-indigo-500/90 px-3.5 py-2 text-sm leading-relaxed text-white">
        {turn.instruction}
      </div>
      <InstructionReplyView reply={turn.reply} {...selection} />
    </>
  ) : (
    <>
      <div className="ml-auto flex w-fit items-center gap-2 rounded-2xl rounded-br-md border border-indigo-400/30 bg-indigo-500/10 px-3.5 py-2 text-sm text-indigo-100">
        <Wrench className="h-3.5 w-3.5 text-indigo-300" />
        Diagnosticar y reparar v{turn.sourceVersion}
      </div>
      <RepairReplyView reply={turn.reply} {...selection} />
    </>
  );

export const ConversationPanel = ({
  turns,
  selectedVersion,
  demoMode,
  draft,
  baseUrl,
  busy,
  onDraftChange,
  onBaseUrlChange,
  onSend,
  onSelectVersion,
  onReset,
}: ConversationPanelProps) => {
  const thread = useRef<HTMLDivElement>(null);
  const started = turns.length > 0;
  const canSend = draft.trim().length > 0 && !busy;

  // Solo se desplaza el hilo: scrollIntoView movería también la página y la cabecera fija
  // taparía el título.
  useEffect(() => {
    const element = thread.current;
    element?.scrollTo({ top: element.scrollHeight, behavior: 'smooth' });
  }, [turns]);

  const send = () => {
    if (canSend) {
      onSend(draft.trim(), baseUrl.trim());
    }
  };

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    send();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      send();
    }
  };

  return (
    <section className="card flex max-h-[80vh] flex-col overflow-hidden lg:h-[calc(100vh-15rem)] lg:max-h-none lg:min-h-[560px]">
      <div className="flex items-center justify-between border-b border-white/[0.06] px-5 py-3">
        <h2 className="text-sm font-medium text-zinc-200">Conversación</h2>
        {started && (
          <button
            type="button"
            onClick={onReset}
            disabled={busy}
            className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-zinc-500 transition hover:bg-white/5 hover:text-zinc-300 disabled:pointer-events-none disabled:opacity-50"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Nueva conversación
          </button>
        )}
      </div>

      <div ref={thread} className="flex-1 space-y-5 overflow-y-auto px-5 py-5">
        {demoMode && (
          <div className="flex gap-3 rounded-lg border border-amber-400/20 bg-amber-400/[0.07] p-3.5 text-sm">
            <FlaskConical className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />
            <p className="leading-relaxed text-amber-100/80">
              <span className="font-medium text-amber-200">Modo demo.</span> La IA no está
              configurada: elige uno de los ejemplos. Sus scripts son predefinidos, pero la
              ejecución en el navegador es real.
            </p>
          </div>
        )}

        {!started && (
          <div>
            <p className="text-sm leading-relaxed text-zinc-400">
              Describe un caso de prueba en lenguaje natural. Después puedes pedir cambios y cada
              respuesta genera una nueva versión del script.
            </p>
            <p className="mb-2 mt-5 text-xs font-medium uppercase tracking-wider text-zinc-500">
              Ejemplos
            </p>
            <div className="grid gap-2">
              {EXAMPLES.map((example) => (
                <button
                  key={example.id}
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    onBaseUrlChange(example.baseUrl);
                    onSend(example.instruction, example.baseUrl);
                  }}
                  className="group flex items-center justify-between rounded-lg border border-white/[0.06] bg-white/[0.02] px-3.5 py-2.5 text-left text-sm text-zinc-400 transition hover:border-white/[0.12] hover:bg-white/[0.04] hover:text-zinc-200 disabled:pointer-events-none disabled:opacity-50"
                >
                  {example.label}
                  <span className="font-mono text-[11px] text-zinc-600 group-hover:text-zinc-400">
                    saucedemo.com
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {turns.map((turn) => (
          <div key={turn.id} className="animate-fade-in space-y-3">
            <TurnView
              turn={turn}
              selectedVersion={selectedVersion}
              onSelectVersion={onSelectVersion}
            />
          </div>
        ))}
      </div>

      <form onSubmit={handleSubmit} className="border-t border-white/[0.06] p-4">
        {started ? (
          baseUrl !== '' && (
            <p className="mb-2 flex items-center gap-1.5 font-mono text-[11px] text-zinc-500">
              <Globe className="h-3 w-3" />
              {baseUrl}
            </p>
          )
        ) : (
          <div className="relative mb-2">
            <Globe className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-500" />
            <input
              type="url"
              aria-label="URL base (opcional)"
              value={baseUrl}
              onChange={(event) => onBaseUrlChange(event.target.value)}
              placeholder="URL base (opcional): https://ejemplo.com"
              className="field py-2 pl-9 font-mono text-xs"
            />
          </div>
        )}
        <div className="relative">
          <textarea
            aria-label="Instrucción"
            value={draft}
            maxLength={MAX_INSTRUCTION_LENGTH}
            onChange={(event) => onDraftChange(event.target.value)}
            onKeyDown={handleKeyDown}
            rows={3}
            placeholder={
              started
                ? 'Pide un cambio: «verifica también el precio»…'
                : 'Describe el caso de prueba…'
            }
            className="field resize-none pr-12 leading-relaxed"
          />
          <button
            type="submit"
            disabled={!canSend}
            aria-label="Enviar"
            className="absolute bottom-2.5 right-2.5 flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-500 text-white transition hover:bg-indigo-400 disabled:bg-zinc-800 disabled:text-zinc-600"
          >
            {busy ? (
              <LoaderCircle className="h-4 w-4 animate-spin" />
            ) : (
              <ArrowUp className="h-4 w-4" />
            )}
          </button>
        </div>
        <p className="mt-2 text-[11px] text-zinc-600">
          Ctrl + Enter para enviar · {draft.length}/{MAX_INSTRUCTION_LENGTH}
        </p>
      </form>
    </section>
  );
};
