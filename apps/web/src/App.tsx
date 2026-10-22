import { useRef, useState } from 'react';
import { generateTest } from './api';
import { Composer } from './components/Composer';
import { Header } from './components/Header';
import { ResultPanel, type GenerationState } from './components/ResultPanel';
import { useServiceStatus } from './hooks/useServiceStatus';

export default function App() {
  const status = useServiceStatus();
  const [instruction, setInstruction] = useState('');
  const [baseUrl, setBaseUrl] = useState('');
  const [state, setState] = useState<GenerationState>({ phase: 'idle' });
  const resultRef = useRef<HTMLDivElement>(null);

  const submit = async () => {
    setState({ phase: 'loading', startedAt: Date.now() });
    // En pantallas pequeñas el resultado queda debajo del formulario.
    if (window.matchMedia('(max-width: 1023px)').matches) {
      resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    const trimmedUrl = baseUrl.trim();
    const result = await generateTest({
      instruction: instruction.trim(),
      ...(trimmedUrl === '' ? {} : { baseUrl: trimmedUrl }),
    });
    setState({ phase: 'done', result });
  };

  return (
    <div className="flex min-h-screen flex-col">
      <Header api={status.api} runner={status.runner} />

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 pb-16 pt-10 sm:px-6 sm:pt-14">
        <div className="mb-10 max-w-3xl">
          <p className="mb-3 text-xs font-medium uppercase tracking-[0.18em] text-indigo-400">
            Pruebas end-to-end con IA
          </p>
          <h1 className="text-balance text-3xl font-semibold tracking-tight text-white sm:text-4xl">
            Describe el caso. TestPilot escribe la prueba.
          </h1>
          <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-zinc-400">
            Convierte instrucciones en lenguaje natural en scripts de Playwright con pasos
            legibles, selectores accesibles y validación de seguridad.
          </p>
        </div>

        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
          <div className="lg:sticky lg:top-20">
            <Composer
              instruction={instruction}
              baseUrl={baseUrl}
              loading={state.phase === 'loading'}
              onInstructionChange={setInstruction}
              onBaseUrlChange={setBaseUrl}
              onSubmit={() => void submit()}
            />
          </div>
          <div ref={resultRef} className="scroll-mt-20">
            <ResultPanel state={state} />
          </div>
        </div>
      </main>

      <footer className="border-t border-white/[0.06]">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-5 text-xs text-zinc-600 sm:px-6">
          <span>TestPilot</span>
          <span>Playwright · Claude · TypeScript</span>
        </div>
      </footer>
    </div>
  );
}
