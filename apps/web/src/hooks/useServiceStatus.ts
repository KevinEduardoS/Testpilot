import { useEffect, useState } from 'react';
import { isApiUp, isRunnerUp } from '../api';

export type ServiceStatus = 'checking' | 'up' | 'down' | 'unknown';

const POLL_INTERVAL_MS = 30_000;

const toStatus = (up: boolean | null): ServiceStatus =>
  up === null ? 'unknown' : up ? 'up' : 'down';

export const useServiceStatus = () => {
  const [api, setApi] = useState<ServiceStatus>('checking');
  const [runner, setRunner] = useState<ServiceStatus>('checking');

  useEffect(() => {
    let active = true;

    const check = () => {
      void isApiUp().then((up) => active && setApi(toStatus(up)));
      void isRunnerUp().then((up) => active && setRunner(toStatus(up)));
    };

    check();
    const interval = window.setInterval(check, POLL_INTERVAL_MS);
    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, []);

  return { api, runner };
};
