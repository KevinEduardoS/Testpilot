import type { ServiceStatus } from '../hooks/useServiceStatus';

const statusStyles: Record<ServiceStatus, { dot: string; label: string }> = {
  checking: { dot: 'bg-amber-400 animate-pulse', label: 'verificando' },
  up: { dot: 'bg-emerald-400 shadow-[0_0_8px] shadow-emerald-400/60', label: 'operativo' },
  down: { dot: 'bg-rose-500', label: 'sin conexión' },
  unknown: { dot: 'bg-zinc-600', label: 'desconocido: la API no responde' },
};

const StatusPill = ({ name, status }: { name: string; status: ServiceStatus }) => (
  <span
    className="inline-flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.03] px-2.5 py-1 text-xs text-zinc-400"
    title={`${name}: ${statusStyles[status].label}`}
  >
    <span className={`h-1.5 w-1.5 rounded-full ${statusStyles[status].dot}`} />
    {name}
    <span className="sr-only">{statusStyles[status].label}</span>
  </span>
);

export const Logo = () => (
  <svg viewBox="0 0 32 32" className="h-7 w-7" aria-hidden="true">
    <rect width="32" height="32" rx="8" className="fill-indigo-600" />
    <path
      d="M9 16.5l4.5 4.5L23 11.5"
      className="stroke-white"
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
    />
  </svg>
);

type HeaderProps = { api: ServiceStatus; runner: ServiceStatus; demoMode: boolean };

export const Header = ({ api, runner, demoMode }: HeaderProps) => (
  <header className="sticky top-0 z-20 border-b border-white/[0.06] bg-zinc-950/70 backdrop-blur-md">
    <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:px-6">
      <div className="flex items-center gap-2.5">
        <Logo />
        <span className="text-[15px] font-semibold tracking-tight text-white">TestPilot</span>
        <span className="rounded-md border border-indigo-400/20 bg-indigo-400/10 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-indigo-300">
          Beta
        </span>
        {demoMode && (
          <span
            className="rounded-md border border-amber-400/20 bg-amber-400/10 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-amber-300"
            title="Sin IA configurada: solo los ejemplos predefinidos"
          >
            Modo demo
          </span>
        )}
      </div>
      <div className="flex items-center gap-2">
        <StatusPill name="API" status={api} />
        <StatusPill name="Runner" status={runner} />
      </div>
    </div>
  </header>
);
