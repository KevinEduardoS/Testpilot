import { healthStatusSchema, runnerPingSchema } from '@testpilot/shared';
import { env } from './config';

const REQUEST_TIMEOUT_MS = 5000;

const fetchJson = async (path: string): Promise<unknown> => {
  const response = await fetch(`${env.VITE_API_URL}${path}`, {
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  return response.json();
};

export const isApiUp = async (): Promise<boolean> => {
  try {
    healthStatusSchema.parse(await fetchJson('/health'));
    return true;
  } catch {
    return false;
  }
};

// El navegador nunca habla con el runner: la API comprueba su estado y lo reporta.
export const isRunnerUp = async (): Promise<boolean> => {
  try {
    return runnerPingSchema.parse(await fetchJson('/api/ping')).ok;
  } catch {
    return false;
  }
};
