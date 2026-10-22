import type { AiProvider } from '@testpilot/shared';
import { useEffect, useRef, useState } from 'react';
import { generateTest, getAppInfo, streamExecution } from './api';
import { ConversationPanel } from './components/ConversationPanel';
import { Header } from './components/Header';
import { Workspace } from './components/Workspace';
import { buildContext, nextVersionNumber, versionsOf, type Turn } from './conversation';
import { applyExecutionEvent, startExecution, type ExecutionState } from './execution';
import { useServiceStatus } from './hooks/useServiceStatus';

const IDLE_EXECUTION: ExecutionState = { phase: 'idle' };
const isMobileLayout = () => window.matchMedia('(max-width: 1023px)').matches;

export default function App() {
  const status = useServiceStatus();
  const [aiProvider, setAiProvider] = useState<AiProvider | null>(null);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [selectedVersion, setSelectedVersion] = useState<number | null>(null);
  const [executions, setExecutions] = useState<Record<number, ExecutionState>>({});
  const [draft, setDraft] = useState('');
  const [baseUrl, setBaseUrl] = useState('');
  const nextTurnId = useRef(1);
  // Cambia al empezar una conversación nueva: las respuestas de la anterior se descartan.
  const conversationId = useRef(0);
  const workspaceRef = useRef<HTMLDivElement>(null);

  // Se consulta cada vez que la API pasa a estar disponible.
  useEffect(() => {
    if (status.api === 'up') {
      void getAppInfo().then((info) => setAiProvider(info?.aiProvider ?? null));
    }
  }, [status.api]);

  const versions = versionsOf(turns);
  const selected = versions.find((version) => version.number === selectedVersion);
  const generating = turns.some((turn) => turn.reply.phase === 'loading');
  const executing = Object.values(executions).some((execution) => execution.phase === 'running');

  const send = async (instruction: string, url: string) => {
    const id = nextTurnId.current++;
    const conversation = conversationId.current;
    // Solo hay una generación a la vez, así que el número de versión se puede fijar ya.
    const versionNumber = nextVersionNumber(turns);
    const context = buildContext(turns, selected ?? versions.at(-1));

    setTurns((previous) => [
      ...previous,
      { id, instruction, reply: { phase: 'loading', startedAt: Date.now() } },
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
        turn.id === id ? { ...turn, reply: { phase: 'done', result, version } } : turn,
      ),
    );
    if (version !== null) {
      setSelectedVersion(version);
      // En pantallas pequeñas el panel de la prueba queda debajo de la conversación.
      if (isMobileLayout()) {
        workspaceRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }
  };

  const execute = async () => {
    if (selected === undefined) {
      return;
    }
    const { number } = selected;
    const conversation = conversationId.current;
    setExecutions((previous) => ({ ...previous, [number]: startExecution(Date.now()) }));

    await streamExecution({ script: selected.test.script }, (event) => {
      if (conversation !== conversationId.current) {
        return;
      }
      setExecutions((previous) => ({
        ...previous,
        [number]: applyExecutionEvent(previous[number] ?? startExecution(Date.now()), event),
      }));
    });
  };

  const reset = () => {
    conversationId.current += 1;
    setTurns([]);
    setSelectedVersion(null);
    setExecutions({});
    setDraft('');
    setBaseUrl('');
  };

  const selectedExecution =
    selected === undefined ? IDLE_EXECUTION : (executions[selected.number] ?? IDLE_EXECUTION);

  return (
    <div className="flex min-h-screen flex-col">
      <Header api={status.api} runner={status.runner} demoMode={aiProvider === 'demo'} />

      <main className="mx-auto w-full max-w-7xl flex-1 px-4 pb-10 pt-8 sm:px-6">
        <div className="mb-6">
          <h1 className="text-balance text-2xl font-semibold tracking-tight text-white sm:text-3xl">
            Describe el caso. TestPilot escribe la prueba.
          </h1>
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-zinc-400">
            Convierte instrucciones en lenguaje natural en scripts de Playwright, pídele cambios en
            la conversación y ejecuta cada versión en un navegador real.
          </p>
        </div>

        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
          <ConversationPanel
            turns={turns}
            selectedVersion={selectedVersion}
            demoMode={aiProvider === 'demo'}
            draft={draft}
            baseUrl={baseUrl}
            busy={generating}
            onDraftChange={setDraft}
            onBaseUrlChange={setBaseUrl}
            onSend={(instruction, url) => void send(instruction, url)}
            onSelectVersion={setSelectedVersion}
            onReset={reset}
          />
          <div ref={workspaceRef} className="scroll-mt-20">
            <Workspace
              version={selected}
              generating={generating}
              execution={selectedExecution}
              executeDisabled={executing}
              onExecute={() => void execute()}
            />
          </div>
        </div>
      </main>

      <footer className="border-t border-white/[0.06]">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-5 text-xs text-zinc-600 sm:px-6">
          <span>TestPilot</span>
          <span>Playwright · Claude · TypeScript</span>
        </div>
      </footer>
    </div>
  );
}
