import {
  ArrowDown,
  Bug,
  CircleCheck,
  CircleX,
  LoaderCircle,
  Play,
  ShieldCheck,
  Sparkles,
  Wrench,
  type LucideIcon,
} from 'lucide-react';
import type { HeroOutcome, HeroStepStatus } from '../../hero-timeline';
import { useHeroDemo } from '../../hooks/useHeroDemo';

const HIGHLIGHTS = [
  { icon: Play, text: 'Chromium real' },
  { icon: ShieldCheck, text: 'Política de seguridad AST' },
  { icon: Sparkles, text: 'Diagnóstico con IA' },
];

const OUTCOME_STYLES: Record<HeroOutcome['tone'], { icon: LucideIcon; style: string }> = {
  passed: { icon: CircleCheck, style: 'border-emerald-400/30 bg-emerald-400/10 text-emerald-200' },
  fixed: { icon: Wrench, style: 'border-sky-400/30 bg-sky-400/10 text-sky-200' },
  bug: { icon: Bug, style: 'border-rose-400/30 bg-rose-400/10 text-rose-200' },
};

const StepIcon = ({ status }: { status: HeroStepStatus }) => {
  switch (status) {
    case 'pending':
      return <span className="h-3.5 w-3.5 rounded-full border border-white/15" />;
    case 'running':
      return <LoaderCircle className="h-3.5 w-3.5 animate-spin text-indigo-300" />;
    case 'passed':
      return <CircleCheck className="h-3.5 w-3.5 text-emerald-400" />;
    case 'failed':
      return <CircleX className="h-3.5 w-3.5 text-rose-400" />;
  }
};

