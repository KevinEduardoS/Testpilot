import { useEffect, useState } from 'react';
import { isApiUp, isRunnerUp } from './api';

type ServiceStatus = 'checking' | 'up' | 'down';

const statusLabels: Record<ServiceStatus, string> = {
  checking: 'Verificando',
  up: 'Conectado',
  down: 'Sin conexión',
};

const toStatus = (up: boolean): ServiceStatus => (up ? 'up' : 'down');

export default function App() {
  const [apiStatus, setApiStatus] = useState<ServiceStatus>('checking');
  const [runnerStatus, setRunnerStatus] = useState<ServiceStatus>('checking');

  useEffect(() => {
    void isApiUp().then((up) => setApiStatus(toStatus(up)));
    void isRunnerUp().then((up) => setRunnerStatus(toStatus(up)));
  }, []);

  const overallStatus: ServiceStatus =
    apiStatus === 'checking' || runnerStatus === 'checking'
      ? 'checking'
      : apiStatus === 'up' && runnerStatus === 'up'
        ? 'up'
        : 'down';

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-10 text-slate-100">
      <div className="mx-auto max-w-5xl space-y-8">
        <header className="flex flex-col gap-4 rounded-2xl border border-slate-800 bg-slate-900/80 p-6 shadow-2xl shadow-slate-950/50">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm uppercase tracking-[0.2em] text-cyan-400">TestPilot</p>
              <h1 className="mt-2 text-3xl font-bold text-white">Generación de pruebas con IA</h1>
            </div>
            <span
              className={`inline-flex items-center rounded-full px-3 py-1 text-sm font-medium ${
                overallStatus === 'up'
                  ? 'bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-500/40'
                  : 'bg-amber-500/15 text-amber-300 ring-1 ring-amber-500/40'
              }`}
            >
              {statusLabels[overallStatus]}
            </span>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <div className="rounded-xl border border-slate-800 bg-slate-950 p-4">
              <p className="text-sm text-slate-400">API</p>
              <p className="mt-2 text-xl font-semibold">{statusLabels[apiStatus]}</p>
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-950 p-4">
              <p className="text-sm text-slate-400">Runner</p>
              <p className="mt-2 text-xl font-semibold">{statusLabels[runnerStatus]}</p>
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-950 p-4">
              <p className="text-sm text-slate-400">Infra</p>
              <p className="mt-2 text-xl font-semibold">Docker + TS</p>
            </div>
          </div>
        </header>

        <section className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-xl font-semibold text-white">Comando de prueba</h2>
            <span className="rounded-full border border-cyan-500/40 bg-cyan-500/10 px-2.5 py-1 text-xs uppercase tracking-[0.2em] text-cyan-300">
              chat
            </span>
          </div>

          <div className="space-y-4">
            <label className="block">
              <span className="mb-2 block text-sm text-slate-300">Instrucción</span>
              <textarea
                value="Inicia sesión en saucedemo.com con un usuario inválido y verifica que aparezca el mensaje de error."
                readOnly
                className="min-h-[120px] w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-slate-200 outline-none ring-0"
              />
            </label>

            <div className="flex flex-col gap-3 sm:flex-row">
              <input
                value="https://www.saucedemo.com"
                readOnly
                className="flex-1 rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-slate-200 outline-none"
              />
              <button className="rounded-xl bg-cyan-500 px-5 py-3 font-medium text-slate-950 transition hover:bg-cyan-400">
                Ejecutar
              </button>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
