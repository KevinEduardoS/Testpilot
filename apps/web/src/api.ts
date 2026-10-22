import {
  apiErrorSchema,
  generateTestResponseSchema,
  healthStatusSchema,
  runnerPingSchema,
  type ApiError,
  type GenerateTestRequest,
  type GenerateTestResponse,
} from '@testpilot/shared';
import { env } from './config';

const REQUEST_TIMEOUT_MS = 5000;
// La generación con IA puede tardar; el SDK de la API reintenta antes de rendirse.
const GENERATE_TIMEOUT_MS = 180_000;

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
// Devuelve null si la API no responde, porque entonces el estado del runner es desconocido.
export const isRunnerUp = async (): Promise<boolean | null> => {
  try {
    return runnerPingSchema.parse(await fetchJson('/api/ping')).ok;
  } catch {
    return null;
  }
};

export type GenerateResult = { ok: true; data: GenerateTestResponse } | { ok: false; error: ApiError };

const failure = (error: string, message: string): GenerateResult => ({
  ok: false,
  error: { error, message },
});

export const generateTest = async (input: GenerateTestRequest): Promise<GenerateResult> => {
  let response: Response;
  let body: unknown;

  try {
    response = await fetch(`${env.VITE_API_URL}/api/tests/generate`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(input),
      signal: AbortSignal.timeout(GENERATE_TIMEOUT_MS),
    });
    body = await response.json();
  } catch (error) {
    if (error instanceof DOMException && error.name === 'TimeoutError') {
      return failure('timeout', 'La generación tardó demasiado. Intenta de nuevo.');
    }
    return failure('network_error', 'No se pudo conectar con la API.');
  }

  if (response.ok) {
    const parsed = generateTestResponseSchema.safeParse(body);
    return parsed.success
      ? { ok: true, data: parsed.data }
      : failure('invalid_response', 'La API devolvió una respuesta con un formato inesperado.');
  }

  const parsedError = apiErrorSchema.safeParse(body);
  return parsedError.success
    ? { ok: false, error: parsedError.data }
    : failure('unexpected_response', `La API respondió con el estado ${response.status}.`);
};