// Ventana que imita la herramienta y reproduce el flujo completo en bucle.
const HeroDemo = () => {
  const { scenario, frame } = useHeroDemo();
  const typing = frame.typed.length < scenario.instruction.length;
  const outcome = OUTCOME_STYLES[scenario.outcome.tone];
  const OutcomeIcon = outcome.icon;

  return (
    <div className="relative" aria-hidden="true">
      <div className="absolute -inset-px rounded-2xl bg-gradient-to-br from-indigo-500/40 via-sky-500/10 to-emerald-500/30 blur-xl" />
      <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-zinc-950/90 shadow-2xl shadow-indigo-950/50 backdrop-blur">
        <div className="flex items-center gap-1.5 border-b border-white/[0.06] px-4 py-3">
          <span className="h-2.5 w-2.5 rounded-full bg-rose-400/70" />
          <span className="h-2.5 w-2.5 rounded-full bg-amber-400/70" />
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-400/70" />
          <span className="ml-3 font-mono text-[11px] text-zinc-500">
            testpilot · saucedemo.com
          </span>
        </div>

        <div className="space-y-4 p-4 sm:p-5">
          <div className="ml-auto min-h-[3.25rem] max-w-[92%] rounded-2xl rounded-br-md bg-indigo-500/90 px-3.5 py-2 text-[13px] leading-relaxed text-white">
            {frame.typed}
            {typing && (
              <span className="ml-0.5 inline-block h-3.5 w-px animate-blink bg-white align-middle" />
            )}
          </div>

          <pre className="h-[8rem] overflow-hidden rounded-lg border border-white/[0.06] bg-black/40 p-3 font-mono text-[11px] leading-[1.6rem] text-zinc-400">
            {scenario.code.slice(0, frame.codeLines).map((line) => (
              <div key={line} className="animate-fade-in truncate">
                <span className="text-sky-300">await</span>
                {line.replace(/^await/, '')}
              </div>
            ))}
          </pre>

          <ol className="space-y-2">
            {scenario.steps.map((step, index) => (
              <li
                key={step}
                className={`flex items-center gap-2.5 text-[13px] transition-colors ${
                  frame.steps[index] === 'pending' ? 'text-zinc-600' : 'text-zinc-200'
                }`}
              >
                <StepIcon status={frame.steps[index] ?? 'pending'} />
                {step}
              </li>
            ))}
          </ol>

          <div className="h-[3.75rem]">
            {frame.showOutcome && (
              <div
                className={`flex animate-rise-in items-center gap-3 rounded-lg border px-3.5 py-2.5 ${outcome.style}`}
              >
                <OutcomeIcon className="h-4 w-4 shrink-0" />
                <div className="min-w-0">
                  <p className="text-[13px] font-medium">{scenario.outcome.title}</p>
                  <p className="truncate text-[11px] opacity-75">{scenario.outcome.detail}</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export const Hero = () => (
  <section className="relative isolate overflow-hidden">
    {/* Luces de fondo en movimiento. */}
    <div className="pointer-events-none absolute inset-0 -z-10" aria-hidden="true">
      <div className="absolute -left-32 -top-40 h-[28rem] w-[28rem] animate-aurora rounded-full bg-indigo-600/25 blur-3xl" />
      <div className="absolute -right-24 top-10 h-[24rem] w-[24rem] animate-aurora rounded-full bg-sky-500/15 blur-3xl [animation-delay:-6s]" />
      <div className="absolute bottom-0 left-1/3 h-[20rem] w-[20rem] animate-aurora rounded-full bg-emerald-500/10 blur-3xl [animation-delay:-12s]" />
      <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-b from-transparent to-zinc-950" />
    </div>

    <div className="mx-auto grid max-w-7xl grid-cols-1 items-center gap-12 px-4 pb-20 pt-16 sm:px-6 lg:grid-cols-[minmax(0,6fr)_minmax(0,5fr)] lg:pb-28 lg:pt-24">
      <div>
        <p className="inline-flex animate-rise-in items-center gap-2 rounded-full border border-indigo-400/20 bg-indigo-400/10 px-3 py-1 text-xs font-medium text-indigo-200">
          <Sparkles className="h-3.5 w-3.5" />
          Pruebas end-to-end con IA
        </p>
        <h1 className="mt-6 animate-rise-in text-balance text-4xl font-semibold tracking-tight text-white [animation-delay:100ms] sm:text-5xl lg:text-6xl">
          Describe el caso. <span className="text-gradient">TestPilot escribe la prueba.</span>
        </h1>
        <p className="mt-6 max-w-xl animate-rise-in text-pretty text-base leading-relaxed text-zinc-400 [animation-delay:200ms] sm:text-lg">
          Convierte instrucciones en lenguaje natural en scripts de Playwright, los ejecuta en un
          navegador real y, cuando fallan, distingue si el error es de la prueba o un bug del sitio.
        </p>

        <div className="mt-8 flex animate-rise-in flex-wrap gap-3 [animation-delay:300ms]">
          <a
            href="#probar"
            className="group relative inline-flex items-center gap-2 overflow-hidden rounded-lg bg-indigo-500 px-5 py-2.5 text-sm font-medium text-white shadow-lg shadow-indigo-500/30 transition hover:-translate-y-0.5 hover:bg-indigo-400"
          >
            <span className="absolute inset-y-0 left-0 w-1/3 animate-shine bg-gradient-to-r from-transparent via-white/25 to-transparent" />
            <Play className="h-4 w-4" />
            Probar la demo
          </a>
          <a
            href="#como-funciona"
            className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-5 py-2.5 text-sm font-medium text-zinc-200 transition hover:-translate-y-0.5 hover:bg-white/[0.07]"
          >
            Cómo funciona
            <ArrowDown className="h-4 w-4" />
          </a>
        </div>

        <ul className="mt-10 flex animate-rise-in flex-wrap gap-x-6 gap-y-3 [animation-delay:400ms]">
          {HIGHLIGHTS.map(({ icon: Icon, text }) => (
            <li key={text} className="flex items-center gap-2 text-sm text-zinc-400">
              <Icon className="h-4 w-4 text-indigo-300" />
              {text}
            </li>
          ))}
        </ul>
      </div>

      <div className="animate-rise-in [animation-delay:250ms]">
        <div className="lg:animate-float">
          <HeroDemo />
        </div>
      </div>
    </div>
  </section>
);
