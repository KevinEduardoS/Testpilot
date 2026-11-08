import type { AppInfo } from '@testpilot/shared';
import {
  ArrowUpRight,
  Boxes,
  History,
  Menu,
  SquareTerminal,
  X,
  type LucideIcon,
} from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { env, isRecordedBackend } from '../../config';
import type { ServiceStatus, ServicesState } from '../../hooks/useServiceStatus';
import { hashForView, VIEW_LABELS, type View } from '../../views';

const REPOSITORY_URL = 'https://github.com/KevinEduardoS/Testpilot';

const NAV: { view: View; icon: LucideIcon }[] = [
  { view: 'playground', icon: SquareTerminal },
  { view: 'runs', icon: History },
  { view: 'architecture', icon: Boxes },
];

export const Logo = () => (
  <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
    <rect width="24" height="24" rx="5" className="fill-neutral-100" />
    <path
      d="M6.5 12.5l3.5 3.5 7.5-8"
      className="stroke-neutral-950"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
    />
  </svg>
);

const STATUS_DOT: Record<ServiceStatus, string> = {
  checking: 'bg-neutral-500',
  up: 'bg-emerald-500',
  down: 'bg-red-500',
  unknown: 'bg-neutral-600',
  recorded: 'bg-sky-500',
};

const STATUS_TEXT: Record<ServiceStatus, string> = {
  checking: 'comprobando',
  up: 'operativo',
  down: 'caído',
  unknown: 'desconocido',
  recorded: 'grabado',
};

const ServiceRow = ({
  name,
  status,
  detail,
}: {
  name: string;
  status: ServiceStatus;
  detail?: string;
}) => (
  <div className="flex items-center justify-between gap-2 py-1 text-xs">
    <span className="flex items-center gap-2 text-neutral-400">
      <span className={`h-1.5 w-1.5 rounded-full ${STATUS_DOT[status]}`} />
      {name}
    </span>
    <span className="font-mono text-2xs text-neutral-500">{detail ?? STATUS_TEXT[status]}</span>
  </div>
);

type SidebarProps = {
  view: View;
  runCount: number;
  services: ServicesState;
  info: AppInfo | null;
  onNavigate: () => void;
};

const Sidebar = ({ view, runCount, services, info, onNavigate }: SidebarProps) => (
  <div className="flex h-full flex-col">
    <div className="flex h-12 items-center gap-2 border-b border-neutral-800 px-4">
      <Logo />
      <span className="text-sm font-semibold text-neutral-100">TestPilot</span>
      <span className="tag ml-auto">v{__APP_VERSION__}</span>
    </div>

    <nav className="flex-1 space-y-6 overflow-y-auto px-2 py-4" aria-label="Principal">
      <div>
        <p className="eyebrow px-2 pb-1.5">Plataforma</p>
        <ul className="space-y-px">
          {NAV.map(({ view: target, icon: Icon }) => {
            const active = target === view;
            return (
              <li key={target}>
                <a
                  href={hashForView(target)}
                  onClick={onNavigate}
                  aria-current={active ? 'page' : undefined}
                  className={`flex h-8 items-center gap-2.5 rounded-md px-2 text-sm transition-colors ${
                    active
                      ? 'bg-neutral-800/80 text-neutral-100'
                      : 'text-neutral-400 hover:bg-neutral-800/40 hover:text-neutral-200'
                  }`}
                >
                  <Icon className="h-4 w-4 shrink-0" strokeWidth={1.75} />
                  {VIEW_LABELS[target]}
                  {target === 'runs' && runCount > 0 && (
                    <span className="ml-auto font-mono text-2xs text-neutral-500">{runCount}</span>
                  )}
                </a>
              </li>
            );
          })}
        </ul>
      </div>

      <div>
        <p className="eyebrow px-2 pb-1.5">Recursos</p>
        <ul className="space-y-px">
          {[
            { href: REPOSITORY_URL, label: 'Repositorio' },
            ...(isRecordedBackend
              ? []
              : [{ href: `${env.VITE_API_URL}/health`, label: 'Health check de la API' }]),
          ].map(({ href, label }) => (
            <li key={href}>
              <a
                href={href}
                target="_blank"
                rel="noreferrer"
                className="flex h-8 items-center justify-between rounded-md px-2 text-sm text-neutral-400 transition-colors hover:bg-neutral-800/40 hover:text-neutral-200"
              >
                {label}
                <ArrowUpRight className="h-3.5 w-3.5 text-neutral-600" />
              </a>
            </li>
          ))}
        </ul>
      </div>
    </nav>

    <div className="space-y-3 border-t border-neutral-800 px-4 py-3">
      <div>
        <p className="eyebrow pb-1">Servicios</p>
        <ServiceRow
          name="API"
          status={services.api}
          detail={services.apiLatencyMs === null ? undefined : `${services.apiLatencyMs} ms`}
        />
        <ServiceRow name="Runner" status={services.runner} />
      </div>
      {info !== null && (
        <dl className="space-y-1 text-xs">
          <div className="flex justify-between gap-2">
            <dt className="text-neutral-500">Proveedor IA</dt>
            <dd className="font-mono text-2xs text-neutral-300">{info.aiProvider}</dd>
          </div>
          {isRecordedBackend && (
            <div className="flex justify-between gap-2">
              <dt className="text-neutral-500">Backend</dt>
              <dd className="font-mono text-2xs text-sky-400">grabación</dd>
            </div>
          )}
          <div className="flex justify-between gap-2">
            <dt className="text-neutral-500">Dominios</dt>
            <dd className="truncate font-mono text-2xs text-neutral-300">
              {info.allowedDomains?.join(', ') ?? '*'}
            </dd>
          </div>
        </dl>
      )}
    </div>
  </div>
);

type AppShellProps = Omit<SidebarProps, 'onNavigate'> & {
  actions?: ReactNode;
  children: ReactNode;
};

export const AppShell = ({ view, actions, children, ...sidebar }: AppShellProps) => {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[240px_minmax(0,1fr)]">
      <aside className="sticky top-0 hidden h-screen border-r border-neutral-800 bg-neutral-950 lg:block">
        <Sidebar view={view} {...sidebar} onNavigate={() => undefined} />
      </aside>

      {menuOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button
            type="button"
            aria-label="Cerrar menú"
            className="absolute inset-0 bg-black/60"
            onClick={() => setMenuOpen(false)}
          />
          <aside className="absolute inset-y-0 left-0 w-64 border-r border-neutral-800 bg-neutral-950">
            <Sidebar view={view} {...sidebar} onNavigate={() => setMenuOpen(false)} />
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-col">
        <header className="sticky top-0 z-30 flex h-12 items-center gap-3 border-b border-neutral-800 bg-neutral-950/90 px-4 backdrop-blur sm:px-6">
          <button
            type="button"
            className="btn-ghost -ml-2 w-8 px-0 lg:hidden"
            aria-label={menuOpen ? 'Cerrar menú' : 'Abrir menú'}
            onClick={() => setMenuOpen((open) => !open)}
          >
            {menuOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </button>
          <nav aria-label="Ruta" className="flex min-w-0 items-center gap-1.5 font-mono text-xs">
            <span className="text-neutral-500">testpilot</span>
            <span className="text-neutral-700">/</span>
            <span className="truncate text-neutral-200">{view}</span>
          </nav>
          <div className="ml-auto flex items-center gap-2">{actions}</div>
        </header>
        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  );
};
