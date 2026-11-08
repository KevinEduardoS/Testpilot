import { useEffect, useState } from 'react';
import { isApiUp, isRunnerUp } from '../api';
import { isRecordedBackend } from '../config';

// recorded: la web reproduce una grabación y no hay servicios que comprobar.
export type ServiceStatus = 'checking' | 'up' | 'down' | 'unknown' | 'recorded';

export type ServicesState = {
  api: ServiceStatus;
  runner: ServiceStatus;
  // Tiempo de respuesta de /health en la última comprobación correcta.
  apiLatencyMs: number | null;
};

const POLL_INTERVAL_MS = 30_000;

const toStatus = (up: boolean | null): ServiceStatus =>
  up === null ? 'unknown' : up ? 'up' : 'down';

export const useServiceStatus = (): ServicesState => {
  const [state, setState] = useState<ServicesState>(
    isRecordedBackend
      ? { api: 'recorded', runner: 'recorded', apiLatencyMs: null }
      : { api: 'checking', runner: 'checking', apiLatencyMs: null },
  );

  useEffect(() => {
    if (isRecordedBackend) {
      return;
    }
    let active = true;

    const check = () => {
      const startedAt = performance.now();
      void isApiUp().then((up) => {
        if (active) {
          const latency = Math.round(performance.now() - startedAt);
          setState((previous) => ({
            ...previous,
            api: toStatus(up),
            apiLatencyMs: up ? latency : null,
          }));
        }
      });
      void isRunnerUp().then((up) => {
        if (active) {
          setState((previous) => ({ ...previous, runner: toStatus(up) }));
        }
      });
    };

    check();
    const interval = window.setInterval(check, POLL_INTERVAL_MS);
    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, []);

  return state;
};
