import {
  apiErrorSchema,
  appInfoSchema,
  generateTestResponseSchema,
  healthStatusSchema,
  runnerPingSchema,
  type ApiError,
  type AppInfo,
  type ExecuteTestRequest,
  type ExecutionEvent,
  type GenerateTestRequest,
  type GenerateTestResponse,
} from '@testpilot/shared';
import { readExecutionEvents } from '@testpilot/shared/execution-stream';
import { env } from './config';

const REQUEST_TIMEOUT_MS = 5000;
// La generación con IA puede tardar; el SDK de la API reintenta antes de rendirse.
const GENERATE_TIMEOUT_MS = 180_000;
// Incluye el arranque del navegador y el timeout de la prueba en el runner.
const EXECUTE_TIMEOUT_MS = 150_000;

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

export const getAppInfo = async (): Promise<AppInfo | null> => {
  try {
    return appInfoSchema.parse(await fetchJson('/api/info'));
  } catch {
    return null;
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

export type ApiResult<T> = { ok: true; data: T } | { ok: false; error: ApiError };
export type GenerateResult = ApiResult<GenerateTestResponse>;

const failure = (error: string, message: string): { ok: false; error: ApiError } => ({
  ok: false,
  error: { error, message },
});

const networkFailure = (error: unknown) =>
  error instanceof DOMException && error.name === 'TimeoutError'
    ? failure('timeout', 'La operación tardó demasiado. Intenta de nuevo.')
    : failure('network_error', 'No se pudo conectar con la API.');

const errorFromResponse = async (response: Response): Promise<ApiError> => {
  let body: unknown = null;
  try {
    body = await response.json();
  } catch {
    // Sin cuerpo JSON: se informa solo el estado HTTP.
  }
  const parsed = apiErrorSchema.safeParse(body);
  return parsed.success
    ? parsed.data
    : failure('unexpected_response', `La API respondió con el estado ${response.status}.`).error;
};

const post = async (
  path: string,
  input: unknown,
  timeoutMs: number,
): Promise<{ ok: true; response: Response } | { ok: false; error: ApiError }> => {
  try {
    const response = await fetch(`${env.VITE_API_URL}${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(input),
      signal: AbortSignal.timeout(timeoutMs),
    });
    return response.ok
      ? { ok: true, response }
      : { ok: false, error: await errorFromResponse(response) };
  } catch (error) {
    return networkFailure(error);
  }
};

export const generateTest = async (input: GenerateTestRequest): Promise<GenerateResult> => {
  const result = await post('/api/tests/generate', input, GENERATE_TIMEOUT_MS);
  if (!result.ok) {
    return result;
  }
  let body: unknown;
  try {
    body = await result.response.json();
  } catch (error) {
    return networkFailure(error);
  }
  const parsed = generateTestResponseSchema.safeParse(body);
  return parsed.success
    ? { ok: true, data: parsed.data }
    : failure('invalid_response', 'La API devolvió una respuesta con un formato inesperado.');
};

// Ejecuta una prueba y entrega su progreso evento a evento. El último evento es siempre
// "result" o "error", también cuando la API rechaza la petición o se pierde la conexión.
export const streamExecution = async (
  input: ExecuteTestRequest,
  onEvent: (event: ExecutionEvent) => void,
): Promise<void> => {
  const result = await post('/api/tests/execute', input, EXECUTE_TIMEOUT_MS);
  if (!result.ok) {
    onEvent({ type: 'error', error: result.error });
    return;
  }
  const { body } = result.response;
  if (body === null) {
    onEvent({
      type: 'error',
      error: failure('invalid_response', 'La API no devolvió eventos.').error,
    });
    return;
  }
  for await (const event of readExecutionEvents(body)) {
    onEvent(event);
  }
};
