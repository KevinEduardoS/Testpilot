import type { AppInfo } from '@testpilot/shared';
import { useEffect, useRef, useState } from 'react';
import { generateTest, getAppInfo, repairTest, streamExecution } from './api';
import { ConversationPanel } from './components/ConversationPanel';
import { Header, Logo } from './components/Header';
import { Hero } from './components/landing/Hero';
import { Reveal } from './components/landing/Reveal';
import { HowItWorks, Security, TechStack } from './components/landing/Sections';
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

const IDLE_EXECUTION: ExecutionState = { phase: 'idle' };
const isMobileLayout = () => window.matchMedia('(max-width: 1023px)').matches;

export default function App() {
  const status = useServiceStatus();
  const [info, setInfo] = useState<AppInfo | null>(null);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [selectedVersion, setSelectedVersion] = useState<number | null>(null);
  const [executions, setExecutions] = useState<Record<number, ExecutionState>>({});
  const [draft, setDraft] = useState('');
  const [baseUrl, setBaseUrl] = useState('');
  const nextTurnId = useRef(1);
  // Cambia al empezar una conversación nueva: las respuestas de la anterior se descartan.
  const conversationId = useRef(0);
  const workspaceRef = useRef<HTMLDivElement>(null);

  // Un enlace directo a una sección (#seguridad) llega antes de que React la cree: el
  // navegador no encuentra el ancla, así que se desplaza aquí al montar.
  useEffect(() => {
    const section = decodeURIComponent(window.location.hash.slice(1));
    if (section !== '') {
      document.getElementById(section)?.scrollIntoView();
    }
  }, []);

  // Se consulta cada vez que la API pasa a estar disponible.
  useEffect(() => {
    if (status.api === 'up') {
      void getAppInfo().then(setInfo);
    }
  }, [status.api]);

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
      <Header api={status.api} runner={status.runner} demoMode={info?.aiProvider === 'demo'} />

      <main className="flex-1">
        <Hero />

        <section id="probar" className="mx-auto w-full max-w-7xl px-4 pb-24 pt-4 sm:px-6">
          <Reveal className="mb-6 flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="section-eyebrow">Pruébalo</p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight text-white sm:text-3xl">
                Elige un ejemplo y ejecútalo en Chromium
              </h2>
            </div>
            <p className="max-w-md text-sm leading-relaxed text-zinc-400">
              Los dos últimos ejemplos fallan a propósito: uno por un selector y otro por un bug
              real del sitio. Pulsa «Diagnosticar y reparar» para ver la diferencia.
            </p>
          </Reveal>

          <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
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
            <div ref={workspaceRef} className="scroll-mt-20">
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
        </section>

        <TechStack />
        <HowItWorks />
        <Security />
      </main>

      <footer className="border-t border-white/[0.06]">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-3 px-4 py-8 text-xs text-zinc-500 sm:flex-row sm:px-6">
          <span className="flex items-center gap-2">
            <Logo />
            TestPilot · pruebas end-to-end con IA
          </span>
          <a href="#probar" className="transition hover:text-zinc-300">
            Volver a la demo ↑
          </a>
        </div>
      </footer>
    </div>
  );
}
