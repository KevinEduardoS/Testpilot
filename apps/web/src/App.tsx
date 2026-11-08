import type { AppInfo } from '@testpilot/shared';
import { useEffect, useRef, useState } from 'react';
import { generateTest, getAppInfo, repairTest, streamExecution } from './api';
import { ConversationPanel } from './components/ConversationPanel';
import { AppShell } from './components/shell/AppShell';
import { ArchitectureView } from './components/views/ArchitectureView';
import { RunsView } from './components/views/RunsView';
import { Workspace } from './components/Workspace';
import {
  buildContext,
  instructionsForVersion,
  nextVersionNumber,
  versionsOf,
  type Turn,
} from './conversation';
import {
  applyExecutionEvent,
  startExecution,
  toExecutionFailure,
  type ExecutionState,
} from './execution';
import { useServiceStatus } from './hooks/useServiceStatus';
import { isTerminalEvent, toRunRecord, type RunRecord } from './runs';
import { hashForView, viewFromHash, type View } from './views';

const IDLE_EXECUTION: ExecutionState = { phase: 'idle' };
const isMobileLayout = () => window.matchMedia('(max-width: 1023px)').matches;

export default function App() {
  const services = useServiceStatus();
  const [view, setView] = useState<View>(() => viewFromHash(window.location.hash));
  const [runs, setRuns] = useState<RunRecord[]>([]);
  const nextRunSequence = useRef(1);
  const [info, setInfo] = useState<AppInfo | null>(null);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [selectedVersion, setSelectedVersion] = useState<number | null>(null);
  const [executions, setExecutions] = useState<Record<number, ExecutionState>>({});
  const [draft, setDraft] = useState('');
  const [baseUrl, setBaseUrl] = useState('');
  const nextTurnId = useRef(1);
  // Cambia al empezar una conversación nueva: las respuestas de la anterior se descartan.
  const conversationId = useRef(0);
  // Ejecución en curso: se cancela al empezar otra conversación para liberar el runner.
  const runningExecution = useRef<AbortController | null>(null);
  const workspaceRef = useRef<HTMLDivElement>(null);

  // La vista activa vive en la URL (#/runs): los enlaces de la barra lateral solo cambian el hash.
  useEffect(() => {
    const onHashChange = () => {
      setView(viewFromHash(window.location.hash));
      window.scrollTo({ top: 0 });
    };
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  // Se consulta cada vez que la API pasa a estar disponible.
  useEffect(() => {
    if (services.api === 'up' || services.api === 'recorded') {
      void getAppInfo().then(setInfo);
    }
  }, [services.api]);

  const versions = versionsOf(turns);
  const selected = versions.find((version) => version.number === selectedVersion);
  const generating = turns.some((turn) => turn.reply.phase === 'loading');
  const executing = Object.values(executions).some((execution) => execution.phase === 'running');

  const showVersion = (version: number) => {
    setSelectedVersion(version);
    // En pantallas pequeñas el panel de la prueba queda debajo de la conversación.
    if (isMobileLayout()) {
      workspaceRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const send = async (instruction: string, url: string) => {
    const id = nextTurnId.current++;
    const conversation = conversationId.current;
    // Solo hay una generación a la vez, así que el número de versión se puede fijar ya.
    const versionNumber = nextVersionNumber(turns);
    const context = buildContext(turns, selected ?? versions.at(-1));

    setTurns((previous) => [
      ...previous,
      { id, kind: 'instruction', instruction, reply: { phase: 'loading', startedAt: Date.now() } },
    ]);
    setDraft('');

    const result = await generateTest({
      instruction,
      ...(url === '' ? {} : { baseUrl: url }),
      ...(context === undefined ? {} : { context }),
    });
    if (conversation !== conversationId.current) {
      return;
    }

    const version = result.ok && result.data.status === 'ok' ? versionNumber : null;
    setTurns((previous) =>
      previous.map((turn) =>
        turn.id === id && turn.kind === 'instruction'
          ? { ...turn, reply: { phase: 'done', result, version } }
          : turn,
      ),
    );
    if (version !== null) {
      showVersion(version);
    }
  };

  // Diagnostica la última ejecución fallida de la versión seleccionada. Si la IA corrige la
  // prueba, la corrección es una versión nueva; si encuentra un bug, la respuesta es el reporte.
  const repair = async () => {
    const execution = selected === undefined ? undefined : executions[selected.number];
    if (selected === undefined || execution?.phase !== 'done' || !execution.outcome.ok) {
      return;
    }
    const failure = toExecutionFailure(execution.outcome.result);
    if (failure === null) {
      return;
    }
    const id = nextTurnId.current++;
    const conversation = conversationId.current;
    const versionNumber = nextVersionNumber(turns);
    const sourceVersion = selected.number;

    setTurns((previous) => [
      ...previous,
      { id, kind: 'repair', sourceVersion, reply: { phase: 'loading', startedAt: Date.now() } },
    ]);

    const result = await repairTest({
      instructions: instructionsForVersion(turns, sourceVersion),
      script: selected.test.script,
      failure,
    });
    if (conversation !== conversationId.current) {
      return;
    }

    const version = result.ok && result.data.status === 'fixed' ? versionNumber : null;
    setTurns((previous) =>
      previous.map((turn) =>
        turn.id === id && turn.kind === 'repair'
          ? { ...turn, reply: { phase: 'done', result, version } }
          : turn,
      ),
    );
    if (version !== null) {
      showVersion(version);
    }
  };

  const execute = async () => {
    if (selected === undefined) {
      return;
    }
    const { number, test } = selected;
    const conversation = conversationId.current;
    const startedAt = Date.now();
    setExecutions((previous) => ({ ...previous, [number]: startExecution(startedAt) }));

    const abort = new AbortController();
    runningExecution.current = abort;
    await streamExecution(
      { script: selected.test.script },
      (event) => {
        if (conversation !== conversationId.current) {
          return;
        }
        setExecutions((previous) => ({
          ...previous,
          [number]: applyExecutionEvent(previous[number] ?? startExecution(Date.now()), event),
        }));
        if (isTerminalEvent(event)) {
          const sequence = nextRunSequence.current++;
          setRuns((previous) => [
            toRunRecord({
              sequence,
              version: number,
              title: test.title,
              startedAt,
              finishedAt: Date.now(),
              event,
            }),
            ...previous,
          ]);
        }
      },
      abort.signal,
    );
    if (runningExecution.current === abort) {
      runningExecution.current = null;
    }
  };

  const reset = () => {
    conversationId.current += 1;
    runningExecution.current?.abort();
    runningExecution.current = null;
    setTurns([]);
    setSelectedVersion(null);
    setExecutions({});
    setDraft('');
    setBaseUrl('');
    // El historial pertenece a la conversación: sus versiones dejan de existir.
    setRuns([]);
  };

  const openRun = (version: number) => {
    setSelectedVersion(version);
    window.location.hash = hashForView('playground');
  };

  const selectedExecution =
    selected === undefined ? IDLE_EXECUTION : (executions[selected.number] ?? IDLE_EXECUTION);

  return (
    <AppShell
      view={view}
      runCount={runs.length}
      services={services}
      info={info}
      actions={
        info !== null && (
          <span className="tag">
            ai: <span className="text-neutral-200">{info.aiProvider}</span>
          </span>
        )
      }
    >
      {view === 'playground' && (
        <div className="px-4 py-4 sm:px-6">
          <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
            <div>
              <h1 className="text-base font-semibold text-neutral-100">Playground</h1>
              <p className="mt-0.5 text-sm text-neutral-500">
                Genera una prueba Playwright, ejecútala en Chromium y diagnostica los fallos.
              </p>
            </div>
            <p className="font-mono text-2xs text-neutral-600">
              {versions.length} {versions.length === 1 ? 'versión' : 'versiones'} · {runs.length}{' '}
              {runs.length === 1 ? 'ejecución' : 'ejecuciones'}
            </p>
          </div>

          <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
            <ConversationPanel
              turns={turns}
              selectedVersion={selectedVersion}
              demoMode={info?.aiProvider === 'demo'}
              allowedDomains={info?.allowedDomains ?? null}
              draft={draft}
              baseUrl={baseUrl}
              busy={generating}
              onDraftChange={setDraft}
              onBaseUrlChange={setBaseUrl}
              onSend={(instruction, url) => void send(instruction, url)}
              onSelectVersion={setSelectedVersion}
              onReset={reset}
            />
            <div ref={workspaceRef} className="scroll-mt-16">
              <Workspace
                version={selected}
                generating={generating}
                execution={selectedExecution}
                executeDisabled={executing}
                repairDisabled={generating || executing}
                onExecute={() => void execute()}
                onRepair={() => void repair()}
              />
            </div>
          </div>
        </div>
      )}
      {view === 'runs' && <RunsView runs={runs} onOpen={openRun} />}
      {view === 'architecture' && <ArchitectureView />}
    </AppShell>
  );
}
