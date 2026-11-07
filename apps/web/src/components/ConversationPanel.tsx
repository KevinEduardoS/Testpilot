import { EXAMPLES, MAX_INSTRUCTION_LENGTH, type ApiError } from '@testpilot/shared';
import { CornerDownLeft, LoaderCircle, RotateCcw } from 'lucide-react';
import { useEffect, useRef, type FormEvent, type KeyboardEvent, type ReactNode } from 'react';
import type { InstructionReply, RepairReply, Turn } from '../conversation';
import { useElapsedSeconds } from '../hooks/useElapsedSeconds';
import { BugReportCard, DiagnosisNotice } from './DiagnosisViews';
import { VersionCard } from './VersionCard';

type ConversationPanelProps = {
  turns: Turn[];
  selectedVersion: number | null;
  demoMode: boolean;
  // null: cualquier dominio o todavía desconocido; en ambos casos no se muestra el aviso.
  allowedDomains: string[] | null;
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
    <div className="flex items-center gap-2 text-sm text-neutral-400">
      <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
      {label}
      <span className="font-mono text-2xs tabular-nums text-neutral-600">{elapsed}s</span>
    </div>
  );
};

const Callout = ({ tone, children }: { tone: 'info' | 'danger'; children: ReactNode }) => (
  <div
    className={`border-l-2 py-0.5 pl-3 text-sm leading-relaxed ${
      tone === 'info' ? 'border-neutral-500 text-neutral-300' : 'border-red-500/70 text-red-200/90'
    }`}
  >
    {children}
  </div>
);

const ErrorNotice = ({ error }: { error: ApiError }) => (
  <Callout tone="danger">
    <span className="font-mono text-2xs text-red-400">{error.error}</span>
    <p>{error.message}</p>
    {error.details && error.details.length > 0 && (
      <ul className="mt-1.5 space-y-0.5 font-mono text-2xs text-red-300/70">
        {error.details.map((detail) => (
          <li key={detail}>{detail}</li>
        ))}
      </ul>
    )}
  </Callout>
);

const RejectedNotice = ({ reason }: { reason: string }) => (
  <Callout tone="danger">
    <span className="font-mono text-2xs text-red-400">rejected</span>
    <p>{reason}</p>
  </Callout>
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
    return <PendingReply startedAt={reply.startedAt} label="Generando la prueba" />;
  }
  const { result, version } = reply;
  if (!result.ok) {
    return <ErrorNotice error={result.error} />;
  }

  switch (result.data.status) {
    case 'needs_clarification':
      return <Callout tone="info">{result.data.question}</Callout>;
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
    return <PendingReply startedAt={reply.startedAt} label="Diagnosticando el fallo" />;
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

const Message = ({ role, children }: { role: 'Tú' | 'TestPilot'; children: ReactNode }) => (
  <div className="animate-fade-in">
    <p className="eyebrow mb-1.5">{role}</p>
    {children}
  </div>
);

const TurnView = ({ turn, ...selection }: SelectionProps & { turn: Turn }) => (
  <div className="space-y-4">
    <Message role="Tú">
      {turn.kind === 'instruction' ? (
        <p className="whitespace-pre-wrap text-sm leading-relaxed text-neutral-100">
          {turn.instruction}
        </p>
      ) : (
        <p className="text-sm text-neutral-100">
          Diagnosticar y reparar <span className="tag">v{turn.sourceVersion}</span>
        </p>
      )}
    </Message>
    <Message role="TestPilot">
      {turn.kind === 'instruction' ? (
        <InstructionReplyView reply={turn.reply} {...selection} />
      ) : (
        <RepairReplyView reply={turn.reply} {...selection} />
      )}
    </Message>
  </div>
);

export const ConversationPanel = ({
  turns,
  selectedVersion,
  demoMode,
  allowedDomains,
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

  // Solo se desplaza el hilo: scrollIntoView movería también la página.
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
    <section className="panel flex max-h-[80vh] flex-col overflow-hidden lg:h-[calc(100vh-9.5rem)] lg:max-h-none lg:min-h-[540px]">
      <div className="flex h-10 items-center justify-between border-b border-neutral-800 px-4">
        <h2 className="text-sm font-medium text-neutral-200">Conversación</h2>
        {started && (
          <button
            type="button"
            onClick={onReset}
            disabled={busy}
            className="btn-ghost -mr-2 h-7 px-2 text-xs"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Nueva
          </button>
        )}
      </div>

      <div ref={thread} className="flex-1 space-y-6 overflow-y-auto px-4 py-4">
        {demoMode && (
          <div className="flex items-start gap-3 rounded-md border border-amber-500/20 bg-amber-500/[0.04] px-3 py-2.5">
            <span className="tag shrink-0 border-amber-500/30 bg-transparent text-amber-400">
              demo
            </span>
            <p className="text-xs leading-relaxed text-neutral-400">
              Sin proveedor de IA configurado: los ejemplos devuelven scripts predefinidos. La
              ejecución en Chromium es real.
            </p>
          </div>
        )}

        {!started && (
          <div>
            <p className="text-sm leading-relaxed text-neutral-400">
              Describe un caso en lenguaje natural. Cada respuesta genera una versión del script que
              puedes ejecutar, refinar o reparar.
            </p>
            <p className="eyebrow mb-2 mt-5">Ejemplos</p>
            <ul className="divide-y divide-neutral-800 overflow-hidden rounded-md border border-neutral-800">
              {EXAMPLES.map((example) => (
                <li key={example.id}>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => {
                      onBaseUrlChange(example.baseUrl);
                      onSend(example.instruction, example.baseUrl);
                    }}
                    className="group flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm text-neutral-300 transition-colors hover:bg-neutral-800/40 hover:text-neutral-100 disabled:pointer-events-none disabled:opacity-50"
                  >
                    {example.label}
                    <span className="font-mono text-2xs text-neutral-600 group-hover:text-neutral-400">
                      {new URL(example.baseUrl).hostname}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        {turns.map((turn) => (
          <TurnView
            key={turn.id}
            turn={turn}
            selectedVersion={selectedVersion}
            onSelectVersion={onSelectVersion}
          />
        ))}
      </div>

      <form onSubmit={handleSubmit} className="border-t border-neutral-800 p-3">
        <div className="overflow-hidden rounded-md border border-neutral-800 bg-neutral-950 focus-within:border-neutral-600">
          <div className="flex items-center border-b border-neutral-800">
            <span className="shrink-0 border-r border-neutral-800 px-2.5 py-1.5 font-mono text-2xs text-neutral-500">
              base_url
            </span>
            {started ? (
              <span className="truncate px-2.5 font-mono text-xs text-neutral-400">
                {baseUrl === '' ? '—' : baseUrl}
              </span>
            ) : (
              <input
                type="url"
                aria-label="URL base (opcional)"
                value={baseUrl}
                onChange={(event) => onBaseUrlChange(event.target.value)}
                placeholder={`https://${allowedDomains?.[0] ?? 'ejemplo.com'}`}
                className="min-w-0 flex-1 bg-transparent px-2.5 py-1.5 font-mono text-xs text-neutral-200 placeholder:text-neutral-700 focus:outline-none"
              />
            )}
          </div>
          <textarea
            aria-label="Instrucción"
            value={draft}
            maxLength={MAX_INSTRUCTION_LENGTH}
            onChange={(event) => onDraftChange(event.target.value)}
            onKeyDown={handleKeyDown}
            rows={3}
            placeholder={
              started
                ? 'Pide un cambio: «verifica también el precio»'
                : 'Describe el caso de prueba'
            }
            className="block w-full resize-none bg-transparent px-3 py-2.5 text-sm leading-relaxed text-neutral-100 placeholder:text-neutral-600 focus:outline-none"
          />
          <div className="flex items-center justify-between gap-3 px-3 pb-2.5">
            <span className="flex items-center gap-1.5 text-2xs text-neutral-600">
              <span className="kbd">Ctrl</span>
              <span className="kbd">
                <CornerDownLeft className="h-2.5 w-2.5" />
              </span>
              <span className="font-mono tabular-nums">
                {draft.length}/{MAX_INSTRUCTION_LENGTH}
              </span>
            </span>
            <button type="submit" disabled={!canSend} className="btn-primary h-7 px-2.5 text-xs">
              {busy && <LoaderCircle className="h-3.5 w-3.5 animate-spin" />}
              {started ? 'Enviar' : 'Generar prueba'}
            </button>
          </div>
        </div>
        {!started && allowedDomains !== null && (
          <p className="mt-2 font-mono text-2xs text-neutral-600">
            allowed_domains: {allowedDomains.join(', ')}
          </p>
        )}
      </form>
    </section>
  );
};
